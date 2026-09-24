import { COMPONENT_COLUMNS } from '@/lib/repository';
import { database, HttpError, jsonError, jsonOk, requireActor, requireProjectAccess } from '@/lib/server';

type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { token } = await context.params;
    if (!/^[a-f0-9]{48}$/.test(token)) throw new HttpError(404, '二维码无效或已失效');
    const component = await database().one<Record<string, unknown>>(`SELECT ${COMPONENT_COLUMNS}, p.name AS "projectName", p.require_onsite_photo AS "requireOnsitePhoto", p.require_complete_photo AS "requireCompletePhoto" FROM components c JOIN projects p ON p.id = c.project_id WHERE c.qr_token = $1 AND c.disabled_at IS NULL`, [token]);
    if (!component) throw new HttpError(404, '二维码无效或已失效');
    await requireProjectAccess(actor, String(component.projectId), 'read');
    const [progress, photoRows, milestones] = await Promise.all([
      database().many(`SELECT id, from_status AS "fromStatus", to_status AS "toStatus", actual_at AS "actualAt", submitted_at AS "submittedAt", operator_name AS "operatorName", remark, event_type AS "eventType" FROM progress_records WHERE component_id = $1 ORDER BY submitted_at DESC`, [String(component.id)]),
      database().many(`SELECT id, file_name AS "fileName", mime_type AS "mimeType", size, uploader_name AS "uploaderName", created_at AS "createdAt" FROM photos WHERE component_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`, [String(component.id)]),
      database().many(`SELECT id, type, actual_at AS "actualAt", operator_name AS "operatorName", vehicle_no AS "vehicleNo", receiver, location, remark, created_at AS "createdAt" FROM milestones WHERE component_id = $1 ORDER BY actual_at DESC`, [String(component.id)]),
    ]);
    return jsonOk({ ...component, progress, photos: photoRows.map((photo) => ({ ...photo, url: `/api/files/${String(photo.id)}` })), milestones });
  } catch (error) { return jsonError(error); }
}
