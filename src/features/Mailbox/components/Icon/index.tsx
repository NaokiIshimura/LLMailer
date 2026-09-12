import type { ReactNode } from 'react';
import styles from './Icon.module.css';

export type IconName =
  | 'mail'
  | 'reload'
  | 'reply'
  | 'close'
  | 'warning'
  | 'check'
  | 'retry';

/**
 * 24x24 のストロークアイコン。
 *
 * ✉ や ⟳ のような記号文字はテキスト表示が既定で、
 * 隣の文字に比べて細く小さく描かれてしまうため SVG で持つ。
 * 色は currentColor に従うので、そのままダークモードにも追従する。
 */
const PATHS: Readonly<Record<IconName, ReactNode>> = {
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  reload: (
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </>
  ),
  reply: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  warning: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  retry: (
    <>
      <path d="M21 12a9 9 0 1 1-3.5-7.1" />
      <path d="M21 3v5h-5" />
    </>
  ),
};

interface IconProps {
  readonly name: IconName;
  /** 表示サイズ（px）。隣のテキストより少し大きめが目安 */
  readonly size?: number;
  readonly strokeWidth?: number;
}

export const Icon = ({ name, size = 16, strokeWidth = 2 }: IconProps) => (
  <svg
    className={styles.icon}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {PATHS[name]}
  </svg>
);
