import type { Metadata } from 'next';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'LLMailer',
  description: 'メーラーの操作感で LLM に指示を送るクライアント',
};

const RootLayout = ({
  children,
}: Readonly<{ children: React.ReactNode }>) => (
  // 描画前スクリプトが data-theme を書き換えるため、その差分は許容する
  <html lang="ja" data-theme="light" suppressHydrationWarning>
    <head>
      {/* 設定したテーマを最初の描画から当てる（一瞬ライトで表示されるのを防ぐ） */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
    </head>
    <body>{children}</body>
  </html>
);

export default RootLayout;
