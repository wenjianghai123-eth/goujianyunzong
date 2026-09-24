import { writeAudit } from '@/lib/repository';
import { database, HttpError, jsonError, requireActor, requireProjectAccess } from '@/lib/server';
import { createPrivateUrl, removeObject } from '@/lib/storage';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const photo = await database().one<{ objectKey: string; fileName: string; mimeType: string; projectId: string }>(`SELECT p.object_key AS "objectKey", p.file_name AS "fileName", p.mime_type AS "mimeType", c.project_id AS "projectId" FROM photos p JOIN components c ON c.id = p.component_id WHERE p.id = $1 AND p.deleted_at IS NULL`, [id]);
    if (!photo) throw new HttpError(404, '未找到该照片');
    await requireProjectAccess(actor, photo.projectId, 'read');
    const url = await createPrivateUrl(photo.objectKey);
    return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, no-store' } });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const photo = await database().one<{ id: string; componentId: string; projectId: string; objectKey: string }>(`SELECT p.id, p.component_id AS "componentId", p.object_key AS "objectKey", c.project_id AS "projectId" FROM photos p JOIN components c ON c.id = p.component_id WHERE p.id = $1 AND p.deleted_at IS NULL`, [id]);
    if (!photo) throw new HttpError(404, '未找到该照片');
    await requireProjectAccess(actor, photo.projectId, 'admin');
    const deletedAt = new Date().toISOString();
    await database().transaction(async (tx) => {
      await tx.execute(`UPDATE photos SET deleted_at = $1 WHERE id = $2`, [deletedAt, id]);
      await writeAudit(tx, request, actor, 'PHOTO_DELETED', 'photo', id, photo.projectId, { componentId: photo.componentId }, { deletedAt });
      await removeObject(photo.objectKey);
    });
    return Response.json({ ok: true, data: { id, deleted: true } });
  } catch (error) { return jsonError(error); }
}
