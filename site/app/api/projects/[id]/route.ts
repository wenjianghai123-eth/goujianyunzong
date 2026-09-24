import { writeAudit } from '@/lib/repository';
import { cleanText, database, HttpError, jsonError, jsonOk, requireActor, requireProjectAccess } from '@/lib/server';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    await requireProjectAccess(actor, id, 'admin');
    const before = await database().one<Record<string, unknown>>(`SELECT * FROM projects WHERE id = $1`, [id]);
    if (!before) throw new HttpError(404, '未找到该项目');
    const body = (await request.json()) as Record<string, unknown>;
    const status = body.status === 'ARCHIVED' ? 'ARCHIVED' : body.status === 'ACTIVE' ? 'ACTIVE' : String(before.status);
    const next = { name: cleanText(body.name, 100) || String(before.name), address: cleanText(body.address, 200), owner: cleanText(body.owner, 80), status, requireOnsitePhoto: body.requireOnsitePhoto !== false, requireCompletePhoto: body.requireCompletePhoto !== false, updatedAt: new Date().toISOString() };
    await database().transaction(async (tx) => {
      await tx.execute(`UPDATE projects SET name = $1, address = $2, owner = $3, status = $4, require_onsite_photo = $5, require_complete_photo = $6, updated_at = $7 WHERE id = $8`, [next.name, next.address, next.owner, next.status, next.requireOnsitePhoto, next.requireCompletePhoto, next.updatedAt, id]);
      await writeAudit(tx, request, actor, status !== before.status ? 'PROJECT_STATUS_CHANGED' : 'PROJECT_UPDATED', 'project', id, id, before, next);
    });
    return jsonOk({ id, ...next });
  } catch (error) { return jsonError(error); }
}
