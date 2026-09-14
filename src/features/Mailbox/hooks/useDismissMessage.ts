'use client';

import { useCallback, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';

export interface UseDismissMessageResult {
  /** 取り消しリクエスト中か */
  readonly dismissing: boolean;
  readonly error: string | null;
  /** 取り消せたら true。失敗したときは error に理由が入る */
  readonly dismiss: (messageId: string) => Promise<boolean>;
}

/**
 * 返信を得られなかった配信（失敗・中断）を、再送せずに取り消す。
 *
 * 取り消しても 1 通は消えず、「取り消しました」という記録として残る。
 * 失敗のラベルと未読から外れるだけなので、何があったかはあとから読める。
 */
export const useDismissMessage = (): UseDismissMessageResult => {
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dismiss = useCallback(async (messageId: string): Promise<boolean> => {
    setDismissing(true);
    setError(null);

    try {
      await fetchJson(`/api/messages/${messageId}/dismiss`, { method: 'POST' });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      setDismissing(false);
    }
  }, []);

  return { dismissing, error, dismiss };
};
