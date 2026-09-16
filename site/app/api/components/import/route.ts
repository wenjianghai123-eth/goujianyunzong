import { auditStatement, isConstraintError } from '@/lib/repository';
import { cleanText, database, HttpError, jsonError, jsonOk, makeId, makeQrToken, requireActor, requireProjectAccess } from '@/lib/server';

type ImportRow = Record<string, unknown>;

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const body = await request.json<{ projectId?: unknown; rows?: unknown }>();
    const projectId = cleanText(body.projectId, 80);
    if (!projectId) throw new HttpError(400, '缺少项目参数');
    await requireProjectAccess(actor, projectId, 'admin');
    if (!Array.isArray(body.rows) || body.rows.length === 0) throw new HttpError(400, '导入文件中没有构件数据');
    if (body.rows.length > 500) throw new HttpError(400, '单次最多导入 500 个构件');
    const project = await database().prepare(`SELECT id, status FROM projects WHERE id = ?`).bind(projectId).first<{ id: string; status: string }>();
    if (!project) throw new HttpError(404, '所属项目不存在');
    if (project.status !== 'ACTIVE') throw new HttpError(409, '项目已归档，不能导入构件');

    const normalized = (body.rows as ImportRow[]).map((row, index) => ({
      row: index + 2,
      code: cleanText(row.code ?? row['构件编码'], 60).toUpperCase(),
      name: cleanText(row.name ?? row['构件名称'], 120),
      type: cleanText(row.type ?? row['构件类型'], 60),
      specification: cleanText(row.specification ?? row['规格型号'], 100),
      material: cleanText(row.material ?? row['材质'], 100),
      batch: cleanText(row.batch ?? row['批次'], 80),
      building: cleanText(row.building ?? row['楼栋'], 80),
      floor: cleanText(row.floor ?? row['楼层'], 40),
      area: cleanText(row.area ?? row['区域轴线'], 100),
      notes: cleanText(row.notes ?? row['备注'], 1000),
    }));
    const errors: Array<{ row: number; message: string }> = [];
    const seen = new Set<string>();
    for (const row of normalized) {
      if (!row.code || !row.name || !row.type) errors.push({ row: row.row, message: '构件编码、名称和类型不能为空' });
      else if (seen.has(row.code)) errors.push({ row: row.row, message: `文件内构件编码 ${row.code} 重复` });
      seen.add(row.code);
    }
    if (errors.length) return Response.json({ ok: false, error: { code: 'IMPORT_VALIDATION', message: '导入校验未通过', details: errors } }, { status: 400 });
    const placeholders = normalized.map(() => '?').join(',');
    const existing = await database().prepare(`SELECT code FROM components WHERE project_id = ? AND code IN (${placeholders})`).bind(projectId, ...normalized.map((row) => row.code)).all<{ code: string }>();
    if (existing.results.length) throw new HttpError(409, `以下构件编码已存在：${existing.results.map((row) => row.code).join('、')}`);

    const now = new Date().toISOString();
    const createdIds: string[] = [];
    try {
      for (let start = 0; start < normalized.length; start += 50) {
        const statements = normalized.slice(start, start + 50).map((row) => {
          const id = makeId('component');
          createdIds.push(id);
          return database().prepare(`INSERT INTO components (id, project_id, code, name, type, specification, material, batch, building, floor, area, current_status, version, qr_token, notes, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNRECORDED', 1, ?, ?, ?, ?, ?)`).bind(id, projectId, row.code, row.name, row.type, row.specification, row.material, row.batch, row.building, row.floor, row.area, makeQrToken(), row.notes, now, now, actor.displayName);
        });
        await database().batch(statements);
      }
      await auditStatement(request, actor, 'COMPONENTS_IMPORTED', 'project', projectId, projectId, null, { count: normalized.length, ids: createdIds }).run();
    } catch (error) {
      if (isConstraintError(error)) throw new HttpError(409, '导入过程中发现重复构件编码');
      throw error;
    }
    return jsonOk({ imported: normalized.length, ids: createdIds }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
