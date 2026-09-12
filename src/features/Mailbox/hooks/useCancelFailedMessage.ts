'use client';

import { useCallback, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';

export interface UseCancelFailedMessageResult {
  /** 取り消しリクエスト中か */
  readonly canceling: boolean;
  readonly error: string | null;
  /** 取り消せたら true。失敗したときは error に理由が入る */
  readonly cancel: (messageId: string) => Promise<boolean>;
}

/**
 * 配信に失敗したメッセージを取り消す（保存済みのメッセージごと消す）。
 *
 * 再送しない限り「送信に失敗しました」が残り続けてしまうため、
 * 失敗の通知だけを取り下げる手段として用意している。
 */
export const useCancelFailedMessage = (): UseCancelFailedMessageResult => {
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = useCallback(async (messageId: string): Promise<boolean> => {
    setCanceling(true);
    setError(null);

    try {
      await fetchJson(`/api/messages/${messageId}`, { method: 'DELETE' });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      setCanceling(false);
    }
  }, []);

  return { canceling, error, cancel };
};
