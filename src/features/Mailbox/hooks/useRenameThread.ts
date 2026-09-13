'use client';

import { useCallback, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';

export interface UseRenameThreadResult {
  /** 件名の変更リクエスト中か */
  readonly renaming: boolean;
  readonly error: string | null;
  /** 変えられたら true。失敗したときは error に理由が入る */
  readonly rename: (threadId: string, subject: string) => Promise<boolean>;
}

/**
 * スレッドのお題を変える。
 *
 * 件名はスレッドが 1 つだけ持つので、変えると過去のやり取りの表示も、
 * 次の配信でエージェントへ伝わる件名も、まとめて新しいものになる。
 */
export const useRenameThread = (): UseRenameThreadResult => {
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rename = useCallback(
    async (threadId: string, subject: string): Promise<boolean> => {
      setRenaming(true);
      setError(null);

      try {
        await fetchJson(`/api/threads/${threadId}`, {
          method: 'PATCH',
          body: JSON.stringify({ subject }),
        });
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        return false;
      } finally {
        setRenaming(false);
      }
    },
    []
  );

  return { renaming, error, rename };
};
