'use client';

import type { Message, Thread } from '@/types/mail';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import { MessageItem } from '../MessageItem';
import type { PendingDelivery } from '../../hooks';
import styles from './ThreadView.module.css';

interface ThreadViewProps {
  readonly thread: Thread | null;
  readonly messages: readonly Message[];
  /** このスレッドで配信中の送信 */
  readonly pendingDeliveries: readonly PendingDelivery[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly displayName: (address: string) => string;
  readonly onReply: () => void;
  readonly onRetry: (failed: Message) => void;
}

/** スレッド本文 */
export const ThreadView = ({
  thread,
  messages,
  pendingDeliveries,
  loading,
  error,
  displayName,
  onReply,
  onRetry,
}: ThreadViewProps) => {
  // 再取得中でも、すでに開いているスレッドがあれば内容を出し続ける
  if (loading && !thread) {
    return (
      <section className={styles.view}>
        <p className={styles.placeholder}>
          <Spinner /> 読み込み中…
        </p>
      </section>
    );
  }

  if (error && !thread) {
    return (
      <section className={styles.view}>
        <p className={styles.error}>{error}</p>
      </section>
    );
  }

  if (!thread) {
    return (
      <section className={styles.view}>
        <p className={styles.placeholder}>
          スレッドを選択してください。まずは「新規作成」からエージェントに指示を送ってみましょう。
        </p>
      </section>
    );
  }

  return (
    <section className={styles.view}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.subject}>{thread.subject}</h1>
          <p className={styles.participants}>
            {thread.participants.map(displayName).join(', ')} ・{' '}
            {thread.messageCount} 通
          </p>
        </div>
        <button type="button" className={styles.replyButton} onClick={onReply}>
          <Icon name="reply" size={16} />
          返信
        </button>
      </header>

      <div className={styles.messages}>
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            displayName={displayName}
            onRetry={message.status === 'failed' ? onRetry : undefined}
          />
        ))}

        {pendingDeliveries.map((pending) => (
          <p key={pending.id} className={styles.pending}>
            <Spinner /> {pending.to.map(displayName).join(', ')} へ配信中…
          </p>
        ))}
      </div>
    </section>
  );
};
