import { isConstraintError, writeAudit } from '@/lib/repository';
import { cleanText, database, HttpError, jsonError, jsonOk, makeId, makeQrToken, requireActor, requireProjectAccess } from '@/lib/server';

type ImportRow = Record<string, unknown>;

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const body = (await request.json()) as {
      projectId?: unknown;
      rows?: unknown;
    };
    const projectId = cleanText(body.projectId, 80);
    if (!projectId) throw new HttpError(400, '缺少项目参数');
    await requireProjectAccess(actor, projectId, 'admin');
    if (!Array.isArray(body.rows) || body.rows.length === 0) throw new HttpError(400, '导入文件中没有构件数据');
    if (body.rows.length > 500) throw new HttpError(400, '单次最多导入 500 个构件');
    const project = await database().one<{ id: string; status: string }>(`SELECT id, status FROM projects WHERE id = $1`, [projectId]);
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
    const existing = await database().many<{ code: string }>(`SELECT code FROM components WHERE project_id = $1 AND code = ANY($2::text[])`, [projectId, normalized.map((row) => row.code)]);
    if (existing.length) throw new HttpError(409, `以下构件编码已存在：${existing.map((row) => row.code).join('、')}`);

    const now = new Date().toISOString();
    const createdIds: string[] = [];
    try {
      await database().transaction(async (tx) => {
        for (const row of normalized) {
          const id = makeId('component');
          createdIds.push(id);
          await tx.execute(`INSERT INTO components (id, project_id, code, name, type, specification, material, batch, building, floor, area, current_status, version, qr_token, notes, created_at, updated_at, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'UNRECORDED', 1, $12, $13, $14, $15, $16)`, [id, projectId, row.code, row.name, row.type, row.specification, row.material, row.batch, row.building, row.floor, row.area, makeQrToken(), row.notes, now, now, actor.displayName]);
        }
        await writeAudit(tx, request, actor, 'COMPONENTS_IMPORTED', 'project', projectId, projectId, null, { count: normalized.length, ids: createdIds });
      });
    } catch (error) {
      if (isConstraintError(error)) throw new HttpError(409, '导入过程中发现重复构件编码');
      throw error;
    }
    return jsonOk({ imported: normalized.length, ids: createdIds }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
