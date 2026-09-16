import { cleanText, database, jsonError, jsonOk, requireActor, requireProjectAccess } from '@/lib/server';

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const projectId = cleanText(url.searchParams.get('projectId'), 80);
    if (projectId) await requireProjectAccess(actor, projectId, 'read');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 300);
    const query = projectId
      ? database().prepare(`SELECT id, actor_name AS actorName, action, target_type AS targetType, target_id AS targetId, before_json AS beforeJson, after_json AS afterJson, ip, created_at AS createdAt FROM audit_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`).bind(projectId, limit)
      : database().prepare(`SELECT id, actor_name AS actorName, action, target_type AS targetType, target_id AS targetId, before_json AS beforeJson, after_json AS afterJson, ip, created_at AS createdAt FROM audit_logs ORDER BY created_at DESC LIMIT ?`).bind(limit);
    const result = await query.all();
    return jsonOk(result.results);
  } catch (error) { return jsonError(error); }
}
