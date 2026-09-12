import {
  ME_ADDRESS,
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

const collectParticipants = (messages: readonly Message[]): readonly string[] => {
  const addresses = new Set<string>();
  for (const message of messages) {
    if (message.from !== ME_ADDRESS) {
      addresses.add(message.from);
    }
    for (const to of message.to) {
      if (to !== ME_ADDRESS) {
        addresses.add(to);
      }
    }
  }
  return [...addresses];
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

const matchesFolder = (folder: Folder, messages: readonly Message[]): boolean => {
  switch (folder) {
    case 'home':
      // ホームは最近のやり取りを見せるので、全スレッドを対象にする
      return true;
    case 'inbox':
      return messages.some(
        (message) =>
          message.status === 'received' ||
          message.status === 'pending' ||
          message.status === 'failed'
      );
    case 'sent':
      return messages.some((message) => message.status === 'sent');
    case 'drafts':
      return false;
    case 'contacts':
      // アドレス帳はスレッドを表示しない
      return false;
    case 'all':
      return true;
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
    folder: 'all',
  }
): readonly Thread[] => {
  const { folder, query = '' } = options;
  const threads: Thread[] = [];

  for (const [threadId, threadMessages] of groupByThread(messages)) {
    if (!matchesFolder(folder, threadMessages)) {
      continue;
    }
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

/** 受信箱の未読件数 */
export const countUnread = (messages: readonly Message[]): number =>
  messages.filter((message) => message.status === 'received' && !message.read)
    .length;
