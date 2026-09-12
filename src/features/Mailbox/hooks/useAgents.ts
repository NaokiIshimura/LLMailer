'use client';

import type { Agent } from '@/types/mail';
import { useJsonResource } from './useJsonResource';

interface AgentsResponse {
  readonly agents: readonly Agent[];
}

export interface UseAgentsResult {
  readonly agents: readonly Agent[];
  readonly loading: boolean;
  readonly error: string | null;
}

/** アドレス帳（エージェント一覧）を取得する */
export const useAgents = (): UseAgentsResult => {
  const resource = useJsonResource<AgentsResponse>('/api/agents');

  return {
    agents: resource.data?.agents ?? [],
    loading: resource.loading,
    error: resource.error,
  };
};
