'use client';

import type { ThemePreference } from '@/lib/theme';
import type { ListedTemplate } from '@/types/mail';
import { GroupDefaultAgentsToggle } from '../GroupDefaultAgentsToggle';
import { NotificationSoundToggle } from '../NotificationSoundToggle';
import { TemplateSettings } from '../TemplateSettings';
import { ThemeToggle } from '../ThemeToggle';
import styles from './SettingsView.module.css';

interface SettingsViewProps {
  readonly theme: ThemePreference;
  readonly onSelectTheme: (theme: ThemePreference) => void;
  readonly notificationSound: boolean;
  readonly onSelectNotificationSound: (enabled: boolean) => void;
  readonly onPreviewNotificationSound: () => void;
  /** デフォルトのエージェントのメールボックスを 1 つにまとめるか */
  readonly groupDefaultAgents: boolean;
  readonly onSelectGroupDefaultAgents: (grouped: boolean) => void;
  /** 本文へ差し込める定型文 */
  readonly templates: readonly ListedTemplate[];
  readonly templateError: string | null;
  readonly deletingTemplate: boolean;
  readonly onCreateTemplate: () => void;
  readonly onEditTemplate: (template: ListedTemplate) => void;
  readonly onDeleteTemplate: (template: ListedTemplate) => void;
}

/**
 * アプリの設定。
 *
 * 項目が増えても並べるだけで済むよう、1 項目を「見出し・説明・操作」の
 * 組み合わせ（.item）として並べる。
 */
export const SettingsView = ({
  theme,
  onSelectTheme,
  notificationSound,
  onSelectNotificationSound,
  onPreviewNotificationSound,
  groupDefaultAgents,
  onSelectGroupDefaultAgents,
  templates,
  templateError,
  deletingTemplate,
  onCreateTemplate,
  onEditTemplate,
  onDeleteTemplate,
}: SettingsViewProps) => (
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

      <h2 className={`${styles.groupTitle} ${styles.nextGroupTitle}`}>
        メールボックス
      </h2>
      <div className={styles.item}>
        <div className={styles.itemText}>
          <p className={styles.itemTitle}>デフォルトのエージェント</p>
          <p className={styles.itemDescription}>
            左の一覧の並べ方です。「まとめる」にすると、はじめから用意されているエージェントのメールボックスを「デフォルト」1
            つにまとめます。
          </p>
        </div>
        <GroupDefaultAgentsToggle
          grouped={groupDefaultAgents}
          onSelect={onSelectGroupDefaultAgents}
        />
      </div>

      <h2 className={`${styles.groupTitle} ${styles.nextGroupTitle}`}>通知</h2>
      <div className={styles.item}>
        <div className={styles.itemText}>
          <p className={styles.itemTitle}>返信の通知音</p>
          <p className={styles.itemDescription}>
            エージェントの作業が終わって返信が届いたときに、メールの着信音を鳴らします。
          </p>
        </div>
        <NotificationSoundToggle
          enabled={notificationSound}
          onSelect={onSelectNotificationSound}
          onPreview={onPreviewNotificationSound}
        />
      </div>

      <h2 className={`${styles.groupTitle} ${styles.nextGroupTitle}`}>
        テンプレート
      </h2>
      <TemplateSettings
        templates={templates}
        error={templateError}
        deleting={deletingTemplate}
        onCreate={onCreateTemplate}
        onEdit={onEditTemplate}
        onDelete={onDeleteTemplate}
      />
    </div>
  </section>
);
