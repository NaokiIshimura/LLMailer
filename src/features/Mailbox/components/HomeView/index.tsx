'use client';

import { formatListDate } from '@/lib/format';
import { isFullAccessAgent, type Agent, type Folder, type Thread } from '@/types/mail';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import styles from './HomeView.module.css';

/** ホームに並べる最近のスレッド件数 */
const RECENT_THREAD_LIMIT = 5;

interface HomeViewProps {
  readonly threads: readonly Thread[];
  readonly agents: readonly Agent[];
  readonly unreadCount: number;
  readonly draftCount: number;
  /** 対応中（応答待ち）の件数 */
  readonly pendingCount: number;
  readonly loading: boolean;
  readonly error: string | null;
  readonly displayName: (address: string) => string;
  readonly onSelectFolder: (folder: Folder) => void;
  readonly onSelectThread: (threadId: string) => void;
  readonly onCompose: (to?: readonly string[]) => void;
}

/** メールボックスなどに入る前の概要画面 */
export const HomeView = ({
  threads,
  agents,
  unreadCount,
  draftCount,
  pendingCount,
  loading,
  error,
  displayName,
  onSelectFolder,
  onSelectThread,
  onCompose,
}: HomeViewProps) => {
  const recentThreads = threads.slice(0, RECENT_THREAD_LIMIT);
  const failedThreads = threads.filter((thread) => thread.hasFailure);

  const stats: readonly {
    readonly label: string;
    readonly count: number;
    readonly folder: Folder;
    readonly accent?: boolean;
  }[] = [
    {
      label: '未読',
      count: unreadCount,
      folder: 'mailbox',
      accent: unreadCount > 0,
    },
    { label: '対応中', count: pendingCount, folder: 'mailbox' },
    { label: '下書き', count: draftCount, folder: 'drafts' },
    { label: 'エージェント', count: agents.length, folder: 'contacts' },
  ];

  return (
    <section className={styles.view}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>ホーム</h1>
          <p className={styles.subtitle}>
            未読と最近のやり取りをまとめて確認できます。
          </p>
        </div>
        <button
          type="button"
          className={styles.composeButton}
          onClick={() => onCompose()}
        >
          <Icon name="mail" size={16} />
          メールを書く
        </button>
      </header>

      <div className={styles.body}>
        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.stats}>
          {stats.map((stat) => (
            <button
              key={stat.label}
              type="button"
              className={styles.stat}
              onClick={() => onSelectFolder(stat.folder)}
            >
              <span
                className={`${styles.statCount} ${stat.accent ? styles.statAccent : ''}`}
              >
                {stat.count}
              </span>
              <span className={styles.statLabel}>{stat.label}</span>
            </button>
          ))}
        </div>

        {failedThreads.length > 0 && (
          <p className={styles.alert}>
            <Icon name="warning" size={15} />
            配信に失敗したスレッドが {failedThreads.length} 件あります。
          </p>
        )}

        <p className={styles.sectionTitle}>最近のやり取り</p>
        {/* 再取得中でも、すでに表示できる内容があれば置き換えない */}
        {loading && recentThreads.length === 0 ? (
          <p className={styles.empty}>
            <Spinner /> 読み込み中…
          </p>
        ) : recentThreads.length === 0 ? (
          <p className={styles.empty}>まだメッセージはありません</p>
        ) : (
          <div className={styles.threads}>
            {recentThreads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={styles.thread}
                onClick={() => onSelectThread(thread.id)}
              >
                <div className={styles.threadTop}>
                  <span
                    className={`${styles.threadSubject} ${
                      thread.unreadCount > 0 ? styles.unread : ''
                    }`}
                  >
                    {thread.unreadCount > 0 && (
                      <span className={styles.dot} aria-label="未読" />
                    )}
                    {thread.subject}
                  </span>
                  <span className={styles.threadDate}>
                    {formatListDate(thread.lastMessageAt)}
                  </span>
                </div>
                <div className={styles.threadMeta}>
                  {thread.participants.map(displayName).join(', ')}
                  {thread.hasPending && (
                    <span className={`${styles.tag} ${styles.pendingTag}`}>
                      <span className={styles.pendingPulse} aria-hidden="true" />
                      対応中
                    </span>
                  )}
                  {thread.hasFailure && (
                    <span className={`${styles.tag} ${styles.failureTag}`}>
                      配信失敗
                    </span>
                  )}
                </div>
                <div className={styles.threadSnippet}>{thread.snippet}</div>
              </button>
            ))}
          </div>
        )}

        <p className={styles.sectionTitle}>エージェントに送る</p>
        {agents.length === 0 ? (
          <p className={styles.empty}>エージェントが登録されていません</p>
        ) : (
          <div className={styles.agents}>
            {agents.map((agent) => (
              <button
                key={agent.address}
                type="button"
                className={styles.agent}
                onClick={() => onCompose([agent.address])}
              >
                <span className={styles.agentName}>{agent.name}</span>
                <span className={styles.agentMeta}>
                  {agent.model} ／{' '}
                  {isFullAccessAgent(agent) ? 'フル権限' : '読み取り専用'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
