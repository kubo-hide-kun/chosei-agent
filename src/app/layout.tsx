import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'chosei-agent | AIで日程調整',
  description:
    '候補日時を JSON や自然文でまとめて入稿できる、AI エージェント型の日程調整サービス',
};

export const viewport: Viewport = {
  themeColor: '#298737',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="sp-header">
          <div className="sp-header-inner">
            <Link href="/" className="sp-logo">
              chosei-agent
            </Link>
            <span className="sp-logo-badge">AI 日程調整</span>
          </div>
        </header>
        <main className="sp-container">{children}</main>
      </body>
    </html>
  );
}
