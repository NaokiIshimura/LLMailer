'use client';

import {
  formatCost,
  formatDateTime,
  formatDuration,
  formatTokens,
} from '@/lib/format';
import {
  isOutgoingMessage,
  isSettledMessage,
  isUnansweredMessage,
  type Message,
} from '@/types/mail';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import { MarkdownBody } from '../MarkdownBody';
import styles from './MessageItem.module.css';

interface MessageItemProps {
  readonly message: Message;
  /** エージェント ID → 表示名 */
  readonly agentName: (agentId: string) => string;
  readonly onRetry?: (message: Message) => void;
  /** 再送せずに、返信を得られなかった配信（失敗・中断）を取り消す */
  readonly onDismiss?: (message: Message) => void;
  /** 返信を得られなかった配信の取り消しリクエスト中か */
  readonly dismissing?: boolean;
  /** 対応中の配信を中断する */
  readonly onCancelDelivery?: (message: Message) => void;
  /** 中断リクエスト中か */
  readonly canceling?: boolean;
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
  onDismiss,
  dismissing = false,
  onCancelDelivery,
  canceling = false,
  onOpenFile,
}: MessageItemProps) => {
  const fromMe = isOutgoingMessage(message);
  // 再送・取り消しで済んだ失敗・中断は、記録として残すだけで手は加えさせない
  const settled = isSettledMessage(message);
  const settledAt = message.resentAt ?? message.dismissedAt;
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

      {isUnansweredMessage(message) ? (
        /* 失敗も中断も本文が無いまま残るので、同じ形で理由と片付け方を出す */
        <div
          className={`${styles.failure} ${
            message.status === 'canceled' ? styles.canceled : ''
          } ${settled ? styles.settled : ''}`}
        >
          <span className={styles.failureText}>
            <Icon
              name={message.status === 'canceled' ? 'close' : 'warning'}
              size={15}
            />
            {message.status === 'canceled'
              ? '中断しました'
              : `失敗しました: ${message.error}`}
          </span>
          {/*
            片付けたあとは、どう対応したかの記録だけを残す。
            何があったのかを読めるようにするためなので、消す手段は出さない。
          */}
          {settled ? (
            <span className={styles.settledNote}>
              <Icon name={message.resentAt ? 'retry' : 'close'} size={13} />
              {settledAt && `${formatDateTime(settledAt)} に`}
              {message.resentAt ? '再送' : '取り消'}しました
            </span>
          ) : (
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
              {onDismiss && (
                <button
                  type="button"
                  className={styles.quietButton}
                  onClick={() => onDismiss(message)}
                  disabled={dismissing}
                >
                  {dismissing ? <Spinner /> : <Icon name="close" size={13} />}
                  取り消し
                </button>
              )}
            </div>
          )}
        </div>
      ) : message.status === 'pending' ? (
        <div className={styles.pending}>
          <span className={styles.pendingText}>
            <Spinner /> 対応中…
          </span>
          {/* 配信はサーバー側で続いているので、止められるのもサーバーだけ */}
          {onCancelDelivery && (
            <button
              type="button"
              className={styles.quietButton}
              onClick={() => onCancelDelivery(message)}
              disabled={canceling}
            >
              {canceling ? <Spinner /> : <Icon name="close" size={13} />}
              中断
            </button>
          )}
        </div>
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
