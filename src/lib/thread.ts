import type { ThreadRecord } from '@/lib/store/threadRecord';
import {
  isOutgoingMessage,
  isSettledMessage,
  type Folder,
  type Message,
  type Thread,
} from '@/types/mail';

const SNIPPET_LENGTH = 80;

const toSnippet = (body: string): string => {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length > SNIPPET_LENGTH
    ? `${oneLine.slice(0, SNIPPET_LENGTH)}…`
    : oneLine;
};

/** スレッドに出てくるエージェント（自分は相手ではないので含めない） */
const collectParticipants = (messages: readonly Message[]): readonly string[] => {
  const agentIds = new Set<string>();
  for (const message of messages) {
    for (const agentId of message.agentIds) {
      agentIds.add(agentId);
    }
  }
  return [...agentIds];
};

export const buildThread = (record: ThreadRecord, archived = false): Thread => {
  const { messages } = record;
  const latest = messages[messages.length - 1];
  return {
    id: record.id,
    subject: record.subject,
    participants: collectParticipants(messages),
    lastMessageAt: latest?.createdAt ?? new Date(0).toISOString(),
    messageCount: messages.length,
    unreadCount: messages.filter((message) => !message.read).length,
    snippet: toSnippet(latest?.body ?? ''),
    hasPending: messages.some((message) => message.status === 'pending'),
    // 再送・取り消しで片付いた失敗は、一覧では失敗として扱わない
    hasFailure: messages.some(
      (message) => message.status === 'failed' && !isSettledMessage(message)
    ),
    archived,
  };
};

/** アーカイブされたままか（アーカイブより後のメッセージがあれば再開したものと見なす） */
const isArchived = ({ archivedAt, messages }: ThreadRecord): boolean =>
  archivedAt !== undefined &&
  messages.every((message) => message.createdAt <= archivedAt);

/**
 * いまアーカイブされているスレッドの ID。
 *
 * 送信・受信のどちらでも同じに扱うので、
 * 片付けたあとに返信が届いた場合も、こちらから返信した場合もメールボックスへ戻る。
 */
export const collectArchivedThreadIds = (
  records: readonly ThreadRecord[]
): ReadonlySet<string> =>
  new Set(records.filter(isArchived).map((record) => record.id));

/** スレッド一覧を出すフォルダか */
const showsThreads = (folder: Folder): boolean => {
  switch (folder) {
    case 'home':
      // ホームは最近のやり取りを見せるので、アーカイブ以外のスレッドを対象にする
      return true;
    case 'mailbox':
      // 送受信を区別せず、下書き以外のやり取りをまとめて見せる
      return true;
    case 'archive':
      // 対応が済んだものとして片付けたスレッドだけを見せる
      return true;
    case 'drafts':
      // 下書きはスレッドではなくメッセージ単位で並べる
      return false;
    case 'contacts':
      // アドレス帳はスレッドを表示しない
      return false;
    case 'settings':
      // 設定はスレッドを表示しない
      return false;
  }
};

/** 検索語に当てはまるか（件名は下書きなら自分のもの、スレッドならお題を見る） */
const matchesQuery = (
  query: string,
  subject: string,
  messages: readonly Message[]
): boolean => {
  if (!query) {
    return true;
  }
  const keyword = query.toLowerCase();
  return (
    subject.toLowerCase().includes(keyword) ||
    messages.some((message) => message.body.toLowerCase().includes(keyword))
  );
};

const byLastMessageAtDesc = (a: Thread, b: Thread): number =>
  b.lastMessageAt.localeCompare(a.lastMessageAt);

/** 指定した宛先のいずれかとのやり取りを含むスレッドか */
const matchesAgents = (
  agentIds: readonly string[] | undefined,
  messages: readonly Message[]
): boolean =>
  !agentIds ||
  agentIds.length === 0 ||
  messages.some((message) =>
    message.agentIds.some((id) => agentIds.includes(id))
  );

/** フォルダ・宛先・検索条件でスレッド一覧を導出する */
export const buildThreads = (
  records: readonly ThreadRecord[],
  options: {
    readonly folder: Folder;
    readonly query?: string;
    /**
     * 指定するとその宛先とのやり取りだけに絞る。
     * 複数渡すと、いずれかを含むスレッドをまとめて出す。
     */
    readonly agentIds?: readonly string[];
    /** アーカイブ済みのスレッド ID（アーカイブフォルダではここに載るものだけを出す） */
    readonly archivedThreadIds?: ReadonlySet<string>;
  } = {
    folder: 'mailbox',
  }
): readonly Thread[] => {
  const { folder, query = '', agentIds, archivedThreadIds } = options;
  const threads: Thread[] = [];

  if (!showsThreads(folder)) {
    return threads;
  }

  for (const record of records) {
    const archived = archivedThreadIds?.has(record.id) ?? false;
    // アーカイブは片付けたものだけ、それ以外のフォルダは片付けていないものだけを出す
    if (archived !== (folder === 'archive')) {
      continue;
    }
    if (
      !matchesQuery(query, record.subject, record.messages) ||
      !matchesAgents(agentIds, record.messages)
    ) {
      continue;
    }
    threads.push(buildThread(record, archived));
  }

  return threads.sort(byLastMessageAtDesc);
};

/** 下書きの一覧（新しい順） */
export const buildDrafts = (
  messages: readonly Message[],
  query = ''
): readonly Message[] =>
  messages
    .filter((message) => message.status === 'draft')
    .filter((message) => matchesQuery(query, message.subject, [message]))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/**
 * 未読として数えるメッセージか。
 *
 * アーカイブ済みスレッドのぶんは数えない。
 * 片付けたスレッドの未読がバッジに残り続けると、片付けた意味がなくなるため。
 */
const isUnreadReply = (
  message: Message,
  archivedThreadIds?: ReadonlySet<string>
): boolean =>
  message.status === 'received' &&
  !message.read &&
  !archivedThreadIds?.has(message.threadId);

/** メールボックスの未読件数 */
export const countUnread = (
  messages: readonly Message[],
  archivedThreadIds?: ReadonlySet<string>
): number =>
  messages.filter((message) => isUnreadReply(message, archivedThreadIds)).length;

/** 当てはまるメッセージを、やり取りの相手ごとに数える */
const countByAgent = (
  messages: readonly Message[],
  matches: (message: Message) => boolean
): Readonly<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const message of messages) {
    if (!matches(message)) {
      continue;
    }
    for (const agentId of message.agentIds) {
      counts[agentId] = (counts[agentId] ?? 0) + 1;
    }
  }
  return counts;
};

/** 宛先ごとの未読件数（サイドバーの宛先一覧に出す） */
export const countUnreadByAgent = (
  messages: readonly Message[],
  archivedThreadIds?: ReadonlySet<string>
): Readonly<Record<string, number>> =>
  countByAgent(messages, (message) =>
    isUnreadReply(message, archivedThreadIds)
  );

/**
 * 受信（エージェントの返信）の件数。
 *
 * 既読かどうかに関わらず数えるので、増えたときだけが「返信が届いた」瞬間になる。
 * 既読件数では、読んだだけで減って検知できない。
 */
export const countReceived = (messages: readonly Message[]): number =>
  messages.filter((message) => message.status === 'received').length;

/** 対応中（応答待ち）の件数 */
export const countPending = (messages: readonly Message[]): number =>
  messages.filter((message) => message.status === 'pending').length;

/** 宛先ごとの対応中件数（サイドバーの宛先一覧に出す） */
export const countPendingByAgent = (
  messages: readonly Message[]
): Readonly<Record<string, number>> =>
  countByAgent(messages, (message) => message.status === 'pending');

/**
 * スレッド本文を「送信とその返信」のまとまり単位に分け、新しいまとまりを先頭にする。
 *
 * まとまりの中は「送信 → 返信」の時系列のままにして、会話として読めるようにする。
 */
export const toThreadExchanges = (
  messages: readonly Message[]
): readonly (readonly Message[])[] => {
  const exchanges: Message[][] = [];

  for (const message of messages) {
    // 自分の送信が新しいまとまりの起点。エージェントの返信は直前のまとまりに続ける
    if (isOutgoingMessage(message) || exchanges.length === 0) {
      exchanges.push([message]);
    } else {
      exchanges[exchanges.length - 1].push(message);
    }
  }

  return exchanges.reverse();
};
