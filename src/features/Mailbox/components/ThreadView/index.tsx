'use client';

import { Fragment } from 'react';
import type { Message, Thread } from '@/types/mail';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import { MessageItem } from '../MessageItem';
import styles from './ThreadView.module.css';

interface ThreadViewProps {
  readonly thread: Thread | null;
  /** 「送信とその返信」のまとまり。新しいものが先頭 */
  readonly exchanges: readonly (readonly Message[])[];
  readonly loading: boolean;
  readonly error: string | null;
  /** エージェント ID → 表示名 */
  readonly agentName: (agentId: string) => string;
  readonly onReply: () => void;
  readonly onRetry: (failed: Message) => void;
  /** 再送せずに失敗した配信を取り消す */
  readonly onCancelFailure: (failed: Message) => void;
  /** 失敗した配信の片付け（再送後の削除・取り消し）リクエスト中か */
  readonly dismissing: boolean;
  /** 本文に書かれたファイルパスをビューアで開く */
  readonly onOpenFile: (filePath: string, agentId?: string) => void;
}

/** スレッド本文 */
export const ThreadView = ({
  thread,
  exchanges,
  loading,
  error,
  agentName,
  onReply,
  onRetry,
  onCancelFailure,
  dismissing,
  onOpenFile,
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
            {thread.participants.map(agentName).join(', ')} ・{' '}
            {thread.messageCount} 通
          </p>
        </div>
        <button type="button" className={styles.replyButton} onClick={onReply}>
          <Icon name="reply" size={16} />
          返信
        </button>
      </header>

      <div className={styles.messages}>
        {/* 対応中の返信もメッセージの 1 通として並ぶ（MessageItem が表示を切り替える） */}
        {exchanges.map((exchange) => (
          <Fragment key={exchange[0].id}>
            {exchange.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                agentName={agentName}
                onRetry={message.status === 'failed' ? onRetry : undefined}
                onCancel={
                  message.status === 'failed' ? onCancelFailure : undefined
                }
                dismissing={dismissing}
                onOpenFile={onOpenFile}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </section>
  );
};
