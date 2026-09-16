import {
  authDatabase,
  hashToken,
  randomToken,
  safeReturnPath,
  sessionCookie,
  SESSION_MAX_AGE_SECONDS,
  weChatRuntime,
} from '@/lib/app-auth';

type TokenResponse = {
  access_token?: string;
  openid?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

type ProfileResponse = {
  openid?: string;
  unionid?: string;
  nickname?: string;
  headimgurl?: string;
  errcode?: number;
  errmsg?: string;
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  if (!state) return loginError(requestUrl, 'invalid_state');

  const consumed = await authDatabase()
    .prepare(
      `DELETE FROM oauth_states WHERE id = ? AND expires_at > ? RETURNING return_to AS returnTo`,
    )
    .bind(state, new Date().toISOString())
    .first<{ returnTo: string }>();
  if (!consumed) return loginError(requestUrl, 'invalid_state');
  if (!code)
    return loginError(requestUrl, 'wechat_cancelled', consumed.returnTo);

  const runtime = weChatRuntime();
  if (!runtime.WECHAT_APP_ID || !runtime.WECHAT_APP_SECRET)
    return loginError(requestUrl, 'wechat_not_configured', consumed.returnTo);

  try {
    const tokenUrl = new URL(
      'https://api.weixin.qq.com/sns/oauth2/access_token',
    );
    tokenUrl.search = new URLSearchParams({
      appid: runtime.WECHAT_APP_ID,
      secret: runtime.WECHAT_APP_SECRET,
      code,
      grant_type: 'authorization_code',
    }).toString();
    const token = await fetchJson<TokenResponse>(tokenUrl);
    if (!token.access_token || !token.openid || token.errcode)
      throw new Error(token.errmsg || '微信授权码交换失败');

    const profileUrl = new URL('https://api.weixin.qq.com/sns/userinfo');
    profileUrl.search = new URLSearchParams({
      access_token: token.access_token,
      openid: token.openid,
      lang: 'zh_CN',
    }).toString();
    const profile = await fetchJson<ProfileResponse>(profileUrl);
    if (profile.errcode)
      throw new Error(profile.errmsg || '微信用户信息读取失败');

    const openid = token.openid;
    const unionid = profile.unionid || token.unionid || null;
    const displayName = String(profile.nickname || '微信用户').slice(0, 100);
    const avatarUrl = String(profile.headimgurl || '').slice(0, 500);
    const now = new Date();
    const newUserId = `wechat:${unionid || openid}`;
    await authDatabase()
      .prepare(`
      INSERT INTO auth_users (id, wechat_openid, wechat_unionid, display_name, avatar_url, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(wechat_openid) DO UPDATE SET
        wechat_unionid = excluded.wechat_unionid,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        last_login_at = excluded.last_login_at
    `)
      .bind(
        newUserId,
        openid,
        unionid,
        displayName,
        avatarUrl,
        now.toISOString(),
        now.toISOString(),
      )
      .run();
    const user = await authDatabase()
      .prepare(`SELECT id FROM auth_users WHERE wechat_openid = ?`)
      .bind(openid)
      .first<{ id: string }>();
    if (!user) throw new Error('微信账号写入失败');

    const rawSession = randomToken();
    const sessionId = await hashToken(rawSession);
    const expiresAt = new Date(
      now.getTime() + SESSION_MAX_AGE_SECONDS * 1000,
    ).toISOString();
    await authDatabase().batch([
      authDatabase()
        .prepare(`DELETE FROM auth_sessions WHERE expires_at <= ?`)
        .bind(now.toISOString()),
      authDatabase()
        .prepare(
          `INSERT INTO auth_sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
        )
        .bind(sessionId, user.id, now.toISOString(), expiresAt),
    ]);
    return new Response(null, {
      status: 302,
      headers: {
        Location: safeReturnPath(consumed.returnTo),
        'Set-Cookie': sessionCookie(rawSession),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return loginError(requestUrl, 'wechat_api_error', consumed.returnTo);
  }
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`微信接口返回 ${response.status}`);
  return response.json() as Promise<T>;
}

function loginError(requestUrl: URL, code: string, returnTo = '/') {
  const target = new URL(safeReturnPath(returnTo), requestUrl.origin);
  target.searchParams.set('login_error', code);
  return Response.redirect(target, 302);
}
