import { database } from '@/db';
import { getCurrentUser } from '@/lib/app-auth';

export { database } from '@/db';

export type Actor = { userId: string; email: string; displayName: string };

export async function requireActor(): Promise<Actor> {
  const user = await getCurrentUser();
  if (user) return user;
  if (process.env.NODE_ENV !== 'production') {
    return {
      userId: 'local-admin',
      email: 'admin@local.test',
      displayName: '项目管理员',
    };
  }
  throw new HttpError(401, '请先登录后再操作');
}

export async function requireProjectAccess(
  actor: Actor,
  projectId: string,
  mode: 'read' | 'write' | 'admin' = 'read',
) {
  const membership = await database().one<{ role: string }>(
    `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, actor.userId],
  );
  if (!membership) throw new HttpError(403, '你没有该项目的访问权限');
  const writeRoles = new Set([
    'PROJECT_ADMIN',
    'FACTORY_OPERATOR',
    'SITE_OPERATOR',
  ]);
  if (mode === 'write' && !writeRoles.has(membership.role)) {
    throw new HttpError(403, '当前角色没有录入权限');
  }
  if (mode === 'admin' && membership.role !== 'PROJECT_ADMIN') {
    throw new HttpError(403, '仅项目管理员可执行该操作');
  }
  return membership;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return Response.json({ ok: true, data }, init);
}

export function jsonError(error: unknown) {
  const status = error instanceof HttpError ? error.status : 500;
  const message =
    error instanceof Error ? error.message : '系统暂时无法处理该请求';
  return Response.json(
    {
      ok: false,
      error: {
        code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message,
      },
    },
    { status },
  );
}

export function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}

export function makeQrToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

export function cleanText(value: unknown, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function requestMeta(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return {
    ip:
      forwardedFor?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '',
    userAgent: (request.headers.get('user-agent') ?? '').slice(0, 500),
  };
}
