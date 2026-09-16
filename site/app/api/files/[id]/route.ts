import { auditStatement } from '@/lib/repository';
import { database, files, HttpError, jsonError, requireActor, requireProjectAccess } from '@/lib/server';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const photo = await database().prepare(`SELECT p.object_key AS objectKey, p.file_name AS fileName, p.mime_type AS mimeType, c.project_id AS projectId FROM photos p JOIN components c ON c.id = p.component_id WHERE p.id = ? AND p.deleted_at IS NULL`).bind(id).first<{ objectKey: string; fileName: string; mimeType: string; projectId: string }>();
    if (!photo) throw new HttpError(404, '未找到该照片');
    await requireProjectAccess(actor, photo.projectId, 'read');
    const object = await files().get(photo.objectKey);
    if (!object) throw new HttpError(404, '照片文件不存在');
    return new Response(object.body, {
      headers: {
        'Content-Type': photo.mimeType,
        'Content-Length': String(object.size),
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName)}`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const photo = await database().prepare(`SELECT p.id, p.component_id AS componentId, c.project_id AS projectId FROM photos p JOIN components c ON c.id = p.component_id WHERE p.id = ? AND p.deleted_at IS NULL`).bind(id).first<{ id: string; componentId: string; projectId: string }>();
    if (!photo) throw new HttpError(404, '未找到该照片');
    await requireProjectAccess(actor, photo.projectId, 'admin');
    const deletedAt = new Date().toISOString();
    await database().batch([
      database().prepare(`UPDATE photos SET deleted_at = ? WHERE id = ?`).bind(deletedAt, id),
      auditStatement(request, actor, 'PHOTO_DELETED', 'photo', id, photo.projectId, { componentId: photo.componentId }, { deletedAt }),
    ]);
    return Response.json({ ok: true, data: { id, deleted: true } });
  } catch (error) { return jsonError(error); }
}
