/* oxlint-disable next/no-html-link-for-pages */
import { chatGPTSignInPath } from '@/app/chatgpt-auth';
import { ScanPage } from './scan-page';
import { getCurrentUser } from '@/lib/app-auth';

export const dynamic = 'force-dynamic';

export default async function QrPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ login_error?: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();
  if (!user && process.env.NODE_ENV === 'production') {
    const errorCode = (await searchParams).login_error;
    return (
      <main className="mobile-signin">
        <div className="mobile-signin-card">
          <div className="mobile-logo">构</div>
          <h1>使用微信验证身份</h1>
          <p>
            该二维码对应工程构件。使用当前微信账号授权后，可查看档案并录入有权限的现场进度。
          </p>
          {errorCode && (
            <div className="signin-error">登录未完成，请重新尝试。</div>
          )}
          <a
            className="signin-action signin-wechat"
            href={`/auth/wechat?return_to=${encodeURIComponent(`/q/${token}`)}`}
            target="_top"
          >
            <span>微</span>微信扫码登录
          </a>
          <a
            className="signin-secondary"
            href={chatGPTSignInPath(`/q/${token}`)}
            target="_top"
          >
            使用 ChatGPT 账号登录
          </a>
        </div>
      </main>
    );
  }
  return (
    <ScanPage token={token} displayName={user?.displayName ?? '现场录入员'} />
  );
}
