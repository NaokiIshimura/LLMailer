'use client';

import type { ListedTemplate } from '@/types/mail';
import { Icon } from '../Icon';
import styles from './TemplateSettings.module.css';

interface TemplateSettingsProps {
  readonly templates: readonly ListedTemplate[];
  readonly error: string | null;
  readonly deleting: boolean;
  readonly onCreate: () => void;
  readonly onEdit: (template: ListedTemplate) => void;
  readonly onDelete: (template: ListedTemplate) => void;
}

/**
 * 設定に置くテンプレートの一覧。
 *
 * デフォルトのぶんは変更・削除できないため、バッジだけを出してボタンは置かない。
 */
export const TemplateSettings = ({
  templates,
  error,
  deleting,
  onCreate,
  onEdit,
  onDelete,
}: TemplateSettingsProps) => (
  <div className={styles.panel}>
    <div className={styles.head}>
      <p className={styles.description}>
        作成・返信の本文へ差し込める定型文です。デフォルトのぶんは変更・削除できません。
      </p>
      <button type="button" className={styles.addButton} onClick={onCreate}>
        <Icon name="plus" size={15} />
        追加
      </button>
    </div>

    {error && <p className={styles.error}>{error}</p>}

    <ul className={styles.items}>
      {templates.map((template) => (
        <li key={template.id} className={styles.item}>
          <div className={styles.itemText}>
            <p className={styles.itemTitle}>
              {template.name}
              {template.isDefault && (
                <span className={styles.defaultTag}>デフォルト</span>
              )}
            </p>
            {template.description && (
              <p className={styles.itemDescription}>{template.description}</p>
            )}
          </div>

          {!template.isDefault && (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.action}
                onClick={() => onEdit(template)}
                aria-label={`${template.name}を変更`}
                title="変更"
              >
                <Icon name="edit" size={15} />
              </button>
              <button
                type="button"
                className={`${styles.action} ${styles.danger}`}
                onClick={() => onDelete(template)}
                disabled={deleting}
                aria-label={`${template.name}を削除`}
                title="削除"
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  </div>
);
