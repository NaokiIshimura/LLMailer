'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';
import type { Message, Thread } from '@/types/mail';
import { useJsonResource } from './useJsonResource';

interface ThreadDetailResponse {
  readonly thread: Thread;
  readonly messages: readonly Message[];
}

/** 開いたときに既読へ倒したメッセージ。スレッドを開き直すと作り直す */
interface MarkedState {
  readonly threadId: string;
  readonly messageIds: readonly string[];
}

export interface UseThreadDetailResult {
  readonly thread: Thread | null;
  readonly messages: readonly Message[];
  /** 開いたあとに届いた、まだ読んでいない返信の件数 */
  readonly newReplyCount: number;
  readonly loading: boolean;
  readonly error: string | null;
  readonly reload: () => void;
  /** 開いたあとに届いた返信を、読んだものとして既読にする */
  readonly markRead: () => void;
}

const EMPTY_MESSAGES: readonly Message[] = [];
const NO_MARKED_IDS: ReadonlySet<string> = new Set();

/**
 * スレッドを既読にする。
 *
 * 既読化の失敗は本文の表示に影響しないため、投げ直さずに成否だけ返す。
 */
const requestMarkAsRead = async (threadId: string): Promise<boolean> => {
  try {
    await fetchJson(`/api/threads/${threadId}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    });
    return true;
  } catch (cause) {
    console.error('[llmailer] 既読化に失敗しました', cause);
    return false;
  }
};

/**
 * 選択中スレッドのメッセージを取得し、開いたタイミングで既読にする。
 * 既読化のあとに onRead を呼び、一覧側の未読件数を更新させる。
 *
 * 自動で既読にするのは、開いた時点で届いていたぶんだけ。
 * 開いたまま席を外したあいだに届いた返信は未読のまま残し、`newReplyCount` で知らせる
 * （気づかないうちに既読になり、未読件数からも消えてしまうのを防ぐ）。
 * 読んだあとは `markRead` で既読にする。
 *
 * visible が false のあいだ（本文を表示しないホームやアドレス帳）は既読にしない。
 * 読んでいないメッセージが既読になり、未読件数に出なくなるのを防ぐ。
 */
export const useThreadDetail = (
  threadId: string | null,
  onRead: () => void,
  visible: boolean
): UseThreadDetailResult => {
  const resource = useJsonResource<ThreadDetailResponse>(
    threadId === null ? null : `/api/threads/${threadId}`
  );

  // onRead の参照が変わっても既読化をやり直さないよう、ref 経由で呼ぶ
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);

  const loaded = resource.data;

  // 既読にしたメッセージを控えるだけなので、取得のたびに既読化をやり直さないよう ref 経由で見る
  const messagesRef = useRef<readonly Message[]>(EMPTY_MESSAGES);
  useEffect(() => {
    messagesRef.current = loaded?.messages ?? EMPTY_MESSAGES;
  }, [loaded]);

  const [marked, setMarked] = useState<MarkedState | null>(null);

  const unreadCount = loaded?.thread.unreadCount ?? 0;
  /** 今開いているスレッドで、すでに既読化を済ませたか */
  const alreadyMarked = marked !== null && marked.threadId === threadId;

  /** 今のメッセージをすべて既読にして、一覧側へも知らせる */
  const markRead = useCallback(async (): Promise<void> => {
    if (threadId === null) {
      return;
    }

    const messageIds = messagesRef.current.map((message) => message.id);
    if (!(await requestMarkAsRead(threadId))) {
      return;
    }

    setMarked({ threadId, messageIds });
    onReadRef.current();
  }, [threadId]);

  useEffect(() => {
    if (!visible || threadId === null || unreadCount === 0 || alreadyMarked) {
      return;
    }

    let cancelled = false;
    const markOnOpen = async (): Promise<void> => {
      const messageIds = messagesRef.current.map((message) => message.id);
      if (!(await requestMarkAsRead(threadId)) || cancelled) {
        return;
      }

      setMarked({ threadId, messageIds });
      onReadRef.current();
    };

    void markOnOpen();

    return () => {
      cancelled = true;
    };
  }, [visible, threadId, unreadCount, alreadyMarked]);

  /** 既読にしたぶんの ID。再取得された古い未読を読み替えるために使う */
  const markedIds = useMemo((): ReadonlySet<string> => {
    if (marked === null || marked.threadId !== threadId) {
      return NO_MARKED_IDS;
    }
    return new Set(marked.messageIds);
  }, [marked, threadId]);

  // 既読化の結果が取得し直されるまでのあいだ、控えのぶんだけ既読として見せる
  const messages = useMemo((): readonly Message[] => {
    const list = loaded?.messages ?? EMPTY_MESSAGES;
    if (markedIds.size === 0) {
      return list;
    }
    return list.map((message) =>
      markedIds.has(message.id) ? { ...message, read: true } : message
    );
  }, [loaded, markedIds]);

  /**
   * 開いたあとに届いた未読の返信。
   *
   * 既読化を済ませる前は、開いた時点のぶんと区別できないため数えない
   * （開いた直後に「新しい返信」と出てしまうのを防ぐ）。
   */
  const newReplyCount = useMemo((): number => {
    if (!alreadyMarked) {
      return 0;
    }
    return messages.filter(
      (message) => !message.read && message.status === 'received'
    ).length;
  }, [alreadyMarked, messages]);

  return {
    thread: loaded?.thread ?? null,
    messages,
    newReplyCount,
    loading: resource.loading,
    error: resource.error,
    reload: resource.reload,
    markRead: useCallback(() => {
      void markRead();
    }, [markRead]),
  };
};
