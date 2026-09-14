'use client';

import { useCallback, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';

export interface UseDeleteMessageResult {
  /** 削除リクエスト中か */
  readonly deleting: boolean;
  readonly error: string | null;
  /** 削除できたら true。失敗したときは error に理由が入る */
  readonly remove: (messageId: string) => Promise<boolean>;
}

/**
 * 保存済みのメッセージを削除する。
 *
 * 送受信のやり取りは記録として残すので、消すのは下書きだけ
 * （失敗・中断の片付けは、記録を残す取り消しで行う）。
 */
export const useDeleteMessage = (): UseDeleteMessageResult => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async (messageId: string): Promise<boolean> => {
    setDeleting(true);
    setError(null);

    try {
      await fetchJson(`/api/messages/${messageId}`, { method: 'DELETE' });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      setDeleting(false);
    }
  }, []);

  return { deleting, error, remove };
};
