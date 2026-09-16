import {
  cleanText,
  database,
  HttpError,
  jsonError,
  jsonOk,
  makeId,
  requireActor,
  requireProjectAccess,
} from '@/lib/server';
import { auditStatement } from '@/lib/repository';

type Context = { params: Promise<{ id: string }> };
const ROLES = new Set([
  'PROJECT_ADMIN',
  'FACTORY_OPERATOR',
  'SITE_OPERATOR',
  'VIEWER',
  'AUDITOR',
]);

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    await requireProjectAccess(actor, id, 'read');
    const rows = await database()
      .prepare(
        `SELECT id, user_id AS userId, email, display_name AS displayName, role, created_at AS createdAt FROM project_members WHERE project_id = ? ORDER BY created_at`,
      )
      .bind(id)
      .all();
    return jsonOk(rows.results);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id: projectId } = await context.params;
    await requireProjectAccess(actor, projectId, 'admin');
    const body = await request.json<Record<string, unknown>>();
    const userId = cleanText(body.userId, 120);
    let email = cleanText(body.email, 160).toLowerCase();
    let displayName = cleanText(body.displayName, 100);
    const role = cleanText(body.role, 30);
    const weChatUser = userId.startsWith('wechat:')
      ? await database()
          .prepare(
            `SELECT display_name AS displayName FROM auth_users WHERE id = ?`,
          )
          .bind(userId)
          .first<{ displayName: string }>()
      : null;
    if (!userId || !ROLES.has(role) || (!email && !weChatUser))
      throw new HttpError(400, '请填写有效的成员 ID、角色和账号信息');
    if (weChatUser) {
      email = '';
      displayName ||= weChatUser.displayName;
    }
    displayName ||= email;
    const now = new Date().toISOString();
    const existing = await database()
      .prepare(
        `SELECT id, created_at AS createdAt, email, display_name AS displayName, role FROM project_members WHERE project_id = ? AND user_id = ?`,
      )
      .bind(projectId, userId)
      .first<{
        id: string;
        createdAt: string;
        email: string;
        displayName: string;
        role: string;
      }>();
    const memberId = existing?.id ?? makeId('member');
    await database().batch([
      database()
        .prepare(
          `INSERT INTO project_members (id, project_id, user_id, email, display_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(project_id, user_id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, role = excluded.role`,
        )
        .bind(memberId, projectId, userId, email, displayName, role, now),
      auditStatement(
        request,
        actor,
        existing ? 'PROJECT_MEMBER_UPDATED' : 'PROJECT_MEMBER_ADDED',
        'project_member',
        memberId,
        projectId,
        existing,
        { userId, email, displayName, role },
      ),
    ]);
    return jsonOk(
      {
        id: memberId,
        userId,
        email,
        displayName,
        role,
        createdAt: existing?.createdAt ?? now,
      },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
