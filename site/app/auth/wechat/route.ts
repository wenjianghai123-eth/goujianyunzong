import {
  authDatabase,
  randomToken,
  safeReturnPath,
  weChatRuntime,
} from '@/lib/app-auth';

export async function GET(request: Request) {
  const runtime = weChatRuntime();
  if (!runtime.WECHAT_APP_ID || !runtime.WECHAT_APP_SECRET) {
    return Response.redirect(
      new URL('/?login_error=wechat_not_configured', request.url),
      302,
    );
  }

  const requestUrl = new URL(request.url);
  const returnTo = safeReturnPath(requestUrl.searchParams.get('return_to'));
  const state = randomToken(24);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
  await authDatabase().batch([
    authDatabase()
      .prepare(`DELETE FROM oauth_states WHERE expires_at <= ?`)
      .bind(now.toISOString()),
    authDatabase()
      .prepare(
        `INSERT INTO oauth_states (id, return_to, created_at, expires_at) VALUES (?, ?, ?, ?)`,
      )
      .bind(state, returnTo, now.toISOString(), expiresAt),
  ]);

  const callback =
    runtime.WECHAT_REDIRECT_URI || `${requestUrl.origin}/auth/wechat/callback`;
  const parameters = new URLSearchParams({
    appid: runtime.WECHAT_APP_ID,
    redirect_uri: callback,
    response_type: 'code',
    scope: 'snsapi_login',
    state,
  });
  return Response.redirect(
    `https://open.weixin.qq.com/connect/qrconnect?${parameters.toString()}#wechat_redirect`,
    302,
  );
}
