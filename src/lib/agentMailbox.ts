import type { ListedAgent } from '@/types/mail';

/**
 * サイドバーに並べる宛先ごとのメールボックス。
 *
 * ふだんはエージェント 1 件につき 1 つだが、
 * デフォルトのエージェントは 1 つにまとめられる（設定で切り替える）。
 */
export interface AgentMailbox {
  /** 選択中かを見分ける識別子（エージェント ID とは別に持つ） */
  readonly key: string;
  readonly name: string;
  /** この一覧に出す宛先。まとめたものは複数入る */
  readonly agentIds: readonly string[];
  /** 宛先 1 件のメールボックスならそのエージェント（まとめたものは null） */
  readonly agent: ListedAgent | null;
  readonly description?: string;
}

/**
 * デフォルトのエージェントをまとめたメールボックスの識別子。
 *
 * エージェント ID と同じ入れ物で扱うため、取り違えないよう接頭辞を付ける。
 */
export const DEFAULT_MAILBOX_KEY = 'mailbox:defaults';

/** まとめたメールボックスの表示名 */
export const DEFAULT_MAILBOX_NAME = 'デフォルト';

/** 宛先 1 件ぶんのメールボックス */
const toSingleMailbox = (agent: ListedAgent): AgentMailbox => ({
  key: agent.id,
  name: agent.name,
  agentIds: [agent.id],
  agent,
  description: agent.description,
});

/**
 * サイドバーに並べるメールボックスを組み立てる。
 *
 * まとめる設定のときは、デフォルトのエージェントぶんを 1 つにして先頭へ置く。
 * 利用者が追加したエージェントは、まとめても 1 件ずつのまま並べる。
 */
export const toAgentMailboxes = (
  agents: readonly ListedAgent[],
  groupDefaults: boolean
): readonly AgentMailbox[] => {
  if (!groupDefaults) {
    return agents.map(toSingleMailbox);
  }

  const defaults = agents.filter((agent) => agent.isDefault);
  const users = agents.filter((agent) => !agent.isDefault);

  if (defaults.length === 0) {
    return users.map(toSingleMailbox);
  }

  return [
    {
      key: DEFAULT_MAILBOX_KEY,
      name: DEFAULT_MAILBOX_NAME,
      agentIds: defaults.map((agent) => agent.id),
      agent: null,
      // どの宛先がまとまっているかは、名前を並べて示す
      description: `${defaults
        .map((agent) => agent.name)
        .join('、')}とのやり取り`,
    },
    ...users.map(toSingleMailbox),
  ];
};

/**
 * デフォルトのメールボックスをまとめるかどうかの保存先。
 *
 * サーバーに置く必要のない、ブラウザごとの設定なので localStorage に持つ。
 */
export const GROUP_DEFAULT_AGENTS_STORAGE_KEY = 'llmailer.groupDefaultAgents';

/** 宛先ごとに分かれているほうが元の見え方なので、デフォルトはまとめない */
export const DEFAULT_GROUP_DEFAULT_AGENTS = false;

/** 保存された設定を読む。未設定や壊れた値のときはデフォルトに戻す */
export const readStoredGroupDefaultAgents = (): boolean => {
  try {
    const stored = window.localStorage.getItem(
      GROUP_DEFAULT_AGENTS_STORAGE_KEY
    );
    if (stored === 'on') {
      return true;
    }
    if (stored === 'off') {
      return false;
    }
    return DEFAULT_GROUP_DEFAULT_AGENTS;
  } catch {
    return DEFAULT_GROUP_DEFAULT_AGENTS;
  }
};

/** 次回の読み込みにも引き継げるよう設定を残す。保存できたかを返す */
export const storeGroupDefaultAgents = (grouped: boolean): boolean => {
  try {
    window.localStorage.setItem(
      GROUP_DEFAULT_AGENTS_STORAGE_KEY,
      grouped ? 'on' : 'off'
    );
    return true;
  } catch {
    return false;
  }
};
