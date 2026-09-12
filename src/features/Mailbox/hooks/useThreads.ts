'use client';

import { useCallback, useState } from 'react';
import type { Folder, Message, Thread } from '@/types/mail';
import { useJsonResource } from './useJsonResource';

interface ThreadsResponse {
  readonly threads: readonly Thread[];
  readonly drafts: readonly Message[];
  readonly unreadCount: number;
  /** 宛先ごとの未読件数（エージェント ID → 件数） */
  readonly agentUnreadCounts: Readonly<Record<string, number>>;
  /** 対応中（応答待ち）の件数 */
  readonly pendingCount: number;
  readonly draftCount: number;
}

/** 宛先ごとの未読件数。取得前は空にしておく */
const NO_AGENT_UNREAD_COUNTS: Readonly<Record<string, number>> = {};

export interface UseThreadsResult {
  readonly folder: Folder;
  /** 宛先で絞り込んでいるエージェント ID（絞り込んでいなければ null） */
  readonly agentId: string | null;
  readonly query: string;
  readonly threads: readonly Thread[];
  readonly drafts: readonly Message[];
  readonly unreadCount: number;
  readonly agentUnreadCounts: Readonly<Record<string, number>>;
  readonly pendingCount: number;
  readonly draftCount: number;
  readonly loading: boolean;
  readonly error: string | null;
  readonly selectFolder: (folder: Folder) => void;
  /** 宛先 1 件のメール一覧に切り替える */
  readonly selectAgent: (agentId: string) => void;
  readonly changeQuery: (query: string) => void;
  readonly reload: () => void;
}

const buildUrl = (
  folder: Folder,
  agentId: string | null,
  query: string
): string => {
  const params = new URLSearchParams({ folder });
  if (agentId) {
    params.set('agentId', agentId);
  }
  if (query) {
    params.set('q', query);
  }
  return `/api/threads?${params}`;
};

/** フォルダ・宛先・検索条件に応じたスレッド一覧を取得する */
export const useThreads = (): UseThreadsResult => {
  const [folder, setFolder] = useState<Folder>('home');
  /** 宛先ごとの一覧を出しているときだけ入る */
  const [agentId, setAgentId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const resource = useJsonResource<ThreadsResponse>(
    buildUrl(folder, agentId, query)
  );

  // フォルダごとに検索対象が変わるため、切り替え時は条件を持ち越さない
  const selectFolder = useCallback((next: Folder) => {
    setFolder(next);
    setAgentId(null);
    setQuery('');
  }, []);

  // 宛先ごとの一覧は、メールボックスをその宛先で絞り込んだもの
  const selectAgent = useCallback((next: string) => {
    setFolder('mailbox');
    setAgentId(next);
    setQuery('');
  }, []);

  return {
    folder,
    agentId,
    query,
    threads: resource.data?.threads ?? [],
    drafts: resource.data?.drafts ?? [],
    unreadCount: resource.data?.unreadCount ?? 0,
    agentUnreadCounts:
      resource.data?.agentUnreadCounts ?? NO_AGENT_UNREAD_COUNTS,
    pendingCount: resource.data?.pendingCount ?? 0,
    draftCount: resource.data?.draftCount ?? 0,
    loading: resource.loading,
    error: resource.error,
    selectFolder,
    selectAgent,
    changeQuery: setQuery,
    // 安定した参照をそのまま渡す（包み直すと参照が変わり、呼び出し側の effect が再実行される）
    reload: resource.reload,
  };
};
