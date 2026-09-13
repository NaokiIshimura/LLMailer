'use client';

import type { TemplateForm } from '../../hooks';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import styles from './TemplateEditor.module.css';

interface TemplateEditorProps {
  readonly form: TemplateForm;
  readonly saving: boolean;
  readonly error: string | null;
  readonly onChange: (patch: Partial<TemplateForm>) => void;
  readonly onSave: () => void;
  readonly onClose: () => void;
}

/** テンプレートの追加・変更フォーム */
export const TemplateEditor = ({
  form,
  saving,
  error,
  onChange,
  onSave,
  onClose,
}: TemplateEditorProps) => {
  const isNew = form.editing === null;
  const canSave = form.name.trim() !== '' && form.body.trim() !== '' && !saving;

  return (
    <div className={styles.overlay}>
      <div
        className={styles.window}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'テンプレートの追加' : 'テンプレートの変更'}
      >
        <header className={styles.header}>
          <span>{isNew ? 'テンプレートの追加' : 'テンプレートの変更'}</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="閉じる"
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.label}>名前</span>
            <input
              type="text"
              className={styles.input}
              value={form.name}
              placeholder="調査をする"
              onChange={(event) => onChange({ name: event.target.value })}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>説明</span>
            <input
              type="text"
              className={styles.input}
              value={form.description}
              placeholder="一覧に出る短い説明"
              onChange={(event) => onChange({ description: event.target.value })}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>本文</span>
            <textarea
              className={styles.textarea}
              value={form.body}
              placeholder="本文へ差し込む定型文を書いてください"
              onChange={(event) => onChange({ body: event.target.value })}
            />
          </label>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.saveButton}
            onClick={onSave}
            disabled={!canSave}
          >
            {saving ? <Spinner /> : isNew ? '追加' : '保存'}
          </button>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={saving}
          >
            キャンセル
          </button>
          <span className={styles.footerHint}>
            本文はそのままエージェントへの指示になります
          </span>
        </footer>
      </div>
    </div>
  );
};
