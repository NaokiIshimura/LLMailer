'use client';

import {
  AGENT_ACCESSES,
  AGENT_ACCESS_LABELS,
  type AgentAccess,
} from '@/types/mail';
import type { AgentForm } from '../../hooks';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import styles from './AgentEditor.module.css';

interface AgentEditorProps {
  readonly form: AgentForm;
  readonly saving: boolean;
  readonly error: string | null;
  readonly onChange: (patch: Partial<AgentForm>) => void;
  readonly onSave: () => void;
  readonly onClose: () => void;
}

/** モデル名の候補（フル名も書けるよう、入力自体は自由にしておく） */
const MODEL_SUGGESTIONS: readonly string[] = ['opus', 'sonnet', 'haiku'];

const ACCESS_HINTS: Readonly<Record<AgentAccess, string>> = {
  full: 'このエージェント宛のメール 1 通で、作業ディレクトリのファイルが書き換わります。',
  readOnly:
    'ファイルの読み取りと検索だけを許可します（グローバル設定の許可も継承しません）。',
};

/** エージェントの追加・変更フォーム */
export const AgentEditor = ({
  form,
  saving,
  error,
  onChange,
  onSave,
  onClose,
}: AgentEditorProps) => {
  const isNew = form.editing === null;
  const canSave = form.name.trim() !== '' && form.model.trim() !== '' && !saving;

  return (
    <div className={styles.overlay}>
      <div
        className={styles.window}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'エージェントの追加' : 'エージェントの変更'}
      >
        <header className={styles.header}>
          <span>{isNew ? 'エージェントの追加' : 'エージェントの変更'}</span>
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
              placeholder="myrepo 担当"
              onChange={(event) => onChange({ name: event.target.value })}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>モデル</span>
            <input
              type="text"
              className={`${styles.input} ${styles.mono}`}
              list="agent-model-suggestions"
              value={form.model}
              placeholder="opus / sonnet / haiku またはフル名"
              onChange={(event) => onChange({ model: event.target.value })}
            />
            <datalist id="agent-model-suggestions">
              {MODEL_SUGGESTIONS.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
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

          <div className={styles.field}>
            <span className={styles.label}>権限</span>
            <div className={styles.choices}>
              {AGENT_ACCESSES.map((access) => (
                <label key={access} className={styles.choice}>
                  <input
                    type="radio"
                    name="agent-access"
                    value={access}
                    checked={form.access === access}
                    onChange={() => onChange({ access })}
                  />
                  <span>{AGENT_ACCESS_LABELS[access]}</span>
                </label>
              ))}
              <p
                className={`${styles.hint} ${
                  form.access === 'full' ? styles.warn : ''
                }`}
              >
                {form.access === 'full' && <Icon name="warning" size={13} />}
                {ACCESS_HINTS[form.access]}
              </p>
            </div>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>作業ディレクトリ</span>
            <input
              type="text"
              className={`${styles.input} ${styles.mono}`}
              value={form.workingDirectory}
              placeholder="."
              onChange={(event) =>
                onChange({ workingDirectory: event.target.value })
              }
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>タイムアウト</span>
            <span className={styles.inline}>
              <input
                type="number"
                min={1}
                className={`${styles.input} ${styles.number}`}
                value={form.timeoutSeconds}
                placeholder="600"
                onChange={(event) =>
                  onChange({ timeoutSeconds: event.target.value })
                }
              />
              <span className={styles.unit}>秒（空欄なら既定の 10 分）</span>
            </span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>役割（システムプロンプト）</span>
            <textarea
              className={styles.textarea}
              value={form.systemPrompt}
              placeholder="このエージェントに与える役割を書いてください"
              onChange={(event) =>
                onChange({ systemPrompt: event.target.value })
              }
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
            許可ツールの細かい指定は <code>data/agents.json</code> で調整できます
          </span>
        </footer>
      </div>
    </div>
  );
};
