'use client';

import type { ThemePreference } from '@/lib/theme';
import { ThemeToggle } from '../ThemeToggle';
import styles from './SettingsView.module.css';

interface SettingsViewProps {
  readonly theme: ThemePreference;
  readonly onSelectTheme: (theme: ThemePreference) => void;
}

/**
 * アプリの設定。
 *
 * 項目が増えても並べるだけで済むよう、1 項目を「見出し・説明・操作」の
 * 組み合わせ（.item）として並べる。
 */
export const SettingsView = ({ theme, onSelectTheme }: SettingsViewProps) => (
  <section className={styles.view}>
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>設定</h1>
        <p className={styles.subtitle}>LLMailer の表示や動作を変えられます。</p>
      </div>
    </header>

    <div className={styles.body}>
      <h2 className={styles.groupTitle}>表示</h2>
      <div className={styles.item}>
        <div className={styles.itemText}>
          <p className={styles.itemTitle}>テーマ</p>
          <p className={styles.itemDescription}>
            画面の配色です。「システム」は OS の設定に合わせて切り替わります。
          </p>
        </div>
        <ThemeToggle theme={theme} onSelect={onSelectTheme} />
      </div>
    </div>
  </section>
);
