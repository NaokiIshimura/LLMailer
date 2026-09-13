'use client';

import { useCallback, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';

export interface UseArchiveThreadResult {
  /** アーカイブの切り替えリクエスト中か */
  readonly archiving: boolean;
  readonly error: string | null;
  /** 切り替えられたら true。失敗したときは error に理由が入る */
  readonly setArchived: (
    threadId: string,
    archived: boolean
  ) => Promise<boolean>;
}

/**
 * 対応が済んだスレッドをアーカイブする（解除もここで行う）。
 *
 * 削除ではないので、アーカイブしてもやり取りは残り、アーカイブフォルダから読める。
 */
export const useArchiveThread = (): UseArchiveThreadResult => {
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setArchived = useCallback(
    async (threadId: string, archived: boolean): Promise<boolean> => {
      setArchiving(true);
      setError(null);

      try {
        await fetchJson(`/api/threads/${threadId}`, {
          method: 'PATCH',
          body: JSON.stringify({ archived }),
        });
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        return false;
      } finally {
        setArchiving(false);
      }
    },
    []
  );

  return { archiving, error, setArchived };
};
