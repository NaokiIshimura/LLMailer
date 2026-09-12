'use client';

import { useCallback, useState } from 'react';
import type { DirectoryListing } from '@/lib/directories/types';
import { useJsonResource } from './useJsonResource';

export interface UseDirectoryBrowserResult {
  readonly listing: DirectoryListing | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** 指定のディレクトリへ移動する */
  readonly open: (target: string) => void;
}

/**
 * ディレクトリを 1 階層ずつ辿る。
 *
 * 表示中のパスは state で持ち、実際の一覧取得は URL 経由のフックに任せる。
 */
export const useDirectoryBrowser = (
  initialPath: string
): UseDirectoryBrowserResult => {
  const [current, setCurrent] = useState(initialPath);
  const { data, loading, error } = useJsonResource<{
    readonly listing: DirectoryListing;
  }>(`/api/directories?path=${encodeURIComponent(current)}`);

  const open = useCallback((target: string) => {
    setCurrent(target);
  }, []);

  return { listing: data?.listing ?? null, loading, error, open };
};
