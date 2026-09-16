import { database, HttpError, jsonError, jsonOk, requireActor, requireProjectAccess } from '@/lib/server';

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const projectId = new URL(request.url).searchParams.get('projectId');
    if (!projectId) throw new HttpError(400, '缺少项目参数');
    await requireProjectAccess(actor, projectId, 'read');
    const db = database();
    const [summary, recent] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN current_status = 'UNRECORDED' THEN 1 ELSE 0 END) AS unrecorded, SUM(CASE WHEN current_status = 'PROCESSING' THEN 1 ELSE 0 END) AS processing, SUM(CASE WHEN current_status = 'ONSITE' THEN 1 ELSE 0 END) AS onsite, SUM(CASE WHEN current_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed FROM components WHERE project_id = ? AND disabled_at IS NULL`).bind(projectId).first(),
      db.prepare(`SELECT pr.id, pr.component_id AS componentId, c.code AS componentCode, c.name AS componentName, pr.from_status AS fromStatus, pr.to_status AS toStatus, pr.operator_name AS operatorName, pr.submitted_at AS submittedAt, pr.remark FROM progress_records pr JOIN components c ON c.id = pr.component_id WHERE c.project_id = ? ORDER BY pr.submitted_at DESC LIMIT 100`).bind(projectId).all(),
    ]);
    return jsonOk({ summary: summary ?? { total: 0, unrecorded: 0, processing: 0, onsite: 0, completed: 0 }, recent: recent.results });
  } catch (error) { return jsonError(error); }
}
