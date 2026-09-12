import { DEFAULT_AGENTS, isDefaultAgentAddress } from '@/lib/agents/defaultAgents';
import type { Agent, UpdateAgentRequest } from '@/types/mail';
import { readJsonFile, updateJsonFile } from './jsonFile';

const FILE_NAME = 'agents.json';

/**
 * 追加・変更・削除が行えなかった理由。
 * 'protected' は既定のエージェントを触ろうとした場合。
 */
export type AgentMutationError = 'notFound' | 'duplicate' | 'protected';

export type AgentMutation<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AgentMutationError };

export const listAgents = async (): Promise<readonly Agent[]> =>
  readJsonFile<readonly Agent[]>(FILE_NAME, DEFAULT_AGENTS);

export const findAgent = async (address: string): Promise<Agent | undefined> => {
  const agents = await listAgents();
  return agents.find((agent) => agent.address === address);
};

/**
 * エージェントを追加する。
 *
 * 重複の検査を書き込みと同じ更新内で行い、
 * 同時リクエストで同じアドレスが 2 件できるのを防ぐ。
 */
export const createAgent = async (
  agent: Agent
): Promise<AgentMutation<Agent>> => {
  if (isDefaultAgentAddress(agent.address)) {
    return { ok: false, error: 'protected' };
  }

  return updateJsonFile<readonly Agent[], AgentMutation<Agent>>(
    FILE_NAME,
    DEFAULT_AGENTS,
    (current) => {
      if (current.some((item) => item.address === agent.address)) {
        return { next: current, result: { ok: false, error: 'duplicate' } };
      }
      return {
        next: [...current, agent],
        result: { ok: true, value: agent },
      };
    }
  );
};

/** エージェントの設定を書き換える（アドレスは変更しない） */
export const updateAgent = async (
  address: string,
  patch: UpdateAgentRequest
): Promise<AgentMutation<Agent>> => {
  if (isDefaultAgentAddress(address)) {
    return { ok: false, error: 'protected' };
  }

  return updateJsonFile<readonly Agent[], AgentMutation<Agent>>(
    FILE_NAME,
    DEFAULT_AGENTS,
    (current) => {
      if (!current.some((item) => item.address === address)) {
        return { next: current, result: { ok: false, error: 'notFound' } };
      }
      const updated: Agent = { ...patch, address };
      return {
        next: current.map((item) => (item.address === address ? updated : item)),
        result: { ok: true, value: updated },
      };
    }
  );
};

/** エージェントを削除する（送受信済みのメッセージは残る） */
export const deleteAgent = async (
  address: string
): Promise<AgentMutation<null>> => {
  if (isDefaultAgentAddress(address)) {
    return { ok: false, error: 'protected' };
  }

  return updateJsonFile<readonly Agent[], AgentMutation<null>>(
    FILE_NAME,
    DEFAULT_AGENTS,
    (current) => {
      if (!current.some((item) => item.address === address)) {
        return { next: current, result: { ok: false, error: 'notFound' } };
      }
      return {
        next: current.filter((item) => item.address !== address),
        result: { ok: true, value: null },
      };
    }
  );
};
