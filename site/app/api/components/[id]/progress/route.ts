import type { ComponentStatus } from '@/lib/domain';
import { NEXT_STATUS, STATUSES } from '@/lib/domain';
import { isConstraintError, writeAudit } from '@/lib/repository';
import {
  cleanText,
  database,
  HttpError,
  jsonError,
  jsonOk,
  makeId,
  requireActor,
  requireProjectAccess,
} from '@/lib/server';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const toStatus = cleanText(body.toStatus, 30) as ComponentStatus;
    if (!STATUSES.includes(toStatus)) {
      throw new HttpError(400, '无效的目标进度');
    }

    const component = await database().one<{
        id: string;
        projectId: string;
        currentStatus: ComponentStatus;
        version: number;
        requireOnsitePhoto: boolean;
        requireCompletePhoto: boolean;
        projectStatus: string;
      }>(`
        SELECT c.id, c.project_id AS "projectId",
          c.current_status AS "currentStatus", c.version,
          p.require_onsite_photo AS "requireOnsitePhoto",
          p.require_complete_photo AS "requireCompletePhoto",
          p.status AS "projectStatus"
        FROM components c
        JOIN projects p ON p.id = c.project_id
        WHERE c.id = $1 AND c.disabled_at IS NULL
      `, [id]);

    if (!component) throw new HttpError(404, '未找到该构件');
    const membership = await requireProjectAccess(actor, component.projectId, 'write');
    if (component.projectStatus !== 'ACTIVE') {
      throw new HttpError(409, '项目已归档，不能更新进度');
    }

    const idempotencyKey = cleanText(body.idempotencyKey, 100);
    if (!idempotencyKey) throw new HttpError(400, '缺少防重复提交标识');
    const duplicate = await database().one<{ id: string; toStatus: ComponentStatus }>(
      `SELECT id, to_status AS "toStatus" FROM progress_records WHERE component_id = $1 AND idempotency_key = $2`,
      [id, idempotencyKey],
    );
    if (duplicate) {
      return jsonOk({ id: duplicate.id, duplicate: true, currentStatus: duplicate.toStatus });
    }

    const expectedVersion = Number(body.componentVersion);
    if (expectedVersion !== component.version) {
      throw new HttpError(409, '该构件已被其他人更新，请刷新后重试');
    }
    if (NEXT_STATUS[component.currentStatus] !== toStatus) {
      throw new HttpError(409, '当前状态不允许执行该进度流转');
    }
    if (membership.role === 'FACTORY_OPERATOR' && toStatus !== 'PROCESSING') {
      throw new HttpError(403, '工厂录入员只能登记“加工中”进度');
    }
    if (membership.role === 'SITE_OPERATOR' && toStatus === 'PROCESSING') {
      throw new HttpError(403, '现场录入员不能登记工厂加工进度');
    }

    const photoIds = Array.isArray(body.photoIds)
      ? body.photoIds.filter((item): item is string => typeof item === 'string').slice(0, 9)
      : [];
    const requiresPhoto =
      (toStatus === 'ONSITE' && component.requireOnsitePhoto) ||
      (toStatus === 'COMPLETED' && component.requireCompletePhoto);
    if (requiresPhoto && photoIds.length === 0) {
      throw new HttpError(400, '该进度至少需要上传 1 张现场照片');
    }

    const actualAt = cleanText(body.actualAt, 40) || new Date().toISOString();
    const actualDate = new Date(actualAt);
    if (Number.isNaN(actualDate.getTime()) || actualDate.getTime() > Date.now() + 60_000) {
      throw new HttpError(400, '实际发生时间无效');
    }
    const recordId = makeId('progress');
    const now = new Date().toISOString();
    const remark = cleanText(body.remark, 1000);
    try {
      await database().transaction(async (tx) => {
        const changed = await tx.execute(
          `UPDATE components SET current_status = $1, version = version + 1, updated_at = $2, updated_by = $3 WHERE id = $4 AND version = $5`,
          [toStatus, now, actor.displayName, id, component.version],
        );
        if (!changed) {
          throw new HttpError(409, '该构件已被其他人更新，请刷新后重试');
        }
        await tx.execute(
          `INSERT INTO progress_records (id, component_id, from_status, to_status, actual_at, submitted_at, operator_id, operator_name, operator_email, remark, idempotency_key, event_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PROGRESS')`,
          [recordId, id, component.currentStatus, toStatus, actualDate.toISOString(), now, actor.userId, actor.displayName, actor.email, remark, idempotencyKey],
        );
        await writeAudit(
          tx,
          request,
          actor,
          'PROGRESS_UPDATED',
          'component',
          id,
          component.projectId,
          { status: component.currentStatus, version: component.version },
          { status: toStatus, version: component.version + 1, recordId },
        );
        for (const photoId of photoIds) {
          await tx.execute(
            `UPDATE photos SET progress_record_id = $1 WHERE id = $2 AND component_id = $3 AND progress_record_id IS NULL`,
            [recordId, photoId, id],
          );
        }
      });
    } catch (error) {
      if (isConstraintError(error)) {
        const existing = await database().one<{ id: string; toStatus: ComponentStatus }>(
          `SELECT id, to_status AS "toStatus" FROM progress_records WHERE component_id = $1 AND idempotency_key = $2`,
          [id, idempotencyKey],
        );
        if (existing) {
          return jsonOk({ id: existing.id, duplicate: true, currentStatus: existing.toStatus });
        }
      }
      throw error;
    }
    return jsonOk({
      id: recordId,
      currentStatus: toStatus,
      version: component.version + 1,
      submittedAt: now,
    });
  } catch (error) {
    return jsonError(error);
  }
}
