import { auditStatement } from '@/lib/repository';
import { database, files, HttpError, jsonError, jsonOk, makeId, requireActor, requireProjectAccess } from '@/lib/server';

type Context = { params: Promise<{ id: string }> };
const MAX_MODEL_SIZE = 50 * 1024 * 1024;

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const component = await database().prepare(`SELECT project_id AS projectId, model_object_key AS objectKey, model_file_name AS fileName FROM components WHERE id = ? AND disabled_at IS NULL`).bind(id).first<{ projectId: string; objectKey: string | null; fileName: string | null }>();
    if (component) await requireProjectAccess(actor, component.projectId, 'read');
    if (!component?.objectKey) throw new HttpError(404, '该构件尚未上传三维模型');
    const object = await files().get(component.objectKey);
    if (!object) throw new HttpError(404, '模型文件不存在');
    return new Response(object.body, { headers: { 'Content-Type': 'model/gltf-binary', 'Content-Length': String(object.size), 'Cache-Control': 'private, max-age=3600', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(component.fileName ?? 'model.glb')}`, 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id: componentId } = await context.params;
    const component = await database().prepare(`SELECT project_id AS projectId, model_object_key AS oldObjectKey, (SELECT COALESCE(MAX(version), 0) FROM model_assets WHERE component_id = components.id) AS latestModelVersion FROM components WHERE id = ? AND disabled_at IS NULL`).bind(componentId).first<{ projectId: string; oldObjectKey: string | null; latestModelVersion: number }>();
    if (!component) throw new HttpError(404, '未找到该构件');
    await requireProjectAccess(actor, component.projectId, 'admin');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new HttpError(400, '请选择 GLB 模型');
    if (!file.name.toLowerCase().endsWith('.glb')) throw new HttpError(400, 'MVP 仅支持 GLB 模型');
    if (file.size <= 0 || file.size > MAX_MODEL_SIZE) throw new HttpError(400, '模型大小必须在 50 MB 以内');
    const modelAssetId = makeId('model');
    const modelVersion = Number(component.latestModelVersion || 0) + 1;
    const objectKey = `models/${component.projectId}/${componentId}/${modelAssetId}.glb`;
    await files().put(objectKey, file.stream(), { httpMetadata: { contentType: 'model/gltf-binary' }, customMetadata: { componentId, uploaderId: actor.userId } });
    const now = new Date().toISOString();
    try {
      await database().batch([
        database().prepare(`UPDATE components SET model_object_key = ?, model_file_name = ?, model_size = ?, updated_at = ?, updated_by = ?, version = version + 1 WHERE id = ?`).bind(objectKey, file.name.slice(0, 240), file.size, now, actor.displayName, componentId),
        database().prepare(`INSERT INTO model_assets (id, project_id, component_id, version, object_key, file_name, size, uploader_id, uploader_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(modelAssetId, component.projectId, componentId, modelVersion, objectKey, file.name.slice(0, 240), file.size, actor.userId, actor.displayName, now),
        auditStatement(request, actor, 'MODEL_UPLOADED', 'component', componentId, component.projectId, { objectKey: component.oldObjectKey }, { objectKey, fileName: file.name, size: file.size }),
      ]);
    } catch (error) {
      await files().delete(objectKey);
      throw error;
    }
    return jsonOk({ componentId, fileName: file.name, size: file.size, version: modelVersion, uploadedAt: now });
  } catch (error) { return jsonError(error); }
}
