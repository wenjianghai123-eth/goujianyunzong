import { cleanText, database, HttpError, jsonError, jsonOk, makeId, requireActor } from '@/lib/server';
import { isConstraintError, writeAudit } from '@/lib/repository';

export async function GET() {
  try {
    const actor = await requireActor();
    const rows = await database().many(`
      SELECT p.id, p.code, p.name, p.address, p.owner, p.status,
        p.require_onsite_photo AS "requireOnsitePhoto",
        p.require_complete_photo AS "requireCompletePhoto",
        p.created_at AS "createdAt", p.updated_at AS "updatedAt",
        pm.role AS "currentUserRole"
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = $1
      ORDER BY p.updated_at DESC
    `, [actor.userId]);
    return jsonOk(rows);
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const body = (await request.json()) as Record<string, unknown>;
    const code = cleanText(body.code, 40).toUpperCase();
    const name = cleanText(body.name, 100);
    if (!code || !name) throw new HttpError(400, '项目编码和项目名称不能为空');
    const id = makeId('project');
    const now = new Date().toISOString();
    const record = { id, code, name, address: cleanText(body.address, 200), owner: cleanText(body.owner, 80), status: 'ACTIVE', requireOnsitePhoto: true, requireCompletePhoto: true, createdAt: now, updatedAt: now };
    try {
      await database().transaction(async (tx) => {
        await tx.execute(`INSERT INTO projects (id, code, name, address, owner, status, require_onsite_photo, require_complete_photo, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', true, true, $6, $7)`, [id, code, name, record.address, record.owner, now, now]);
        await tx.execute(`INSERT INTO project_members (id, project_id, user_id, email, display_name, role, created_at) VALUES ($1, $2, $3, $4, $5, 'PROJECT_ADMIN', $6)`, [makeId('member'), id, actor.userId, actor.email, actor.displayName, now]);
        await writeAudit(tx, request, actor, 'PROJECT_CREATED', 'project', id, id, null, record);
      });
    } catch (error) {
      if (isConstraintError(error)) throw new HttpError(409, '项目编码已存在');
      throw error;
    }
    return jsonOk(record, { status: 201 });
  } catch (error) { return jsonError(error); }
}
