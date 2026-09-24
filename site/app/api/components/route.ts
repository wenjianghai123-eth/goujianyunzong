import type { ComponentStatus } from '@/lib/domain';
import { COMPONENT_COLUMNS, isConstraintError, writeAudit } from '@/lib/repository';
import { cleanText, database, HttpError, jsonError, jsonOk, makeId, makeQrToken, requireActor, requireProjectAccess } from '@/lib/server';

const allowedStatuses = new Set<ComponentStatus>(['UNRECORDED', 'PROCESSING', 'ONSITE', 'COMPLETED']);

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const projectId = cleanText(url.searchParams.get('projectId'), 80);
    if (!projectId) throw new HttpError(400, '缺少项目参数');
    await requireProjectAccess(actor, projectId, 'read');
    const status = cleanText(url.searchParams.get('status'), 30) as ComponentStatus;
    const query = cleanText(url.searchParams.get('query'), 100);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500);
    const conditions = ['c.project_id = $1', 'c.disabled_at IS NULL'];
    const bindings: unknown[] = [projectId];
    if (status && allowedStatuses.has(status)) { bindings.push(status); conditions.push(`c.current_status = $${bindings.length}`); }
    if (query) { bindings.push(`%${query}%`); const parameter = `$${bindings.length}`; conditions.push(`(c.code ILIKE ${parameter} OR c.name ILIKE ${parameter} OR c.batch ILIKE ${parameter} OR c.area ILIKE ${parameter})`); }
    bindings.push(limit);
    const rows = await database().many(`SELECT ${COMPONENT_COLUMNS} FROM components c WHERE ${conditions.join(' AND ')} ORDER BY c.updated_at DESC LIMIT $${bindings.length}`, bindings);
    return jsonOk(rows);
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const body = (await request.json()) as Record<string, unknown>;
    const projectId = cleanText(body.projectId, 80);
    const code = cleanText(body.code, 60).toUpperCase();
    const name = cleanText(body.name, 120);
    const type = cleanText(body.type, 60);
    if (!projectId || !code || !name || !type) throw new HttpError(400, '项目、构件编码、名称和类型不能为空');
    await requireProjectAccess(actor, projectId, 'admin');
    const project = await database().one<{ id: string; status: string }>(`SELECT id, status FROM projects WHERE id = $1`, [projectId]);
    if (!project) throw new HttpError(404, '所属项目不存在');
    if (project.status !== 'ACTIVE') throw new HttpError(409, '项目已归档，不能新增构件');
    const id = makeId('component');
    const now = new Date().toISOString();
    const record = {
      id, projectId, code, name, type,
      specification: cleanText(body.specification, 100), material: cleanText(body.material, 100),
      batch: cleanText(body.batch, 80), building: cleanText(body.building, 80), floor: cleanText(body.floor, 40),
      area: cleanText(body.area, 100), currentStatus: 'UNRECORDED' as const, version: 1,
      qrToken: makeQrToken(), modelFileName: null, modelSize: null,
      notes: cleanText(body.notes, 1000), createdAt: now, updatedAt: now, updatedBy: actor.displayName,
    };
    try {
      await database().transaction(async (tx) => {
        await tx.execute(`INSERT INTO components (id, project_id, code, name, type, specification, material, batch, building, floor, area, current_status, version, qr_token, notes, created_at, updated_at, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'UNRECORDED', 1, $12, $13, $14, $15, $16)`, [id, projectId, code, name, type, record.specification, record.material, record.batch, record.building, record.floor, record.area, record.qrToken, record.notes, now, now, actor.displayName]);
        await writeAudit(tx, request, actor, 'COMPONENT_CREATED', 'component', id, projectId, null, record);
      });
    } catch (error) {
      if (isConstraintError(error)) throw new HttpError(409, `构件编码 ${code} 已存在`);
      throw error;
    }
    return jsonOk(record, { status: 201 });
  } catch (error) { return jsonError(error); }
}
