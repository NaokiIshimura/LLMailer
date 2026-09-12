'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJson } from '@/lib/api/fetchJson';

interface Snapshot<T> {
  /** どのリクエストの結果か（URL とリロード回数の組） */
  readonly key: string;
  readonly data: T | null;
  readonly error: string | null;
}

export interface JsonResource<T> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** 参照が変わらない安定した関数（effect の依存に入れても再実行を招かない） */
  readonly reload: () => void;
}

/**
 * URL から JSON を取得する共通フック。
 *
 * loading は「現在のリクエストキーの結果が届いているか」から導出する。
 * こうすることで effect 内で同期的に setState する必要がなくなる。
 *
 * 再取得中は直前の結果を data として返し続ける（表示が空に戻らないようにする）。
 * url に null を渡すと取得しない。
 */
export const useJsonResource = <T>(url: string | null): JsonResource<T> => {
  const [reloadCount, setReloadCount] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);

  const key = url === null ? '' : `${url}#${reloadCount}`;

  useEffect(() => {
    if (url === null) {
      return;
    }

    let cancelled = false;
    const run = async (): Promise<void> => {
      try {
        const data = await fetchJson<T>(url);
        if (!cancelled) {
          setSnapshot({ key, data, error: null });
        }
      } catch (cause) {
        if (!cancelled) {
          setSnapshot({
            key,
            data: null,
            error: cause instanceof Error ? cause.message : String(cause),
          });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [key, url]);

  // setReloadCount は不変なので、reload の参照も常に同じになる
  const reload = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  const current = snapshot?.key === key ? snapshot : null;

  /**
   * 同じ URL を再取得している間だけ、直前の結果を見せ続ける。
   * URL 自体が変わったとき（別スレッドを選んだときなど）は前の内容を残さない。
   */
  const staleForSameUrl =
    url !== null && snapshot?.key.startsWith(`${url}#`) ? snapshot : null;

  return useMemo(
    () => ({
      data: current?.data ?? staleForSameUrl?.data ?? null,
      loading: url !== null && current === null,
      error: current?.error ?? null,
      reload,
    }),
    [current, staleForSameUrl, url, reload]
  );
};
