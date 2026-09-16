/* oxlint-disable next/no-html-link-for-pages */
import { chatGPTSignInPath } from './chatgpt-auth';
import { Workspace } from './workspace';
import { getCurrentUser } from '@/lib/app-auth';

export const dynamic = 'force-dynamic';

const loginMessages: Record<string, string> = {
  wechat_not_configured: '微信登录尚未配置，请联系系统管理员。',
  wechat_cancelled: '你已取消微信授权，请重新扫码。',
  invalid_state: '登录二维码已过期，请重新发起登录。',
  wechat_api_error: '微信授权暂时失败，请稍后重试。',
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ login_error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user && process.env.NODE_ENV === 'production') {
    const errorCode = (await searchParams).login_error ?? '';
    return (
      <main className="signin-page">
        <div className="signin-card">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>
          <p className="eyebrow">构件云踪 · 安全工作区</p>
          <h1>使用微信扫码登录</h1>
          <p>
            使用当前微信账号扫描授权二维码，登录后即可管理有权限的工程项目。
          </p>
          {errorCode && (
            <div className="signin-error">
              {loginMessages[errorCode] ?? '登录失败，请重新尝试。'}
            </div>
          )}
          <a
            className="signin-action signin-wechat"
            href="/auth/wechat?return_to=%2F"
            target="_top"
          >
            <span>微</span>微信扫码登录
          </a>
          <a
            className="signin-secondary"
            href={chatGPTSignInPath('/')}
            target="_top"
          >
            使用 ChatGPT 账号登录
          </a>
          <small className="signin-notice">
            微信登录仅验证身份，工程数据仍按项目成员权限隔离。
          </small>
        </div>
      </main>
    );
  }
  return (
    <Workspace
      displayName={user?.displayName ?? '项目管理员'}
      userId={user?.userId ?? 'local-admin'}
      provider={user?.provider ?? 'CHATGPT'}
    />
  );
}
