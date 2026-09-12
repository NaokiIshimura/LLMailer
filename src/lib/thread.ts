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
  messages: readonly Message[]
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
  };
};

/** スレッド一覧を出すフォルダか */
const showsThreads = (folder: Folder): boolean => {
  switch (folder) {
    case 'home':
      // ホームは最近のやり取りを見せるので、全スレッドを対象にする
      return true;
    case 'mailbox':
      // 送受信を区別せず、下書き以外のやり取りをまとめて見せる
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

/** フォルダと検索条件でスレッド一覧を導出する */
export const buildThreads = (
  messages: readonly Message[],
  options: { readonly folder: Folder; readonly query?: string } = {
    folder: 'mailbox',
  }
): readonly Thread[] => {
  const { folder, query = '' } = options;
  const threads: Thread[] = [];

  if (!showsThreads(folder)) {
    return threads;
  }

  for (const [threadId, threadMessages] of groupByThread(messages)) {
    if (!matchesQuery(query, threadMessages)) {
      continue;
    }
    threads.push(buildThread(threadId, threadMessages));
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

/** メールボックスの未読件数 */
export const countUnread = (messages: readonly Message[]): number =>
  messages.filter((message) => message.status === 'received' && !message.read)
    .length;

/** 対応中（応答待ち）の件数 */
export const countPending = (messages: readonly Message[]): number =>
  messages.filter((message) => message.status === 'pending').length;

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
