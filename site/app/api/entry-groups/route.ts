import { normalizeCodeSegment, normalizeSerialWidth } from '@/lib/entry-groups';
import { isConstraintError, writeAudit } from '@/lib/repository';
import {
  cleanText,
  database,
  HttpError,
  jsonError,
  jsonOk,
  makeId,
  makeQrToken,
  requireActor,
  requireProjectAccess,
} from '@/lib/server';

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const projectId = cleanText(new URL(request.url).searchParams.get('projectId'), 80);
    if (!projectId) throw new HttpError(400, '缺少项目参数');
    await requireProjectAccess(actor, projectId, 'read');
    const rows = await database().many(
        `SELECT g.id, g.project_id AS "projectId", g.type_code AS "typeCode",
          g.type_name AS "typeName", g.location_code AS "locationCode",
          g.location_name AS "locationName", g.building, g.floor, g.area,
          g.specification, g.material, g.serial_width AS "serialWidth",
          g.qr_token AS "qrToken", g.status, g.created_at AS "createdAt",
          g.updated_at AS "updatedAt", g.created_by AS "createdBy",
          COUNT(c.id)::integer AS "componentCount",
          COUNT(c.id) FILTER (WHERE c.current_status IN ('ONSITE', 'COMPLETED'))::integer AS "onsiteCount"
        FROM component_entry_groups g
        LEFT JOIN components c ON c.entry_group_id = g.id AND c.disabled_at IS NULL
        WHERE g.project_id = $1 AND g.status = 'ACTIVE'
        GROUP BY g.id
        ORDER BY g.updated_at DESC`,
      [projectId],
    );
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const body = (await request.json()) as Record<string, unknown>;
    const projectId = cleanText(body.projectId, 80);
    if (!projectId) throw new HttpError(400, '缺少项目参数');
    await requireProjectAccess(actor, projectId, 'admin');
    const project = await database().one<{ status: string }>(`SELECT status FROM projects WHERE id = $1`, [projectId]);
    if (!project) throw new HttpError(404, '项目不存在');
    if (project.status !== 'ACTIVE') throw new HttpError(409, '项目已归档，不能创建进场二维码');

    const typeCode = normalizeCodeSegment(body.typeCode, '构件类型编码');
    const locationCode = normalizeCodeSegment(body.locationCode, '构件位置编码');
    const typeName = cleanText(body.typeName, 60);
    const locationName = cleanText(body.locationName, 100);
    if (!typeName || !locationName) throw new HttpError(400, '构件类型名称和位置名称不能为空');
    const serialWidth = normalizeSerialWidth(body.serialWidth ?? 3);
    const id = makeId('entry_group');
    const now = new Date().toISOString();
    const record = {
      id,
      projectId,
      typeCode,
      typeName,
      locationCode,
      locationName,
      building: cleanText(body.building, 80),
      floor: cleanText(body.floor, 40),
      area: cleanText(body.area, 100),
      specification: cleanText(body.specification, 100),
      material: cleanText(body.material, 100),
      serialWidth,
      qrToken: makeQrToken(),
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      createdBy: actor.displayName,
      componentCount: 0,
      onsiteCount: 0,
    };
    try {
      await database().transaction(async (tx) => {
        await tx.execute(
            `INSERT INTO component_entry_groups (
              id, project_id, type_code, type_name, location_code, location_name,
              building, floor, area, specification, material, serial_width,
              qr_token, status, created_at, updated_at, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'ACTIVE', $14, $15, $16)`,
          [
            id,
            projectId,
            typeCode,
            typeName,
            locationCode,
            locationName,
            record.building,
            record.floor,
            record.area,
            record.specification,
            record.material,
            serialWidth,
            record.qrToken,
            now,
            now,
            actor.displayName,
          ],
        );
        await writeAudit(tx, request, actor, 'ENTRY_GROUP_CREATED', 'entry_group', id, projectId, null, record);
      });
    } catch (error) {
      if (isConstraintError(error)) {
        throw new HttpError(409, `${typeCode}-${locationCode} 的进场二维码已存在`);
      }
      throw error;
    }
    return jsonOk(record, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
