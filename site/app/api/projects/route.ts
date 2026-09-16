import { cleanText, database, HttpError, jsonError, jsonOk, makeId, requireActor } from '@/lib/server';
import { auditStatement, isConstraintError } from '@/lib/repository';

export async function GET() {
  try {
    const actor = await requireActor();
    const result = await database().prepare(`
      SELECT p.id, p.code, p.name, p.address, p.owner, p.status,
        p.require_onsite_photo AS requireOnsitePhoto,
        p.require_complete_photo AS requireCompletePhoto,
        p.created_at AS createdAt, p.updated_at AS updatedAt,
        pm.role AS currentUserRole
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = ?
      ORDER BY p.updated_at DESC
    `).bind(actor.userId).all();
    return jsonOk(result.results);
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const body = await request.json<Record<string, unknown>>();
    const code = cleanText(body.code, 40).toUpperCase();
    const name = cleanText(body.name, 100);
    if (!code || !name) throw new HttpError(400, '项目编码和项目名称不能为空');
    const id = makeId('project');
    const now = new Date().toISOString();
    const record = { id, code, name, address: cleanText(body.address, 200), owner: cleanText(body.owner, 80), status: 'ACTIVE', requireOnsitePhoto: true, requireCompletePhoto: true, createdAt: now, updatedAt: now };
    try {
      await database().batch([
        database().prepare(`INSERT INTO projects (id, code, name, address, owner, status, require_onsite_photo, require_complete_photo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, 1, ?, ?)`).bind(id, code, name, record.address, record.owner, now, now),
        database().prepare(`INSERT INTO project_members (id, project_id, user_id, email, display_name, role, created_at) VALUES (?, ?, ?, ?, ?, 'PROJECT_ADMIN', ?)`).bind(makeId('member'), id, actor.userId, actor.email, actor.displayName, now),
        auditStatement(request, actor, 'PROJECT_CREATED', 'project', id, id, null, record),
      ]);
    } catch (error) {
      if (isConstraintError(error)) throw new HttpError(409, '项目编码已存在');
      throw error;
    }
    return jsonOk(record, { status: 201 });
  } catch (error) { return jsonError(error); }
}
