import { randomUUID } from 'node:crypto';
import type {
  Agent,
  CreateAgentRequest,
  ListedAgent,
  UpdateAgentRequest,
} from '@/types/mail';
import { legacyAddressToAgentId } from './legacy';
import { readJsonFileIfExists, updateJsonFile } from './jsonFile';

/**
 * デフォルトのエージェント。リポジトリに同梱し、読むだけで書き換えない。
 * アプリの土台として常に居てほしいので、画面からは変更・削除させない。
 */
const DEFAULT_FILE = 'agents/default.json';

/** 画面から追加したエージェント。CRUD の対象で、git には含めない */
const CUSTOM_FILE = 'agents/custom.json';

/**
 * custom.json より前の名前で保存されていたファイル（新しい順）。
 *
 * 'agents/user.json' は「利用者の情報」と読めてしまうため custom.json へ改めた。
 * 'agents.json' はデフォルトと利用者ぶんが 1 つになっていた頃のもの。
 * どちらも読み込み時に引き継ぐだけで、書き込みには使わない。
 */
const LEGACY_FILES: readonly string[] = ['agents/user.json', 'agents.json'];

/**
 * 追加・変更・削除が行えなかった理由。
 * 'protected' はデフォルトのエージェントを触ろうとした場合、
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

const readAgentFile = async (fileName: string): Promise<readonly Agent[]> =>
  toAgents(await readJsonFileIfExists<readonly StoredAgent[]>(fileName, []));

/** 以前の名前で保存されていたエージェントを、新しい名前のものから順に探す */
const readLegacyAgents = async (): Promise<readonly Agent[]> => {
  for (const fileName of LEGACY_FILES) {
    const stored = await readJsonFileIfExists<readonly StoredAgent[] | null>(
      fileName,
      null
    );
    if (stored) {
      return toAgents(stored);
    }
  }
  return [];
};

/**
 * 利用者が追加したエージェントを読む。
 *
 * custom.json がまだ無ければ、以前の名前のファイルから引き継ぐ。
 * デフォルトのぶんは default.json 側が持つので、ここでは常に取り除く。
 * （引き継いだ内容は、次の追加・変更・削除で custom.json として書き出される）
 */
const readCustomAgents = async (
  defaults: readonly Agent[]
): Promise<readonly Agent[]> => {
  const stored = await readJsonFileIfExists<readonly StoredAgent[] | null>(
    CUSTOM_FILE,
    null
  );
  const agents = stored ? toAgents(stored) : await readLegacyAgents();
  const defaultIds = new Set(defaults.map((agent) => agent.id));
  return agents.filter((agent) => !defaultIds.has(agent.id));
};

/**
 * custom.json を読み込み → 更新 → 書き込みする。
 *
 * デフォルトは別ファイルなので、ここで書き換えるのは利用者ぶんだけ。
 * 同名の判定などに要るため、デフォルトの一覧も updater へ渡す。
 */
const updateCustomAgents = async <R>(
  updater: (
    current: readonly Agent[],
    defaults: readonly Agent[]
  ) => { readonly next: readonly Agent[]; readonly result: R }
): Promise<R> => {
  const defaults = await readAgentFile(DEFAULT_FILE);
  // custom.json がまだ無いときは、以前の名前のファイルから引き継いだ内容を初期値にする
  const fallback = await readCustomAgents(defaults);
  return updateJsonFile<readonly StoredAgent[], R>(
    CUSTOM_FILE,
    fallback,
    (stored) => updater(toAgents(stored), defaults)
  );
};

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

/** デフォルトを先、利用者が追加したぶんを後に並べる */
export const listAgents = async (): Promise<readonly ListedAgent[]> => {
  const defaults = await readAgentFile(DEFAULT_FILE);
  const customs = await readCustomAgents(defaults);
  return [
    ...defaults.map((agent) => ({ ...agent, isDefault: true })),
    ...customs.map((agent) => ({ ...agent, isDefault: false })),
  ];
};

export const findAgent = async (
  id: string
): Promise<ListedAgent | undefined> => {
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
  updateCustomAgents<AgentMutation<Agent>>((current, defaults) => {
    if (hasSameName([...defaults, ...current], fields.name)) {
      return { next: current, result: { ok: false, error: 'duplicateName' } };
    }
    // JSON をそのまま読んだときに分かりやすいよう、ID は先頭に置く
    const agent: Agent = { id: randomUUID(), ...fields };
    return {
      next: [...current, agent],
      result: { ok: true, value: agent },
    };
  });

/** エージェントの設定を書き換える（ID は変更しない） */
export const updateAgent = async (
  id: string,
  patch: UpdateAgentRequest
): Promise<AgentMutation<Agent>> =>
  updateCustomAgents<AgentMutation<Agent>>((current, defaults) => {
    if (defaults.some((agent) => agent.id === id)) {
      return { next: current, result: { ok: false, error: 'protected' } };
    }
    if (!current.some((item) => item.id === id)) {
      return { next: current, result: { ok: false, error: 'notFound' } };
    }
    if (hasSameName([...defaults, ...current], patch.name, id)) {
      return { next: current, result: { ok: false, error: 'duplicateName' } };
    }
    const updated: Agent = { id, ...patch };
    return {
      next: current.map((item) => (item.id === id ? updated : item)),
      result: { ok: true, value: updated },
    };
  });

/** エージェントを削除する（送受信済みのメッセージは残る） */
export const deleteAgent = async (id: string): Promise<AgentMutation<null>> =>
  updateCustomAgents<AgentMutation<null>>((current, defaults) => {
    if (defaults.some((agent) => agent.id === id)) {
      return { next: current, result: { ok: false, error: 'protected' } };
    }
    if (!current.some((item) => item.id === id)) {
      return { next: current, result: { ok: false, error: 'notFound' } };
    }
    return {
      next: current.filter((item) => item.id !== id),
      result: { ok: true, value: null },
    };
  });
