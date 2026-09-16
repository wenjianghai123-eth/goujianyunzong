import { COMPONENT_COLUMNS } from '@/lib/repository';
import { database, HttpError, jsonError, jsonOk, requireActor, requireProjectAccess } from '@/lib/server';

type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { token } = await context.params;
    if (!/^[a-f0-9]{48}$/.test(token)) throw new HttpError(404, '二维码无效或已失效');
    const component = await database().prepare(`SELECT ${COMPONENT_COLUMNS}, p.name AS projectName, p.require_onsite_photo AS requireOnsitePhoto, p.require_complete_photo AS requireCompletePhoto FROM components c JOIN projects p ON p.id = c.project_id WHERE c.qr_token = ? AND c.disabled_at IS NULL`).bind(token).first<Record<string, unknown>>();
    if (!component) throw new HttpError(404, '二维码无效或已失效');
    await requireProjectAccess(actor, String(component.projectId), 'read');
    const [progress, photoRows, milestones] = await Promise.all([
      database().prepare(`SELECT id, from_status AS fromStatus, to_status AS toStatus, actual_at AS actualAt, submitted_at AS submittedAt, operator_name AS operatorName, remark, event_type AS eventType FROM progress_records WHERE component_id = ? ORDER BY submitted_at DESC`).bind(String(component.id)).all(),
      database().prepare(`SELECT id, file_name AS fileName, mime_type AS mimeType, size, uploader_name AS uploaderName, created_at AS createdAt FROM photos WHERE component_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`).bind(String(component.id)).all(),
      database().prepare(`SELECT id, type, actual_at AS actualAt, operator_name AS operatorName, vehicle_no AS vehicleNo, receiver, location, remark, created_at AS createdAt FROM milestones WHERE component_id = ? ORDER BY actual_at DESC`).bind(String(component.id)).all(),
    ]);
    return jsonOk({ ...component, progress: progress.results, photos: photoRows.results.map((photo) => ({ ...photo, url: `/api/files/${String(photo.id)}` })), milestones: milestones.results });
  } catch (error) { return jsonError(error); }
}
