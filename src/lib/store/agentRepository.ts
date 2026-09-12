import { randomUUID } from 'node:crypto';
import { DEFAULT_AGENTS, isDefaultAgentId } from '@/lib/agents/defaultAgents';
import type { Agent, CreateAgentRequest, UpdateAgentRequest } from '@/types/mail';
import { legacyAddressToAgentId } from './legacy';
import { readJsonFile, updateJsonFile } from './jsonFile';

const FILE_NAME = 'agents.json';

/**
 * 追加・変更・削除が行えなかった理由。
 * 'protected' は既定のエージェントを触ろうとした場合、
 * 'duplicateName' は同じ名前のエージェントが既に居る場合。
 */
export type AgentMutationError = 'notFound' | 'protected' | 'duplicateName';

export type AgentMutation<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AgentMutationError };

/** アドレスで保存されていた頃のエージェント（ID を持たない） */
type StoredAgent = Omit<Agent, 'id'> & {
  readonly id?: string;
  readonly address?: string;
};

/**
 * 保存済みのエージェントを読む（旧形式はアドレスから ID を作る）。
 *
 * ID は JSON をそのまま読んだときに分かりやすいよう、常に先頭へ置き直す。
 */
const toAgent = ({ address, id, ...agent }: StoredAgent): Agent => ({
  id: id ?? (address ? legacyAddressToAgentId(address) : randomUUID()),
  ...agent,
});

const toAgents = (stored: readonly StoredAgent[]): readonly Agent[] =>
  stored.map(toAgent);

/**
 * 同じ名前のエージェントが既に居るか。
 *
 * アドレスが無くなり、画面で宛先を見分ける手がかりは名前だけになった。
 * 同名を許すと「どちらの作業担当に出したのか」が分からなくなるため、ここで弾く。
 */
const hasSameName = (
  agents: readonly Agent[],
  name: string,
  exceptId?: string
): boolean =>
  agents.some((agent) => agent.id !== exceptId && agent.name === name);

export const listAgents = async (): Promise<readonly Agent[]> =>
  toAgents(await readJsonFile<readonly StoredAgent[]>(FILE_NAME, DEFAULT_AGENTS));

export const findAgent = async (id: string): Promise<Agent | undefined> => {
  const agents = await listAgents();
  return agents.find((agent) => agent.id === id);
};

/**
 * エージェントを追加する。
 *
 * ID は利用者に入力させず、ここで採番する。
 * 送受信済みメッセージから参照されるだけなので、一意であること以外に求めるものはない。
 */
export const createAgent = async (
  fields: CreateAgentRequest
): Promise<AgentMutation<Agent>> =>
  updateJsonFile<readonly StoredAgent[], AgentMutation<Agent>>(
    FILE_NAME,
    DEFAULT_AGENTS,
    (stored) => {
      const current = toAgents(stored);
      if (hasSameName(current, fields.name)) {
        return { next: stored, result: { ok: false, error: 'duplicateName' } };
      }
      // JSON をそのまま読んだときに分かりやすいよう、ID は先頭に置く
      const agent: Agent = { id: randomUUID(), ...fields };
      return {
        next: [...current, agent],
        result: { ok: true, value: agent },
      };
    }
  );

/** エージェントの設定を書き換える（ID は変更しない） */
export const updateAgent = async (
  id: string,
  patch: UpdateAgentRequest
): Promise<AgentMutation<Agent>> => {
  if (isDefaultAgentId(id)) {
    return { ok: false, error: 'protected' };
  }

  return updateJsonFile<readonly StoredAgent[], AgentMutation<Agent>>(
    FILE_NAME,
    DEFAULT_AGENTS,
    (stored) => {
      const current = toAgents(stored);
      if (!current.some((item) => item.id === id)) {
        return { next: stored, result: { ok: false, error: 'notFound' } };
      }
      if (hasSameName(current, patch.name, id)) {
        return { next: stored, result: { ok: false, error: 'duplicateName' } };
      }
      const updated: Agent = { id, ...patch };
      return {
        next: current.map((item) => (item.id === id ? updated : item)),
        result: { ok: true, value: updated },
      };
    }
  );
};

/** エージェントを削除する（送受信済みのメッセージは残る） */
export const deleteAgent = async (id: string): Promise<AgentMutation<null>> => {
  if (isDefaultAgentId(id)) {
    return { ok: false, error: 'protected' };
  }

  return updateJsonFile<readonly StoredAgent[], AgentMutation<null>>(
    FILE_NAME,
    DEFAULT_AGENTS,
    (stored) => {
      const current = toAgents(stored);
      if (!current.some((item) => item.id === id)) {
        return { next: stored, result: { ok: false, error: 'notFound' } };
      }
      return {
        next: current.filter((item) => item.id !== id),
        result: { ok: true, value: null },
      };
    }
  );
};
