'use client';

import { useCallback, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';
import type { SendMessageRequest, SendMessageResponse } from '@/types/mail';

export interface UseSendMessageResult {
  /** 送信リクエスト中か（配信の完了待ちではない） */
  readonly sending: boolean;
  readonly error: string | null;
  readonly send: (request: SendMessageRequest) => Promise<SendMessageResponse | null>;
  readonly clearError: () => void;
}

/**
 * メッセージを送信する。
 *
 * サーバーは送信と「対応中」を保存した時点で応答するため、このリクエストはすぐ終わる。
 * 以降の「対応中」は保存済みのメッセージから読み出すので、
 * ブラウザのメモリに依存せず、リロードしても消えない。
 */
export const useSendMessage = (): UseSendMessageResult => {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (request: SendMessageRequest): Promise<SendMessageResponse | null> => {
      setSending(true);
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
        setSending(false);
      }
    },
    []
  );

  return {
    sending,
    error,
    send,
    clearError: useCallback(() => setError(null), []),
  };
};
