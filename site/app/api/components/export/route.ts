import { cleanText, database, HttpError, jsonError, requireActor, requireProjectAccess } from '@/lib/server';

function csvCell(value: unknown) {
  const text = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const projectId = cleanText(new URL(request.url).searchParams.get('projectId'), 80);
    if (!projectId) throw new HttpError(400, '缺少项目参数');
    await requireProjectAccess(actor, projectId, 'read');
    const rows = await database().many<Record<string, unknown>>(`SELECT code, name, type, specification, material, batch, building, floor, area, current_status AS status, updated_at AS "updatedAt", updated_by AS "updatedBy" FROM components WHERE project_id = $1 AND disabled_at IS NULL ORDER BY code`, [projectId]);
    const headers = ['构件编码', '构件名称', '构件类型', '规格型号', '材质', '批次', '楼栋', '楼层', '区域轴线', '当前进度', '更新时间', '更新人'];
    const keys = ['code', 'name', 'type', 'specification', 'material', 'batch', 'building', 'floor', 'area', 'status', 'updatedAt', 'updatedBy'];
    const csv = `\uFEFF${headers.map(csvCell).join(',')}\r\n${rows.map((row) => keys.map((key) => csvCell(row[key])).join(',')).join('\r\n')}`;
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`构件台账-${new Date().toISOString().slice(0, 10)}.csv`)}`, 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
