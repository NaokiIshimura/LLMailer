'use client';

import { Fragment, useRef, useState } from 'react';
import {
  isUnansweredMessage,
  THREAD_SUBJECT_MAX_LENGTH,
  type Message,
  type Thread,
} from '@/types/mail';
import { useExitTransition, useMarkReadOnInteraction } from '../../hooks';
import { Icon } from '../Icon';
import { Spinner } from '../Loader';
import { MessageItem } from '../MessageItem';
import styles from './ThreadView.module.css';

interface ThreadViewProps {
  readonly thread: Thread | null;
  /** 「送信とその返信」のまとまり。新しいものが先頭 */
  readonly exchanges: readonly (readonly Message[])[];
  /** 開いたあとに届いた、まだ読んでいない返信の件数 */
  readonly newReplyCount: number;
  readonly loading: boolean;
  readonly error: string | null;
  /** エージェント ID → 表示名 */
  readonly agentName: (agentId: string) => string;
  readonly onReply: () => void;
  /** 届いたことに気づいた返信を既読にする */
  readonly onMarkRead: () => void;
  readonly onRetry: (failed: Message) => void;
  /** 再送せずに、返信を得られなかった配信（失敗・中断）を取り消す */
  readonly onDismiss: (unanswered: Message) => void;
  /** 返信を得られなかった配信の取り消しリクエスト中か */
  readonly dismissing: boolean;
  /** 対応中の配信を中断する */
  readonly onCancelDelivery: (pending: Message) => void;
  /** 中断リクエスト中か */
  readonly canceling: boolean;
  /** 対応が済んだスレッドを片付ける（アーカイブ済みなら解除する） */
  readonly onArchive: (archived: boolean) => void;
  /** アーカイブの切り替えリクエスト中か */
  readonly archiving: boolean;
  /** スレッドのお題を変える。保存前のスレッドでは渡されない（変更できない） */
  readonly onRename?: (subject: string) => void;
  /** 件名の変更リクエスト中か */
  readonly renaming: boolean;
  /** 本文に書かれたファイルパスをビューアで開く */
  readonly onOpenFile: (filePath: string, agentId?: string) => void;
}

/** スレッド本文 */
export const ThreadView = ({
  thread,
  exchanges,
  newReplyCount,
  loading,
  error,
  agentName,
  onReply,
  onMarkRead,
  onRetry,
  onDismiss,
  dismissing,
  onCancelDelivery,
  canceling,
  onArchive,
  archiving,
  onRename,
  renaming,
  onOpenFile,
}: ThreadViewProps) => {
  /** 件名の編集中の値（null なら編集していない） */
  const [editedSubject, setEditedSubject] = useState<string | null>(null);
  /** Escape で取り消したあとに続く blur で、確定させないための目印 */
  const cancelledRef = useRef(false);

  // 知らせが出ているあいだは、本文を触った時点で読み始めたとみなして既読にする
  const { interactionRef, markRead } = useMarkReadOnInteraction(
    newReplyCount > 0,
    onMarkRead
  );

  // 知らせは既読にした時点で消えるので、消えるアニメーションのあいだだけ残す
  const newReplyExit = useExitTransition(newReplyCount > 0);

  // 消えていく途中で 0 件に変わってしまわないよう、届いた件数はそのまま出し続ける
  const [shownNewReplyCount, setShownNewReplyCount] = useState(newReplyCount);
  if (newReplyCount > 0 && newReplyCount !== shownNewReplyCount) {
    setShownNewReplyCount(newReplyCount);
  }

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

  const archiveLabel = thread.archived
    ? 'このスレッドをメールボックスへ戻す'
    : 'このスレッドをアーカイブする';

  const startRename = () => {
    cancelledRef.current = false;
    setEditedSubject(thread.subject);
  };

  /** 入力を閉じて確定する（変えていなければ何も送らない） */
  const commitRename = () => {
    const subject = editedSubject?.trim() ?? '';
    setEditedSubject(null);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    if (subject && subject !== thread.subject) {
      onRename?.(subject);
    }
  };

  const cancelRename = () => {
    cancelledRef.current = true;
    setEditedSubject(null);
  };

  return (
    <section className={styles.view} ref={interactionRef}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.subjectRow}>
            {editedSubject === null ? (
              <h1 className={styles.subject}>{thread.subject}</h1>
            ) : (
              /* Enter で確定できるよう、入力はフォームに入れておく */
              <form
                className={styles.subjectForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  commitRename();
                }}
              >
                <input
                  className={styles.subjectInput}
                  value={editedSubject}
                  maxLength={THREAD_SUBJECT_MAX_LENGTH}
                  autoFocus
                  aria-label="スレッドの件名"
                  onChange={(event) => setEditedSubject(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      cancelRename();
                    }
                  }}
                  onBlur={commitRename}
                />
              </form>
            )}
            {/*
              お題は後から変えられる（過去のやり取りの件名もまとめて変わる）。
              保存前のスレッドは変えられないため、そのときは出さない。
            */}
            {onRename && editedSubject === null && (
              <button
                type="button"
                className={styles.subjectButton}
                onClick={startRename}
                disabled={renaming}
                aria-label="スレッドの件名を変える"
                title="スレッドの件名を変える"
              >
                {renaming ? <Spinner /> : <Icon name="edit" size={16} />}
              </button>
            )}
            {/*
              対応が済んだスレッドを片付ける（アーカイブフォルダでは戻す）。
              返信の隣に置くと取り違えて押されるため、件名の横まで離す。
              対応中はまだ片付けられないため、そのあいだは出さない。
              件名を編集しているあいだも、入力を広く使えるように引っ込める。
            */}
            {!thread.hasPending && editedSubject === null && (
              <button
                type="button"
                className={styles.subjectButton}
                onClick={() => onArchive(!thread.archived)}
                disabled={archiving}
                aria-label={archiveLabel}
                title={archiveLabel}
              >
                {archiving ? (
                  <Spinner />
                ) : (
                  <Icon name={thread.archived ? 'inbox' : 'archive'} size={16} />
                )}
              </button>
            )}
          </div>
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

      {/*
        開いたままのスレッドに届いた返信は自動で既読にしないため、ここで気づけるようにする。
        席を外していても、戻ってきたときに未読が残っている。
        戻ってきて本文を触れば消えるが、押せば済むようにボタンも残しておく。
      */}
      {newReplyExit.visible && (
        <div
          className={`${styles.newReplyBar} ${
            newReplyExit.exiting ? styles.newReplyBarExiting : ''
          }`}
          onAnimationEnd={newReplyExit.handleAnimationEnd}
        >
          <span className={styles.newReplyText}>
            <Icon name="mail" size={14} />
            新しい返信が {shownNewReplyCount} 件届きました
          </span>
          <button
            type="button"
            className={styles.newReplyButton}
            onClick={markRead}
          >
            既読にする
          </button>
        </div>
      )}

      <div className={styles.messages}>
        {/* 対応中・中断の返信もメッセージの 1 通として並ぶ（MessageItem が表示を切り替える） */}
        {exchanges.map((exchange) => (
          <Fragment key={exchange[0].id}>
            {exchange.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                agentName={agentName}
                onRetry={isUnansweredMessage(message) ? onRetry : undefined}
                onDismiss={
                  isUnansweredMessage(message) ? onDismiss : undefined
                }
                dismissing={dismissing}
                onCancelDelivery={
                  message.status === 'pending' ? onCancelDelivery : undefined
                }
                canceling={canceling}
                onOpenFile={onOpenFile}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </section>
  );
};
