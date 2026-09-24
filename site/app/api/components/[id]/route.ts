import { COMPONENT_COLUMNS, writeAudit } from '@/lib/repository';
import { cleanText, database, HttpError, jsonError, jsonOk, requireActor, requireProjectAccess } from '@/lib/server';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const component = await database().one<Record<string, unknown>>(`SELECT ${COMPONENT_COLUMNS}, p.name AS "projectName" FROM components c JOIN projects p ON p.id = c.project_id WHERE c.id = $1 AND c.disabled_at IS NULL`, [id]);
    if (!component) throw new HttpError(404, '未找到该构件');
    await requireProjectAccess(actor, String(component.projectId), 'read');
    const [progress, photoRows, milestoneRows] = await Promise.all([
      database().many(`SELECT id, component_id AS "componentId", from_status AS "fromStatus", to_status AS "toStatus", actual_at AS "actualAt", submitted_at AS "submittedAt", operator_name AS "operatorName", remark, event_type AS "eventType" FROM progress_records WHERE component_id = $1 ORDER BY submitted_at DESC`, [id]),
      database().many(`SELECT id, component_id AS "componentId", file_name AS "fileName", mime_type AS "mimeType", size, uploader_name AS "uploaderName", created_at AS "createdAt" FROM photos WHERE component_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`, [id]),
      database().many(`SELECT id, type, actual_at AS "actualAt", operator_name AS "operatorName", vehicle_no AS "vehicleNo", receiver, location, remark, created_at AS "createdAt" FROM milestones WHERE component_id = $1 ORDER BY actual_at DESC`, [id]),
    ]);
    const photos = photoRows.map((photo) => ({ ...photo, url: `/api/files/${String(photo.id)}` }));
    return jsonOk({ ...component, progress, photos, milestones: milestoneRows });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const before = await database().one<Record<string, unknown>>(`SELECT * FROM components WHERE id = $1 AND disabled_at IS NULL`, [id]);
    if (!before) throw new HttpError(404, '未找到该构件');
    await requireProjectAccess(actor, String(before.project_id), 'admin');
    const body = (await request.json()) as Record<string, unknown>;
    const next = {
      name: cleanText(body.name, 120) || String(before.name),
      type: cleanText(body.type, 60) || String(before.type),
      specification: cleanText(body.specification, 100), material: cleanText(body.material, 100),
      batch: cleanText(body.batch, 80), building: cleanText(body.building, 80),
      floor: cleanText(body.floor, 40), area: cleanText(body.area, 100), notes: cleanText(body.notes, 1000),
      updatedAt: new Date().toISOString(), updatedBy: actor.displayName,
    };
    await database().transaction(async (tx) => {
      await tx.execute(`UPDATE components SET name = $1, type = $2, specification = $3, material = $4, batch = $5, building = $6, floor = $7, area = $8, notes = $9, updated_at = $10, updated_by = $11, version = version + 1 WHERE id = $12`, [next.name, next.type, next.specification, next.material, next.batch, next.building, next.floor, next.area, next.notes, next.updatedAt, next.updatedBy, id]);
      await writeAudit(tx, request, actor, 'COMPONENT_UPDATED', 'component', id, String(before.project_id), before, next);
    });
    return jsonOk({ id, ...next });
  } catch (error) { return jsonError(error); }
}
