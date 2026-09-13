'use client';

import type { ListedAgent } from '@/types/mail';
import { useJsonResource } from './useJsonResource';

interface AgentsResponse {
  readonly agents: readonly ListedAgent[];
}

export interface UseAgentsResult {
  readonly agents: readonly ListedAgent[];
  readonly loading: boolean;
  readonly error: string | null;
  /** 追加・変更・削除のあとに取り直す */
  readonly reload: () => void;
}

/** アドレス帳（エージェント一覧）を取得する */
export const useAgents = (): UseAgentsResult => {
  const resource = useJsonResource<AgentsResponse>('/api/agents');

  return {
    agents: resource.data?.agents ?? [],
    loading: resource.loading,
    error: resource.error,
    reload: resource.reload,
  };
};
