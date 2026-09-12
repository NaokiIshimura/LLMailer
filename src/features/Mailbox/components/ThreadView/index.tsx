'use client';

import { Fragment } from 'react';
import type { Message, Thread } from '@/types/mail';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import { MessageItem } from '../MessageItem';
import type { PendingDelivery } from '../../hooks';
import styles from './ThreadView.module.css';

interface ThreadViewProps {
  readonly thread: Thread | null;
  /** 「送信とその返信」のまとまり。新しいものが先頭 */
  readonly exchanges: readonly (readonly Message[])[];
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
  exchanges,
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

  const pending = pendingDeliveries.map((delivery) => (
    <p key={delivery.id} className={styles.pending}>
      <Spinner /> {delivery.to.map(displayName).join(', ')} へ配信中…
    </p>
  ));

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
        {/* 送信済みのまとまりがまだ無いあいだも配信中を見せる */}
        {exchanges.length === 0 && pending}

        {exchanges.map((exchange, index) => (
          <Fragment key={exchange[0].id}>
            {exchange.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                displayName={displayName}
                onRetry={message.status === 'failed' ? onRetry : undefined}
              />
            ))}
            {/* 配信中の返信は、その送信のすぐ下に置く */}
            {index === 0 && pending}
          </Fragment>
        ))}
      </div>
    </section>
  );
};
