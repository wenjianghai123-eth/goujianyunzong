import type { ComponentStatus } from '@/lib/domain';
import { writeAudit } from '@/lib/repository';
import { cleanText, database, HttpError, jsonError, jsonOk, makeId, requireActor, requireProjectAccess } from '@/lib/server';

type Context = { params: Promise<{ id: string }> };
const PREVIOUS_STATUS: Partial<Record<ComponentStatus, ComponentStatus>> = {
  COMPLETED: 'ONSITE',
  ONSITE: 'PROCESSING',
  PROCESSING: 'UNRECORDED',
};

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const reason = cleanText(body.reason, 1000);
    if (!reason) throw new HttpError(400, '状态回退必须填写原因');
    const component = await database().one<{ projectId: string; currentStatus: ComponentStatus; version: number }>(`SELECT project_id AS "projectId", current_status AS "currentStatus", version FROM components WHERE id = $1 AND disabled_at IS NULL`, [id]);
    if (!component) throw new HttpError(404, '未找到该构件');
    await requireProjectAccess(actor, component.projectId, 'admin');
    const toStatus = PREVIOUS_STATUS[component.currentStatus];
    if (!toStatus) throw new HttpError(409, '当前状态不能继续回退');
    if (Number(body.componentVersion) !== component.version) throw new HttpError(409, '该构件已被其他人更新，请刷新后重试');
    const now = new Date().toISOString();
    const recordId = makeId('progress');
    await database().transaction(async (tx) => {
      const changed = await tx.execute(`UPDATE components SET current_status = $1, version = version + 1, updated_at = $2, updated_by = $3 WHERE id = $4 AND version = $5`, [toStatus, now, actor.displayName, id, component.version]);
      if (!changed) throw new HttpError(409, '该构件已被其他人更新，请刷新后重试');
      await tx.execute(`INSERT INTO progress_records (id, component_id, from_status, to_status, actual_at, submitted_at, operator_id, operator_name, operator_email, remark, idempotency_key, event_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ROLLBACK')`, [recordId, id, component.currentStatus, toStatus, now, now, actor.userId, actor.displayName, actor.email, reason, cleanText(body.idempotencyKey, 100) || crypto.randomUUID()]);
      await writeAudit(tx, request, actor, 'STATUS_ROLLED_BACK', 'component', id, component.projectId, { status: component.currentStatus, version: component.version }, { status: toStatus, version: component.version + 1, reason });
    });
    return jsonOk({ id: recordId, currentStatus: toStatus, version: component.version + 1 });
  } catch (error) { return jsonError(error); }
}
