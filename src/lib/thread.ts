import {
  isOutgoingMessage,
  NO_SUBJECT,
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

/** スレッド単位にグループ化する（下書きはスレッドに含めない） */
export const groupByThread = (
  messages: readonly Message[]
): ReadonlyMap<string, readonly Message[]> => {
  const groups = new Map<string, Message[]>();
  for (const message of messages) {
    if (message.status === 'draft') {
      continue;
    }
    const group = groups.get(message.threadId);
    if (group) {
      group.push(message);
    } else {
      groups.set(message.threadId, [message]);
    }
  }
  return groups;
};

export const buildThread = (
  threadId: string,
  messages: readonly Message[],
  archived = false
): Thread => {
  const latest = messages[messages.length - 1];
  return {
    id: threadId,
    subject: messages[0]?.subject || NO_SUBJECT,
    participants: collectParticipants(messages),
    lastMessageAt: latest?.createdAt ?? new Date(0).toISOString(),
    messageCount: messages.length,
    unreadCount: messages.filter((message) => !message.read).length,
    snippet: toSnippet(latest?.body ?? ''),
    hasPending: messages.some((message) => message.status === 'pending'),
    hasFailure: messages.some((message) => message.status === 'failed'),
    archived,
  };
};

/**
 * いまアーカイブされているスレッドの ID。
 *
 * アーカイブより後のメッセージがあるスレッドは、やり取りが再開したものとして含めない。
 * 送信・受信のどちらでも同じに扱うので、
 * 片付けたあとに返信が届いた場合も、こちらから返信した場合もメールボックスへ戻る。
 */
export const collectArchivedThreadIds = (
  messages: readonly Message[],
  archivedAt: ReadonlyMap<string, string>
): ReadonlySet<string> => {
  const threadIds = new Set<string>();
  if (archivedAt.size === 0) {
    return threadIds;
  }

  for (const [threadId, threadMessages] of groupByThread(messages)) {
    const at = archivedAt.get(threadId);
    if (at && threadMessages.every((message) => message.createdAt <= at)) {
      threadIds.add(threadId);
    }
  }
  return threadIds;
};

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

const matchesQuery = (query: string, messages: readonly Message[]): boolean => {
  if (!query) {
    return true;
  }
  const keyword = query.toLowerCase();
  return messages.some(
    (message) =>
      message.subject.toLowerCase().includes(keyword) ||
      message.body.toLowerCase().includes(keyword)
  );
};

const byLastMessageAtDesc = (a: Thread, b: Thread): number =>
  b.lastMessageAt.localeCompare(a.lastMessageAt);

/** 指定した宛先とのやり取りを含むスレッドか */
const matchesAgent = (
  agentId: string | undefined,
  messages: readonly Message[]
): boolean =>
  !agentId ||
  messages.some((message) => message.agentIds.includes(agentId));

/** フォルダ・宛先・検索条件でスレッド一覧を導出する */
export const buildThreads = (
  messages: readonly Message[],
  options: {
    readonly folder: Folder;
    readonly query?: string;
    /** 指定するとその宛先とのやり取りだけに絞る */
    readonly agentId?: string;
    /** アーカイブ済みのスレッド ID（アーカイブフォルダではここに載るものだけを出す） */
    readonly archivedThreadIds?: ReadonlySet<string>;
  } = {
    folder: 'mailbox',
  }
): readonly Thread[] => {
  const { folder, query = '', agentId, archivedThreadIds } = options;
  const threads: Thread[] = [];

  if (!showsThreads(folder)) {
    return threads;
  }

  for (const [threadId, threadMessages] of groupByThread(messages)) {
    const archived = archivedThreadIds?.has(threadId) ?? false;
    // アーカイブは片付けたものだけ、それ以外のフォルダは片付けていないものだけを出す
    if (archived !== (folder === 'archive')) {
      continue;
    }
    if (!matchesQuery(query, threadMessages) || !matchesAgent(agentId, threadMessages)) {
      continue;
    }
    threads.push(buildThread(threadId, threadMessages, archived));
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
    .filter((message) => matchesQuery(query, [message]))
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
