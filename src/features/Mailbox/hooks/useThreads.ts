'use client';

import { useCallback, useState } from 'react';
import type { Folder, Message, Thread } from '@/types/mail';
import { useJsonResource } from './useJsonResource';

interface ThreadsResponse {
  readonly threads: readonly Thread[];
  readonly drafts: readonly Message[];
  readonly unreadCount: number;
  readonly draftCount: number;
}

export interface UseThreadsResult {
  readonly folder: Folder;
  readonly query: string;
  readonly threads: readonly Thread[];
  readonly drafts: readonly Message[];
  readonly unreadCount: number;
  readonly draftCount: number;
  readonly loading: boolean;
  readonly error: string | null;
  readonly selectFolder: (folder: Folder) => void;
  readonly changeQuery: (query: string) => void;
  readonly reload: () => void;
}

const buildUrl = (folder: Folder, query: string): string => {
  const params = new URLSearchParams({ folder });
  if (query) {
    params.set('q', query);
  }
  return `/api/threads?${params}`;
};

/** フォルダ・検索条件に応じたスレッド一覧を取得する */
export const useThreads = (): UseThreadsResult => {
  const [folder, setFolder] = useState<Folder>('inbox');
  const [query, setQuery] = useState('');
  const resource = useJsonResource<ThreadsResponse>(buildUrl(folder, query));

  // フォルダごとに検索対象が変わるため、切り替え時は条件を持ち越さない
  const selectFolder = useCallback((next: Folder) => {
    setFolder(next);
    setQuery('');
  }, []);

  return {
    folder,
    query,
    threads: resource.data?.threads ?? [],
    drafts: resource.data?.drafts ?? [],
    unreadCount: resource.data?.unreadCount ?? 0,
    draftCount: resource.data?.draftCount ?? 0,
    loading: resource.loading,
    error: resource.error,
    selectFolder,
    changeQuery: setQuery,
    // 安定した参照をそのまま渡す（包み直すと参照が変わり、呼び出し側の effect が再実行される）
    reload: resource.reload,
  };
};
