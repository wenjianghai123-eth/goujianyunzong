import type { Actor } from './server';
import { database, HttpError, makeId, requestMeta } from './server';

export const COMPONENT_COLUMNS = `
  c.id, c.project_id AS projectId, c.code, c.name, c.type,
  c.specification, c.material, c.batch, c.building, c.floor, c.area,
  c.entry_group_id AS entryGroupId, c.sequence_no AS sequenceNo,
  c.current_status AS currentStatus, c.version, c.qr_token AS qrToken,
  c.model_file_name AS modelFileName, c.model_size AS modelSize,
  c.notes, c.created_at AS createdAt, c.updated_at AS updatedAt,
  c.updated_by AS updatedBy
`;

export async function getComponent(id: string) {
  const row = await database()
    .prepare(`SELECT ${COMPONENT_COLUMNS}, p.name AS projectName FROM components c JOIN projects p ON p.id = c.project_id WHERE c.id = ? AND c.disabled_at IS NULL`)
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) throw new HttpError(404, '未找到该构件');
  return row;
}

export function auditStatement(
  request: Request,
  actor: Actor,
  action: string,
  targetType: string,
  targetId: string,
  projectId: string | null,
  before: unknown,
  after: unknown,
) {
  const meta = requestMeta(request);
  return database()
    .prepare(`INSERT INTO audit_logs (id, actor_id, actor_name, project_id, action, target_type, target_id, before_json, after_json, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      makeId('audit'), actor.userId, actor.displayName, projectId, action,
      targetType, targetId, before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after), meta.ip, meta.userAgent,
      new Date().toISOString(),
    );
}

export function isConstraintError(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}
