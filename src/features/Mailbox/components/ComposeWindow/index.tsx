'use client';

import { useRef } from 'react';
import { insertTemplateBody } from '@/lib/composeTemplate';
import {
  isFullAccessAgent,
  type Agent,
  type ListedTemplate,
} from '@/types/mail';
import {
  useComposeKeyboard,
  useComposeSize,
  type ComposeDraft,
} from '../../hooks';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import { TemplatePicker } from '../TemplatePicker';
import styles from './ComposeWindow.module.css';

interface ComposeWindowProps {
  readonly draft: ComposeDraft;
  readonly agents: readonly Agent[];
  /** 本文へ差し込める定型文 */
  readonly templates: readonly ListedTemplate[];
  readonly sending: boolean;
  readonly saving: boolean;
  readonly error: string | null;
  /** エージェント ID → 表示名 */
  readonly agentName: (agentId: string) => string;
  readonly onChange: (patch: Partial<ComposeDraft>) => void;
  readonly onToggleRecipient: (agentId: string) => void;
  readonly onSend: () => void;
  readonly onSaveDraft: () => void;
  readonly onClose: () => void;
}

/** 作成・返信ウィンドウ */
export const ComposeWindow = ({
  draft,
  agents,
  templates,
  sending,
  saving,
  error,
  agentName,
  onChange,
  onToggleRecipient,
  onSend,
  onSaveDraft,
  onClose,
}: ComposeWindowProps) => {
  const { size, maximized, resizing, toggleMaximized, startResize } =
    useComposeSize();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const canSend =
    draft.agentIds.length > 0 && draft.body.trim().length > 0 && !sending;
  const { sendButtonRef, handleBodyKeyDown } = useComposeKeyboard(
    onSend,
    canSend
  );

  /** テンプレートは本文のカーソル位置へ差し込む（選択範囲があれば置き換える） */
  const handleSelectTemplate = (template: ListedTemplate): void => {
    const textarea = bodyRef.current;
    // 本文を触っていなければ末尾に足す
    const start = textarea?.selectionStart ?? draft.body.length;
    const end = textarea?.selectionEnd ?? draft.body.length;
    const { body, caret } = insertTemplateBody(
      draft.body,
      start,
      end,
      template.body
    );

    onChange({ body });
    // 差し込んだ本文が描かれる前に動かしても戻されるため、次の描画を待つ
    requestAnimationFrame(() => {
      const current = bodyRef.current;
      if (!current) {
        return;
      }
      current.focus();
      current.setSelectionRange(caret, caret);
    });
  };

  return (
    <div
      className={`${styles.window} ${maximized ? styles.maximized : ''} ${
        resizing ? styles.resizing : ''
      }`}
      // 最大化中は CSS 側の大きさに任せる
      style={maximized ? undefined : { width: size.width, height: size.height }}
      role="dialog"
      aria-label={draft.locked ? '返信' : '新規作成'}
    >
      {/* ウィンドウは右下に固定されているため、広げるつまみは左上と上辺・左辺に置く */}
      <div
        className={`${styles.resizeHandle} ${styles.resizeLeft}`}
        onPointerDown={startResize('x')}
        aria-hidden="true"
      />
      <div
        className={`${styles.resizeHandle} ${styles.resizeTop}`}
        onPointerDown={startResize('y')}
        aria-hidden="true"
      />
      <div
        className={`${styles.resizeHandle} ${styles.resizeCorner}`}
        onPointerDown={startResize('both')}
        aria-hidden="true"
      />

      <header className={styles.header}>
        <span>{draft.locked ? '返信' : '新規作成'}</span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerButton}
            onClick={toggleMaximized}
            aria-pressed={maximized}
            aria-label={maximized ? '元の大きさに戻す' : '最大化'}
            title={maximized ? '元の大きさに戻す' : '最大化'}
          >
            <Icon name={maximized ? 'collapse' : 'expand'} size={16} />
          </button>
          <button
            type="button"
            className={styles.headerButton}
            onClick={onClose}
            aria-label="閉じる"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.fields}>
        <div className={styles.field}>
          <span className={styles.label}>宛先</span>
          {draft.locked ? (
            <span className={styles.lockedRecipients}>
              {draft.agentIds.map(agentName).join(', ')}
            </span>
          ) : (
            <div className={styles.recipients}>
              {agents.map((agent) => {
                const selected = draft.agentIds.includes(agent.id);
                const fullAccess = isFullAccessAgent(agent);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    className={`${styles.recipient} ${
                      selected ? styles.recipientSelected : ''
                    }`}
                    onClick={() => onToggleRecipient(agent.id)}
                    aria-pressed={selected}
                    title={`${agent.description ?? agent.name}${
                      fullAccess
                        ? '（ファイル変更・コマンド実行が可能）'
                        : '（読み取り専用）'
                    }`}
                  >
                    {selected && <Icon name="check" size={13} />}
                    {agent.name}
                    {fullAccess && (
                      <span className={styles.warn}>
                        <Icon name="warning" size={13} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.field}>
          <span className={styles.label}>件名</span>
          {draft.locked ? (
            <span className={styles.lockedRecipients}>{draft.subject}</span>
          ) : (
            <input
              type="text"
              className={styles.subjectInput}
              value={draft.subject}
              placeholder="件名（このスレッドのお題）"
              onChange={(event) => onChange({ subject: event.target.value })}
            />
          )}
        </div>

        <textarea
          ref={bodyRef}
          className={styles.bodyInput}
          value={draft.body}
          placeholder="エージェントへの指示を書いてください"
          onChange={(event) => onChange({ body: event.target.value })}
          onKeyDown={handleBodyKeyDown}
        />

        <div className={styles.templateRow}>
          <TemplatePicker
            templates={templates}
            onSelect={handleSelectTemplate}
          />
        </div>
      </div>

      <footer className={styles.footer}>
        <button
          ref={sendButtonRef}
          type="button"
          className={styles.sendButton}
          onClick={onSend}
          disabled={!canSend}
          title="⌘（Ctrl）+ Enter でも送信できます"
        >
          {sending ? <Spinner /> : '送信'}
        </button>
        <button
          type="button"
          className={styles.draftButton}
          onClick={onSaveDraft}
          disabled={saving || sending}
        >
          {saving ? '保存中…' : '下書き保存'}
        </button>
        <span className={styles.hint}>
          複数宛先で返信を比較できます。
          <Icon name="warning" size={12} /> の宛先はファイルを変更します。
          ⌘（Ctrl）+ Enter で送信できます
        </span>
      </footer>
    </div>
  );
};
