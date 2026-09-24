import { cleanText, database, jsonError, jsonOk, requireActor, requireProjectAccess } from '@/lib/server';

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const projectId = cleanText(url.searchParams.get('projectId'), 80);
    if (projectId) await requireProjectAccess(actor, projectId, 'read');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 300);
    const rows = projectId
      ? await database().many(
          `SELECT id, actor_name AS "actorName", action, target_type AS "targetType", target_id AS "targetId", before_json AS "beforeJson", after_json AS "afterJson", ip, created_at AS "createdAt" FROM audit_logs WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [projectId, limit],
        )
      : await database().many(
          `SELECT id, actor_name AS "actorName", action, target_type AS "targetType", target_id AS "targetId", before_json AS "beforeJson", after_json AS "afterJson", ip, created_at AS "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
          [limit],
        );
    return jsonOk(rows);
  } catch (error) { return jsonError(error); }
}
