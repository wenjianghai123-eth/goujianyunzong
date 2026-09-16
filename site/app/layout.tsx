import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '构件云踪｜工程进度管理平台',
  description: '面向构件生产、进场、现场施工与安装全过程的数字化进度管理平台。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
