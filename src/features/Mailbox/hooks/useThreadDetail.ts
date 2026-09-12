'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';
import type { Message, Thread } from '@/types/mail';
import { useJsonResource } from './useJsonResource';

interface ThreadDetailResponse {
  readonly thread: Thread;
  readonly messages: readonly Message[];
}

export interface UseThreadDetailResult {
  readonly thread: Thread | null;
  readonly messages: readonly Message[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly reload: () => void;
}

/**
 * 選択中スレッドのメッセージを取得し、開いたタイミングで既読にする。
 * 既読化のあとに onRead を呼び、一覧側の未読件数を更新させる。
 */
export const useThreadDetail = (
  threadId: string | null,
  onRead: () => void
): UseThreadDetailResult => {
  const resource = useJsonResource<ThreadDetailResponse>(
    threadId === null ? null : `/api/threads/${threadId}`
  );

  // onRead の参照が変わっても既読化をやり直さないよう、ref 経由で呼ぶ
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);

  /** 既読化を済ませたスレッドの状態（スレッド ID と最新メッセージの組） */
  const [markedKeys, setMarkedKeys] = useState<readonly string[]>([]);

  const loaded = resource.data;
  const unreadCount = loaded?.thread.unreadCount ?? 0;
  const lastMessageId = loaded?.messages[loaded.messages.length - 1]?.id;

  /**
   * 「このスレッドのこの状態」を表すキー。
   * 新しい返信が届くと変わるので、そのときは再び既読化する。
   */
  const markKey =
    threadId !== null && lastMessageId ? `${threadId}#${lastMessageId}` : null;
  const alreadyMarked = markKey !== null && markedKeys.includes(markKey);

  useEffect(() => {
    if (threadId === null || markKey === null || unreadCount === 0) {
      return;
    }
    if (alreadyMarked) {
      return;
    }

    let cancelled = false;
    const markAsRead = async (): Promise<void> => {
      try {
        await fetchJson(`/api/threads/${threadId}`, {
          method: 'PATCH',
          body: JSON.stringify({ read: true }),
        });
        if (cancelled) {
          return;
        }
        setMarkedKeys((current) =>
          current.includes(markKey) ? current : [...current, markKey]
        );
        onReadRef.current();
      } catch (cause) {
        // 既読化の失敗は本文の表示に影響しないため、ログだけ残す
        console.error('[llmailer] 既読化に失敗しました', cause);
      }
    };

    void markAsRead();

    return () => {
      cancelled = true;
    };
  }, [threadId, markKey, unreadCount, alreadyMarked]);

  const messages = useMemo((): readonly Message[] => {
    const list = loaded?.messages ?? [];
    if (!alreadyMarked) {
      return list;
    }
    return list.map((message) => ({ ...message, read: true }));
  }, [loaded, alreadyMarked]);

  return {
    thread: loaded?.thread ?? null,
    messages,
    loading: resource.loading,
    error: resource.error,
    reload: resource.reload,
  };
};
