import type { ComponentStatus } from './domain';
import { makeComponentCode } from './entry-groups';
import { database, HttpError } from './server';

export type EntryGroupRow = {
  id: string;
  projectId: string;
  projectName: string;
  projectStatus: string;
  typeCode: string;
  typeName: string;
  locationCode: string;
  locationName: string;
  building: string;
  floor: string;
  area: string;
  specification: string;
  material: string;
  serialWidth: number;
  qrToken: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type SequencePreviewItem = {
  sequenceNo: number;
  code: string;
  componentId: string | null;
  currentStatus: ComponentStatus | null;
  version: number | null;
  action: 'CREATE' | 'UPDATE' | 'SKIP';
};

const ENTRY_GROUP_SELECT = `
  g.id, g.project_id AS "projectId", p.name AS "projectName",
  p.status AS "projectStatus", g.type_code AS "typeCode", g.type_name AS "typeName",
  g.location_code AS "locationCode", g.location_name AS "locationName",
  g.building, g.floor, g.area, g.specification, g.material,
  g.serial_width AS "serialWidth", g.qr_token AS "qrToken", g.status,
  g.created_at AS "createdAt", g.updated_at AS "updatedAt",
  g.created_by AS "createdBy"
`;

export async function getEntryGroup(id: string) {
  const group = await database().one<EntryGroupRow>(
    `SELECT ${ENTRY_GROUP_SELECT} FROM component_entry_groups g JOIN projects p ON p.id = g.project_id WHERE g.id = $1`,
    [id],
  );
  if (!group) throw new HttpError(404, '未找到该批次进场二维码');
  return group;
}

export async function getEntryGroupByToken(token: string) {
  const group = await database().one<EntryGroupRow>(
    `SELECT ${ENTRY_GROUP_SELECT} FROM component_entry_groups g JOIN projects p ON p.id = g.project_id WHERE g.qr_token = $1`,
    [token],
  );
  if (!group) throw new HttpError(404, '二维码无效或已失效');
  return group;
}

export async function buildSequencePreview(
  group: EntryGroupRow,
  sequences: number[],
) {
  const codes = sequences.map((sequence) =>
    makeComponentCode(group.typeCode, group.locationCode, sequence, group.serialWidth),
  );
  const rows = await database().many<{
    id: string;
    code: string;
    entryGroupId: string | null;
    sequenceNo: number | null;
    currentStatus: ComponentStatus;
    version: number;
    disabledAt: string | null;
  }>(
      `SELECT id, code, entry_group_id AS "entryGroupId", sequence_no AS "sequenceNo",
        current_status AS "currentStatus", version, disabled_at AS "disabledAt"
      FROM components
      WHERE project_id = $1 AND (
        code = ANY($2::text[])
        OR (entry_group_id = $3 AND sequence_no = ANY($4::integer[]))
      )`,
    [group.projectId, codes, group.id, sequences],
  );

  return sequences.map<SequencePreviewItem>((sequenceNo, index) => {
    const code = codes[index];
    const matches = rows.filter(
      (row) =>
        row.code === code ||
        (row.entryGroupId === group.id && row.sequenceNo === sequenceNo),
    );
    const uniqueMatches = [...new Map(matches.map((row) => [row.id, row])).values()];
    if (uniqueMatches.length > 1) {
      throw new HttpError(409, `编号 ${sequenceNo} 同时匹配多个构件，请联系管理员整理数据`);
    }
    const existing = uniqueMatches[0];
    if (!existing) {
      return {
        sequenceNo,
        code,
        componentId: null,
        currentStatus: null,
        version: null,
        action: 'CREATE',
      };
    }
    if (existing.disabledAt) {
      throw new HttpError(409, `构件编码 ${code} 已被停用记录占用`);
    }
    if (existing.entryGroupId && existing.entryGroupId !== group.id) {
      throw new HttpError(409, `构件编码 ${code} 已属于其他进场二维码`);
    }
    const action = ['ONSITE', 'COMPLETED'].includes(existing.currentStatus)
      ? 'SKIP'
      : 'UPDATE';
    return {
      sequenceNo,
      code: existing.code,
      componentId: existing.id,
      currentStatus: existing.currentStatus,
      version: existing.version,
      action,
    };
  });
}
