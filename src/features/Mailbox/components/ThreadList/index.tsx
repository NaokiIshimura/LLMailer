'use client';

import { formatListDate } from '@/lib/format';
import type { Agent, Folder, Message, Thread } from '@/types/mail';
import { Spinner } from '../Loader';
import styles from './ThreadList.module.css';

interface ThreadListProps {
  readonly folder: Folder;
  readonly threads: readonly Thread[];
  readonly drafts: readonly Message[];
  readonly agents: readonly Agent[];
  readonly selectedThreadId: string | null;
  readonly query: string;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onChangeQuery: (query: string) => void;
  readonly onSelectThread: (threadId: string) => void;
  readonly onSelectDraft: (draft: Message) => void;
}

/** スレッド一覧（下書きフォルダでは下書き一覧） */
export const ThreadList = ({
  folder,
  threads,
  drafts,
  agents,
  selectedThreadId,
  query,
  loading,
  error,
  onChangeQuery,
  onSelectThread,
  onSelectDraft,
}: ThreadListProps) => {
  const nameOf = (address: string): string =>
    agents.find((agent) => agent.address === address)?.name ?? address;

  return (
    <section className={styles.list}>
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
          <p className={styles.empty}>メッセージはありません</p>
        )}

        {folder === 'drafts'
          ? drafts.map((draft) => (
              <button
                key={draft.id}
                type="button"
                className={styles.item}
                onClick={() => onSelectDraft(draft)}
              >
                <div className={styles.topRow}>
                  <span className={styles.participants}>
                    {draft.to.map(nameOf).join(', ') || '宛先未設定'}
                  </span>
                  <span className={styles.date}>
                    {formatListDate(draft.createdAt)}
                  </span>
                </div>
                <div className={styles.subject}>{draft.subject}</div>
                <div className={styles.snippet}>{draft.body || '(本文なし)'}</div>
              </button>
            ))
          : threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`${styles.item} ${
                  thread.id === selectedThreadId ? styles.selected : ''
                }`}
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
                  <span>{thread.subject}</span>
                  {thread.hasFailure && (
                    <span className={`${styles.tag} ${styles.failureTag}`}>
                      配信失敗
                    </span>
                  )}
                </div>
                <div className={styles.snippet}>{thread.snippet}</div>
              </button>
            ))}
      </div>
    </section>
  );
};
