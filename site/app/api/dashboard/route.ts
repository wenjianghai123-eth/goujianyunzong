import { database, HttpError, jsonError, jsonOk, requireActor, requireProjectAccess } from '@/lib/server';

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const projectId = new URL(request.url).searchParams.get('projectId');
    if (!projectId) throw new HttpError(400, '缺少项目参数');
    await requireProjectAccess(actor, projectId, 'read');
    const db = database();
    const [summary, recent] = await Promise.all([
      db.one(`SELECT COUNT(*)::integer AS total, COUNT(*) FILTER (WHERE current_status = 'UNRECORDED')::integer AS unrecorded, COUNT(*) FILTER (WHERE current_status = 'PROCESSING')::integer AS processing, COUNT(*) FILTER (WHERE current_status = 'ONSITE')::integer AS onsite, COUNT(*) FILTER (WHERE current_status = 'COMPLETED')::integer AS completed FROM components WHERE project_id = $1 AND disabled_at IS NULL`, [projectId]),
      db.many(`SELECT pr.id, pr.component_id AS "componentId", c.code AS "componentCode", c.name AS "componentName", pr.from_status AS "fromStatus", pr.to_status AS "toStatus", pr.operator_name AS "operatorName", pr.submitted_at AS "submittedAt", pr.remark FROM progress_records pr JOIN components c ON c.id = pr.component_id WHERE c.project_id = $1 ORDER BY pr.submitted_at DESC LIMIT 100`, [projectId]),
    ]);
    return jsonOk({ summary: summary ?? { total: 0, unrecorded: 0, processing: 0, onsite: 0, completed: 0 }, recent });
  } catch (error) { return jsonError(error); }
}
