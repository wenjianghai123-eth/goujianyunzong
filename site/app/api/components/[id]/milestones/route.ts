import { writeAudit } from '@/lib/repository';
import { cleanText, database, HttpError, jsonError, jsonOk, makeId, requireActor, requireProjectAccess } from '@/lib/server';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id: componentId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const type = cleanText(body.type, 20);
    if (!['FACTORY_EXIT', 'SITE_ENTRY'].includes(type)) throw new HttpError(400, '无效的里程碑类型');
    const component = await database().one<{ projectId: string }>(`SELECT project_id AS "projectId" FROM components WHERE id = $1 AND disabled_at IS NULL`, [componentId]);
    if (!component) throw new HttpError(404, '未找到该构件');
    const membership = await requireProjectAccess(actor, component.projectId, 'write');
    if (type === 'FACTORY_EXIT' && !['PROJECT_ADMIN', 'FACTORY_OPERATOR'].includes(membership.role)) {
      throw new HttpError(403, '当前角色不能登记出厂里程碑');
    }
    if (type === 'SITE_ENTRY' && !['PROJECT_ADMIN', 'SITE_OPERATOR'].includes(membership.role)) {
      throw new HttpError(403, '当前角色不能登记进场里程碑');
    }
    const actualAt = new Date(cleanText(body.actualAt, 40) || Date.now());
    if (Number.isNaN(actualAt.getTime()) || actualAt.getTime() > Date.now() + 60_000) throw new HttpError(400, '实际发生时间无效');
    const id = makeId('milestone');
    const record = { id, componentId, type, actualAt: actualAt.toISOString(), operatorName: actor.displayName, vehicleNo: cleanText(body.vehicleNo, 60), receiver: cleanText(body.receiver, 80), location: cleanText(body.location, 120), remark: cleanText(body.remark, 1000), createdAt: new Date().toISOString() };
    await database().transaction(async (tx) => {
      await tx.execute(`INSERT INTO milestones (id, component_id, type, actual_at, operator_id, operator_name, vehicle_no, receiver, location, remark, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [id, componentId, type, record.actualAt, actor.userId, actor.displayName, record.vehicleNo, record.receiver, record.location, record.remark, record.createdAt]);
      await writeAudit(tx, request, actor, 'MILESTONE_CREATED', 'component', componentId, component.projectId, null, record);
    });
    return jsonOk(record, { status: 201 });
  } catch (error) { return jsonError(error); }
}
