'use client';

import {
  formatCost,
  formatDateTime,
  formatDuration,
  formatTokens,
} from '@/lib/format';
import { isOutgoingMessage, type Message } from '@/types/mail';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import { MarkdownBody } from '../MarkdownBody';
import styles from './MessageItem.module.css';

interface MessageItemProps {
  readonly message: Message;
  /** エージェント ID → 表示名 */
  readonly agentName: (agentId: string) => string;
  readonly onRetry?: (message: Message) => void;
  /** 再送せずに失敗した配信を取り消す */
  readonly onCancel?: (message: Message) => void;
  /** 失敗した配信の片付け（再送後の削除・取り消し）リクエスト中か */
  readonly dismissing?: boolean;
  /**
   * 本文に書かれたファイルパスを開く。
   * 相対パスの基準になるエージェントも一緒に渡す。
   */
  readonly onOpenFile?: (filePath: string, agentId?: string) => void;
}

/** 1 通のメッセージ */
export const MessageItem = ({
  message,
  agentName,
  onRetry,
  onCancel,
  dismissing = false,
  onOpenFile,
}: MessageItemProps) => {
  const fromMe = isOutgoingMessage(message);
  // やり取りは「自分 ↔ エージェント」なので、向きだけで差出人と宛先が決まる
  const agents = message.agentIds.map(agentName).join(', ');
  const from = fromMe ? '自分' : agents;
  const to = fromMe ? agents : '自分';
  // 本文のパスは、やり取りしているエージェントの作業ディレクトリから辿る
  const baseAgentId = message.agentIds[0];

  return (
    <article
      className={`${styles.message} ${fromMe ? styles.fromMe : ''}`}
      aria-label={`${from} からのメッセージ`}
    >
      <header className={styles.header}>
        <div className={styles.route}>
          <span className={styles.from}>{from}</span>
          <span className={styles.arrow}>→</span>
          <span className={styles.to}>{to}</span>
          {!message.read && message.status === 'received' && (
            <span className={`${styles.badge} ${styles.unreadBadge}`}>未読</span>
          )}
        </div>
        <div className={styles.meta}>
          <span
            className={`${styles.badge} ${
              fromMe ? styles.sentBadge : styles.receivedBadge
            }`}
          >
            {fromMe ? '送信' : '受信'}
          </span>
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
            失敗しました: {message.error}
          </span>
          <div className={styles.failureActions}>
            {onRetry && (
              <button
                type="button"
                className={styles.retryButton}
                onClick={() => onRetry(message)}
                disabled={dismissing}
              >
                <Icon name="retry" size={13} />
                再送
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => onCancel(message)}
                disabled={dismissing}
              >
                {dismissing ? <Spinner /> : <Icon name="close" size={13} />}
                キャンセル
              </button>
            )}
          </div>
        </div>
      ) : message.status === 'pending' ? (
        <p className={styles.pending}>
          <Spinner /> 対応中…
        </p>
      ) : (
        <>
          <div className={styles.body}>
            <MarkdownBody
              body={message.body}
              onOpenFile={
                onOpenFile
                  ? (filePath) => onOpenFile(filePath, baseAgentId)
                  : undefined
              }
            />
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
