import { auditStatement } from '@/lib/repository';
import { database, files, HttpError, jsonError, jsonOk, makeId, requireActor, requireProjectAccess } from '@/lib/server';

type Context = { params: Promise<{ id: string }> };
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 20 * 1024 * 1024;

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id: componentId } = await context.params;
    const component = await database().prepare(`SELECT project_id AS projectId FROM components WHERE id = ? AND disabled_at IS NULL`).bind(componentId).first<{ projectId: string }>();
    if (!component) throw new HttpError(404, '未找到该构件');
    await requireProjectAccess(actor, component.projectId, 'write');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new HttpError(400, '请选择需要上传的照片');
    if (!IMAGE_TYPES.has(file.type)) throw new HttpError(400, '仅支持 JPG、PNG 或 WebP 图片');
    if (file.size <= 0 || file.size > MAX_SIZE) throw new HttpError(400, '单张照片大小必须在 20 MB 以内');
    const id = makeId('photo');
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const objectKey = `photos/${component.projectId}/${componentId}/${id}.${extension}`;
    const now = new Date().toISOString();
    await files().put(objectKey, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { componentId, uploaderId: actor.userId } });
    try {
      await database().batch([
        database().prepare(`INSERT INTO photos (id, component_id, object_key, file_name, mime_type, size, uploader_id, uploader_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, componentId, objectKey, file.name.slice(0, 240), file.type, file.size, actor.userId, actor.displayName, now),
        auditStatement(request, actor, 'PHOTO_UPLOADED', 'photo', id, component.projectId, null, { componentId, fileName: file.name, size: file.size }),
      ]);
    } catch (error) {
      await files().delete(objectKey);
      throw error;
    }
    return jsonOk({ id, componentId, fileName: file.name, mimeType: file.type, size: file.size, uploaderName: actor.displayName, createdAt: now, url: `/api/files/${id}` }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
