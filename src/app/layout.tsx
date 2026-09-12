import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LLMailer',
  description: 'メーラーの操作感で LLM に指示を送るクライアント',
};

const RootLayout = ({
  children,
}: Readonly<{ children: React.ReactNode }>) => (
  <html lang="ja">
    <body>{children}</body>
  </html>
);

export default RootLayout;
