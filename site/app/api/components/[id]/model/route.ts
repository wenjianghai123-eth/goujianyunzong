import { writeAudit } from '@/lib/repository';
import { database, HttpError, jsonError, jsonOk, makeId, requireActor, requireProjectAccess } from '@/lib/server';
import { createPrivateUrl, removeObject, uploadObject } from '@/lib/storage';

type Context = { params: Promise<{ id: string }> };
const MAX_MODEL_SIZE = 50 * 1024 * 1024;

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const component = await database().one<{ projectId: string; objectKey: string | null; fileName: string | null }>(`SELECT project_id AS "projectId", model_object_key AS "objectKey", model_file_name AS "fileName" FROM components WHERE id = $1 AND disabled_at IS NULL`, [id]);
    if (component) await requireProjectAccess(actor, component.projectId, 'read');
    if (!component?.objectKey) throw new HttpError(404, '该构件尚未上传三维模型');
    const url = await createPrivateUrl(component.objectKey);
    return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, no-store' } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id: componentId } = await context.params;
    const component = await database().one<{ projectId: string; oldObjectKey: string | null; latestModelVersion: number }>(`SELECT project_id AS "projectId", model_object_key AS "oldObjectKey", (SELECT COALESCE(MAX(version), 0) FROM model_assets WHERE component_id = components.id) AS "latestModelVersion" FROM components WHERE id = $1 AND disabled_at IS NULL`, [componentId]);
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
    await uploadObject(
      objectKey,
      file,
      { componentId, uploaderId: actor.userId },
      'model/gltf-binary',
    );
    const now = new Date().toISOString();
    try {
      await database().transaction(async (tx) => {
        await tx.execute(`UPDATE components SET model_object_key = $1, model_file_name = $2, model_size = $3, updated_at = $4, updated_by = $5, version = version + 1 WHERE id = $6`, [objectKey, file.name.slice(0, 240), file.size, now, actor.displayName, componentId]);
        await tx.execute(`INSERT INTO model_assets (id, project_id, component_id, version, object_key, file_name, size, uploader_id, uploader_name, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [modelAssetId, component.projectId, componentId, modelVersion, objectKey, file.name.slice(0, 240), file.size, actor.userId, actor.displayName, now]);
        await writeAudit(tx, request, actor, 'MODEL_UPLOADED', 'component', componentId, component.projectId, { objectKey: component.oldObjectKey }, { objectKey, fileName: file.name, size: file.size });
      });
    } catch (error) {
      await removeObject(objectKey).catch(() => undefined);
      throw error;
    }
    return jsonOk({ componentId, fileName: file.name, size: file.size, version: modelVersion, uploadedAt: now });
  } catch (error) { return jsonError(error); }
}
