'use client';

import {
  formatCost,
  formatDateTime,
  formatDuration,
  formatTokens,
} from '@/lib/format';
import { ME_ADDRESS, type Message } from '@/types/mail';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import { MarkdownBody } from '../MarkdownBody';
import styles from './MessageItem.module.css';

interface MessageItemProps {
  readonly message: Message;
  /** アドレス → 表示名 */
  readonly displayName: (address: string) => string;
  readonly onRetry?: (message: Message) => void;
}

/** 1 通のメッセージ */
export const MessageItem = ({
  message,
  displayName,
  onRetry,
}: MessageItemProps) => {
  const fromMe = message.from === ME_ADDRESS;

  return (
    <article
      className={`${styles.message} ${fromMe ? styles.fromMe : ''}`}
      aria-label={`${displayName(message.from)} からのメッセージ`}
    >
      <header className={styles.header}>
        <div className={styles.route}>
          <span className={styles.from}>{displayName(message.from)}</span>
          <span className={styles.arrow}>→</span>
          <span className={styles.to}>
            {message.to.map(displayName).join(', ')}
          </span>
          {!message.read && message.status === 'received' && (
            <span className={`${styles.badge} ${styles.unreadBadge}`}>未読</span>
          )}
        </div>
        <div className={styles.meta}>
          {message.run?.numTurns !== undefined && (
            <span title="Claude Code のターン数">
              {message.run.numTurns} turn
            </span>
          )}
          {message.run?.durationMs !== undefined && (
            <span title="所要時間">{formatDuration(message.run.durationMs)}</span>
          )}
          {message.run?.costUsd !== undefined && (
            <span title="実行コスト">{formatCost(message.run.costUsd)}</span>
          )}
          {message.usage && (
            <span title="トークン使用量（入力 / 出力）">
              {formatTokens(message.usage.inputTokens)} /{' '}
              {formatTokens(message.usage.outputTokens)} tok
            </span>
          )}
          <time dateTime={message.createdAt}>
            {formatDateTime(message.createdAt)}
          </time>
        </div>
      </header>

      {message.status === 'failed' ? (
        <div className={styles.failure}>
          <span className={styles.failureText}>
            <Icon name="warning" size={15} />
            配信に失敗しました: {message.error}
          </span>
          {onRetry && (
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => onRetry(message)}
            >
              <Icon name="retry" size={13} />
              再送
            </button>
          )}
        </div>
      ) : message.status === 'pending' ? (
        <p className={styles.pending}>
          <Spinner /> 配信中…
        </p>
      ) : (
        <>
          <div className={styles.body}>
            <MarkdownBody body={message.body} />
          </div>
          {message.run?.deniedTools && (
            <p className={styles.denied}>
              権限により実行されなかったツール:{' '}
              {message.run.deniedTools.join(', ')}
            </p>
          )}
        </>
      )}
    </article>
  );
};
