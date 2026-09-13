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
  /** 宛先ごとの対応中件数（エージェント ID → 件数） */
  readonly agentPendingCounts: Readonly<Record<string, number>>;
  /** 受信（エージェントの返信）の件数 */
  readonly receivedCount: number;
  readonly draftCount: number;
}

/** 宛先ごとの件数。取得前は空にしておく */
const NO_AGENT_COUNTS: Readonly<Record<string, number>> = {};

export interface UseThreadsResult {
  readonly folder: Folder;
  /** 宛先ごとの一覧を出しているメールボックスの識別子（出していなければ null） */
  readonly mailboxKey: string | null;
  /** 宛先で絞り込んでいるエージェント ID（絞り込んでいなければ空） */
  readonly agentIds: readonly string[];
  readonly query: string;
  readonly threads: readonly Thread[];
  readonly drafts: readonly Message[];
  readonly unreadCount: number;
  readonly agentUnreadCounts: Readonly<Record<string, number>>;
  readonly pendingCount: number;
  readonly agentPendingCounts: Readonly<Record<string, number>>;
  /** 受信の件数。まだ取得できていなければ null（返信が届いたかを判断できない） */
  readonly receivedCount: number | null;
  readonly draftCount: number;
  readonly loading: boolean;
  readonly error: string | null;
  readonly selectFolder: (folder: Folder) => void;
  /** 宛先ごとのメール一覧に切り替える（まとめたメールボックスでは宛先が複数） */
  readonly selectMailbox: (
    mailboxKey: string,
    agentIds: readonly string[]
  ) => void;
  readonly changeQuery: (query: string) => void;
  readonly reload: () => void;
}

const buildUrl = (
  folder: Folder,
  agentIds: readonly string[],
  query: string
): string => {
  const params = new URLSearchParams({ folder });
  // まとめたメールボックスは宛先が複数になるため、同じ名前で並べて渡す
  for (const agentId of agentIds) {
    params.append('agentId', agentId);
  }
  if (query) {
    params.set('q', query);
  }
  return `/api/threads?${params}`;
};

/** 宛先で絞り込んでいないときの指定。参照を変えないよう使い回す */
const NO_AGENT_IDS: readonly string[] = [];

/** フォルダ・宛先・検索条件に応じたスレッド一覧を取得する */
export const useThreads = (): UseThreadsResult => {
  const [folder, setFolder] = useState<Folder>('home');
  /** 宛先ごとの一覧を出しているときだけ入る */
  const [mailbox, setMailbox] = useState<{
    readonly key: string;
    readonly agentIds: readonly string[];
  } | null>(null);
  const [query, setQuery] = useState('');
  const agentIds = mailbox?.agentIds ?? NO_AGENT_IDS;
  const resource = useJsonResource<ThreadsResponse>(
    buildUrl(folder, agentIds, query)
  );

  // フォルダごとに検索対象が変わるため、切り替え時は条件を持ち越さない
  const selectFolder = useCallback((next: Folder) => {
    setFolder(next);
    setMailbox(null);
    setQuery('');
  }, []);

  // 宛先ごとの一覧は、メールボックスをその宛先で絞り込んだもの
  const selectMailbox = useCallback(
    (key: string, nextAgentIds: readonly string[]) => {
      setFolder('mailbox');
      setMailbox({ key, agentIds: nextAgentIds });
      setQuery('');
    },
    []
  );

  return {
    folder,
    mailboxKey: mailbox?.key ?? null,
    agentIds,
    query,
    threads: resource.data?.threads ?? [],
    drafts: resource.data?.drafts ?? [],
    unreadCount: resource.data?.unreadCount ?? 0,
    agentUnreadCounts: resource.data?.agentUnreadCounts ?? NO_AGENT_COUNTS,
    pendingCount: resource.data?.pendingCount ?? 0,
    agentPendingCounts: resource.data?.agentPendingCounts ?? NO_AGENT_COUNTS,
    // 0 で埋めると、初回の取得が「増えた」ことになってしまうため null のままにする
    receivedCount: resource.data?.receivedCount ?? null,
    draftCount: resource.data?.draftCount ?? 0,
    loading: resource.loading,
    error: resource.error,
    selectFolder,
    selectMailbox,
    changeQuery: setQuery,
    // 安定した参照をそのまま渡す（包み直すと参照が変わり、呼び出し側の effect が再実行される）
    reload: resource.reload,
  };
};
