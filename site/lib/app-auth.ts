import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';

import { getChatGPTUser } from '@/app/chatgpt-auth';

export const SESSION_COOKIE = 'goujian_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type AppUser = {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  provider: 'WECHAT' | 'CHATGPT';
};

export function authDatabase(): D1Database {
  if (!env.DB) throw new Error('认证数据库暂不可用');
  return env.DB;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    const sessionId = await hashToken(rawToken);
    const user = await authDatabase()
      .prepare(`
        SELECT u.id AS userId, u.display_name AS displayName, u.avatar_url AS avatarUrl
        FROM auth_sessions s
        JOIN auth_users u ON u.id = s.user_id
        WHERE s.id = ? AND s.expires_at > ?
      `)
      .bind(sessionId, new Date().toISOString())
      .first<{ userId: string; displayName: string; avatarUrl: string }>();
    if (user) return { ...user, email: '', provider: 'WECHAT' };
  }

  const chatGPTUser = await getChatGPTUser();
  if (!chatGPTUser) return null;
  return {
    userId: chatGPTUser.userId,
    displayName: chatGPTUser.displayName,
    email: chatGPTUser.email,
    avatarUrl: '',
    provider: 'CHATGPT',
  };
}

export async function hashToken(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

export function sessionCookie(rawToken: string) {
  return `${SESSION_COOKIE}=${rawToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function safeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://app.local');
    if (url.origin !== 'https://app.local' || url.pathname.startsWith('/auth/'))
      return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

export type WeChatRuntimeEnv = {
  WECHAT_APP_ID?: string;
  WECHAT_APP_SECRET?: string;
  WECHAT_REDIRECT_URI?: string;
};

export function weChatRuntime(): WeChatRuntimeEnv {
  return env as unknown as WeChatRuntimeEnv;
}
