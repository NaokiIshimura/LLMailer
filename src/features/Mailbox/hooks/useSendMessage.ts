'use client';

import { useCallback, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';
import type { SendMessageRequest, SendMessageResponse } from '@/types/mail';

/** 配信中の送信（UI に「配信中…」を表示するための一時状態） */
export interface PendingDelivery {
  readonly id: string;
  readonly threadId: string | null;
  readonly to: readonly string[];
  readonly subject: string;
  readonly body: string;
  /** 送信を開始した時刻（サーバー保存前の楽観表示に使う） */
  readonly createdAt: string;
}

export interface UseSendMessageResult {
  /** 配信中の送信一覧。1 件以上ならローダーを表示する */
  readonly pendingDeliveries: readonly PendingDelivery[];
  readonly sending: boolean;
  readonly error: string | null;
  readonly send: (request: SendMessageRequest) => Promise<SendMessageResponse | null>;
  readonly clearError: () => void;
}

/**
 * メッセージを送信する。
 * 進行中の送信を保持し、成功・失敗いずれの場合も必ず取り除く（ローダーが残らないようにする）。
 */
export const useSendMessage = (): UseSendMessageResult => {
  const [pendingDeliveries, setPendingDeliveries] = useState<
    readonly PendingDelivery[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (request: SendMessageRequest): Promise<SendMessageResponse | null> => {
      const pending: PendingDelivery = {
        id: crypto.randomUUID(),
        threadId: request.threadId ?? null,
        to: request.to,
        subject: request.subject,
        body: request.body,
        createdAt: new Date().toISOString(),
      };
      setPendingDeliveries((current) => [...current, pending]);
      setError(null);

      try {
        return await fetchJson<SendMessageResponse>('/api/messages', {
          method: 'POST',
          body: JSON.stringify(request),
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        return null;
      } finally {
        setPendingDeliveries((current) =>
          current.filter((item) => item.id !== pending.id)
        );
      }
    },
    []
  );

  return {
    pendingDeliveries,
    sending: pendingDeliveries.length > 0,
    error,
    send,
    clearError: useCallback(() => setError(null), []),
  };
};
