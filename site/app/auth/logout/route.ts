import { cookies } from 'next/headers';

import {
  authDatabase,
  expiredSessionCookie,
  hashToken,
  safeReturnPath,
  SESSION_COOKIE,
} from '@/lib/app-auth';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    await authDatabase()
      .prepare(`DELETE FROM auth_sessions WHERE id = ?`)
      .bind(await hashToken(rawToken))
      .run();
  }
  const requestUrl = new URL(request.url);
  return new Response(null, {
    status: 302,
    headers: {
      Location: safeReturnPath(requestUrl.searchParams.get('return_to')),
      'Set-Cookie': expiredSessionCookie(),
      'Cache-Control': 'no-store',
    },
  });
}
