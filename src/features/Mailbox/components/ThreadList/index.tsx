'use client';

import type { AgentMailbox } from '@/lib/agentMailbox';
import { formatListDate } from '@/lib/format';
import type { Agent, Folder, Message, Thread } from '@/types/mail';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import { PermissionBadge } from '../PermissionBadge';
import styles from './ThreadList.module.css';

interface ThreadListProps {
  readonly folder: Folder;
  /** 宛先で絞り込んでいるメールボックス（絞り込んでいなければ null） */
  readonly mailbox: AgentMailbox | null;
  readonly threads: readonly Thread[];
  readonly drafts: readonly Message[];
  readonly agents: readonly Agent[];
  readonly selectedThreadId: string | null;
  readonly query: string;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onChangeQuery: (query: string) => void;
  readonly onSelectThread: (threadId: string) => void;
  readonly onCompose: (to?: readonly string[]) => void;
  readonly onSelectDraft: (draft: Message) => void;
  readonly onDeleteDraft: (draft: Message) => void;
  /** 下書きの削除リクエスト中か */
  readonly deletingDraft: boolean;
  /** 対応が済んだスレッドを片付ける（アーカイブ済みなら解除する） */
  readonly onArchiveThread: (thread: Thread) => void;
  /** アーカイブの切り替えリクエスト中か */
  readonly archiving: boolean;
}

/** スレッド一覧（下書きフォルダでは下書き一覧、宛先を選んでいればその宛先のメール一覧） */
export const ThreadList = ({
  folder,
  mailbox,
  threads,
  drafts,
  agents,
  selectedThreadId,
  query,
  loading,
  error,
  onChangeQuery,
  onSelectThread,
  onCompose,
  onSelectDraft,
  onDeleteDraft,
  deletingDraft,
  onArchiveThread,
  archiving,
}: ThreadListProps) => {
  const nameOf = (agentId: string): string =>
    agents.find((item) => item.id === agentId)?.name ?? '不明なエージェント';

  return (
    <section className={styles.list}>
      {/* 宛先で絞り込んでいるときは、どの宛先の一覧かを見出しに出す */}
      {mailbox && (
        <div className={styles.agentHeader}>
          <div className={styles.agentHeading}>
            <span className={styles.agentName}>{mailbox.name}</span>
            {/* まとめたメールボックスは宛先ごとに権限が違うため、バッジは出さない */}
            {mailbox.agent && <PermissionBadge agent={mailbox.agent} />}
          </div>
          {/* 宛先は見出しに出ているので、ボタンは短い文言にして名前の表示幅を残す */}
          <button
            type="button"
            className={styles.composeButton}
            onClick={() =>
              onCompose(mailbox.agent ? [mailbox.agent.id] : undefined)
            }
            title={
              mailbox.agent
                ? `${mailbox.agent.name}にメールを書く`
                : 'メールを書く'
            }
          >
            <Icon name="mail" size={14} />
            新規作成
          </button>
        </div>
      )}

      <div className={styles.searchRow}>
        <input
          type="search"
          className={styles.search}
          placeholder="件名・本文を検索"
          value={query}
          onChange={(event) => onChangeQuery(event.target.value)}
        />
      </div>

      <div className={styles.items}>
        {/* 再取得中でも、すでに表示できる内容があれば置き換えない */}
        {loading && threads.length === 0 && drafts.length === 0 && (
          <p className={styles.empty}>
            <Spinner /> 読み込み中…
          </p>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {!loading && !error && folder === 'drafts' && drafts.length === 0 && (
          <p className={styles.empty}>下書きはありません</p>
        )}

        {!loading && !error && folder !== 'drafts' && threads.length === 0 && (
          <p className={styles.empty}>
            {/* まとめたメールボックスは相手が 1 人ではないので、名前を出さない */}
            {mailbox?.agent
              ? `${mailbox.agent.name}とのやり取りはありません`
              : 'メッセージはありません'}
          </p>
        )}

        {folder === 'drafts'
          ? drafts.map((draft) => (
              // 下書きを開くボタンの中に削除ボタンは置けないため、横に並べる
              <div key={draft.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => onSelectDraft(draft)}
                >
                  <div className={styles.topRow}>
                    <span className={styles.participants}>
                      {draft.agentIds.map(nameOf).join(', ') || '宛先未設定'}
                    </span>
                    <span className={styles.date}>
                      {formatListDate(draft.createdAt)}
                    </span>
                  </div>
                  <div className={styles.subject}>{draft.subject}</div>
                  <div className={styles.snippet}>
                    {draft.body || '(本文なし)'}
                  </div>
                </button>
                <button
                  type="button"
                  className={`${styles.rowAction} ${styles.deleteAction}`}
                  onClick={() => onDeleteDraft(draft)}
                  disabled={deletingDraft}
                  aria-label="この下書きを削除"
                  title="この下書きを削除"
                >
                  {deletingDraft ? <Spinner /> : <Icon name="trash" size={15} />}
                </button>
              </div>
            ))
          : threads.map((thread) => (
              // スレッドを開くボタンの中にアーカイブボタンは置けないため、横に並べる
              <div
                key={thread.id}
                className={`${styles.row} ${
                  thread.id === selectedThreadId ? styles.selected : ''
                } ${thread.hasPending ? styles.pending : ''}`}
              >
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => onSelectThread(thread.id)}
                >
                  <div className={styles.topRow}>
                    <span className={styles.participants}>
                      {thread.participants.map(nameOf).join(', ')}
                    </span>
                    <span className={styles.date}>
                      {formatListDate(thread.lastMessageAt)}
                    </span>
                  </div>
                  <div
                    className={`${styles.subject} ${
                      thread.unreadCount > 0 ? styles.unread : ''
                    }`}
                  >
                    {thread.unreadCount > 0 && (
                      <span className={styles.dot} aria-label="未読" />
                    )}
                    <span className={styles.subjectText}>{thread.subject}</span>
                    {thread.hasPending && (
                      <span className={`${styles.tag} ${styles.pendingTag}`}>
                        <span
                          className={styles.pendingPulse}
                          aria-hidden="true"
                        />
                        対応中
                      </span>
                    )}
                    {thread.hasFailure && (
                      <span className={`${styles.tag} ${styles.failureTag}`}>
                        失敗
                      </span>
                    )}
                  </div>
                  <div className={styles.snippet}>{thread.snippet}</div>
                </button>
                {/* 対応中はまだ片付けられないため、アーカイブの操作を出さない */}
                {!thread.hasPending && (
                  <button
                    type="button"
                    className={`${styles.rowAction} ${styles.archiveAction}`}
                    onClick={() => onArchiveThread(thread)}
                    disabled={archiving}
                    aria-label={
                      thread.archived
                        ? 'このスレッドをメールボックスへ戻す'
                        : 'このスレッドをアーカイブする'
                    }
                    title={
                      thread.archived
                        ? 'このスレッドをメールボックスへ戻す'
                        : 'このスレッドをアーカイブする'
                    }
                  >
                    {archiving ? (
                      <Spinner />
                    ) : (
                      <Icon
                        name={thread.archived ? 'inbox' : 'archive'}
                        size={15}
                      />
                    )}
                  </button>
                )}
              </div>
            ))}
      </div>
    </section>
  );
};
