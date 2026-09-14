'use client';

import { useCallback, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';

export interface UseCancelDeliveryResult {
  /** 中断リクエスト中か */
  readonly canceling: boolean;
  readonly error: string | null;
  /** 中断できたら true。失敗したときは error に理由が入る */
  readonly cancel: (messageId: string) => Promise<boolean>;
}

/**
 * 対応中の配信を中断する。
 *
 * 配信はサーバー側で続いているため、止められるのもサーバーだけ。
 * 中断した 1 通は「中断」として残るので、指示を直してから再送できる。
 */
export const useCancelDelivery = (): UseCancelDeliveryResult => {
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = useCallback(async (messageId: string): Promise<boolean> => {
    setCanceling(true);
    setError(null);

    try {
      await fetchJson(`/api/messages/${messageId}/cancel`, { method: 'POST' });
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
