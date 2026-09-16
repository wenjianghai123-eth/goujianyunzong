import { auditStatement } from '@/lib/repository';
import { cleanText, database, HttpError, jsonError, jsonOk, requireActor, requireProjectAccess } from '@/lib/server';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    await requireProjectAccess(actor, id, 'admin');
    const before = await database().prepare(`SELECT * FROM projects WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    if (!before) throw new HttpError(404, '未找到该项目');
    const body = await request.json<Record<string, unknown>>();
    const status = body.status === 'ARCHIVED' ? 'ARCHIVED' : body.status === 'ACTIVE' ? 'ACTIVE' : String(before.status);
    const next = { name: cleanText(body.name, 100) || String(before.name), address: cleanText(body.address, 200), owner: cleanText(body.owner, 80), status, requireOnsitePhoto: body.requireOnsitePhoto === false ? 0 : 1, requireCompletePhoto: body.requireCompletePhoto === false ? 0 : 1, updatedAt: new Date().toISOString() };
    await database().batch([
      database().prepare(`UPDATE projects SET name = ?, address = ?, owner = ?, status = ?, require_onsite_photo = ?, require_complete_photo = ?, updated_at = ? WHERE id = ?`).bind(next.name, next.address, next.owner, next.status, next.requireOnsitePhoto, next.requireCompletePhoto, next.updatedAt, id),
      auditStatement(request, actor, status !== before.status ? 'PROJECT_STATUS_CHANGED' : 'PROJECT_UPDATED', 'project', id, id, before, next),
    ]);
    return jsonOk({ id, ...next });
  } catch (error) { return jsonError(error); }
}
