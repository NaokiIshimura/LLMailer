import {
  isSettledMessage,
  isUnansweredMessage,
  type Message,
} from '@/types/mail';
import { ensureMigrated } from './migration';
import { isSafeThreadId, listThreadIds } from './threadFiles';
import {
  addMessages,
  readDraftMessages,
  readThreadRecord,
  updateDraftMessages,
  updateThreadRecord,
} from './threadRecord';

/**
 * 配信を担当するサーバープロセスの ID。
 * 対応中メッセージに記録しておき、プロセスが入れ替わったら返信が届かないと判断する。
 */
export const DELIVERY_PROCESS_ID = String(process.pid);

const STALE_PENDING_ERROR =
  'サーバーが停止したため、配信結果を受け取れませんでした。';

/** 別プロセスが残した対応中メッセージ（その配信の返信はもう届かない） */
const isStalePending = (message: Message): boolean =>
  message.status === 'pending' &&
  message.deliveryProcessId !== DELIVERY_PROCESS_ID;

/**
 * メッセージの保存先。
 *
 * 下書きはスレッドに属さないので 1 ファイルへまとめ（null）、
 * それ以外はスレッドごとのファイルへ分ける。
 */
const threadOf = (message: Message): string | null =>
  message.status === 'draft' ? null : message.threadId;

/** 保存先ごとにメッセージをまとめる（ファイルへの書き込みを 1 回にするため） */
const groupByThread = (
  messages: readonly Message[]
): ReadonlyMap<string | null, readonly Message[]> => {
  const groups = new Map<string | null, Message[]>();
  for (const message of messages) {
    const threadId = threadOf(message);
    if (threadId !== null && !isSafeThreadId(threadId)) {
      throw new Error(`ファイル名に使えないスレッド ID です: ${threadId}`);
    }
    const group = groups.get(threadId);
    if (group) {
      group.push(message);
    } else {
      groups.set(threadId, [message]);
    }
  }
  return groups;
};

/** 保存済みの下書きをすべて読む */
export const listDraftMessages = async (): Promise<readonly Message[]> => {
  await ensureMigrated();
  return readDraftMessages();
};

/** メッセージを追加する（同一 ID が既にある場合は置き換える） */
export const saveMessage = async (message: Message): Promise<Message> => {
  await saveMessages([message]);
  return message;
};

/**
 * 複数のメッセージをまとめて保存する。
 *
 * 送信と宛先ぶんの「対応中」を一度に保存するために使う。
 * 保存先が分かれていれば並行して書き込める。
 */
export const saveMessages = async (
  messages: readonly Message[]
): Promise<readonly Message[]> => {
  await ensureMigrated();
  await Promise.all(
    [...groupByThread(messages)].map(([threadId, saved]) =>
      threadId === null
        ? updateDraftMessages((current) => {
            const ids = new Set(saved.map((message) => message.id));
            return {
              next: [
                ...current.filter((message) => !ids.has(message.id)),
                ...saved,
              ],
              result: null,
            };
          })
        : updateThreadRecord(threadId, (record) => ({
            next: addMessages(record, saved),
            result: null,
          }))
    )
  );
  return messages;
};

/** メッセージの保存先（下書きは 1 ファイルにまとまっている） */
type MessageLocation =
  | { readonly kind: 'draft' }
  | { readonly kind: 'thread'; readonly threadId: string };

/** メッセージが入っている保存先を探す（下書きから先に見る） */
const findMessageLocation = async (
  id: string
): Promise<MessageLocation | undefined> => {
  const has = (messages: readonly Message[]): boolean =>
    messages.some((message) => message.id === id);

  if (has(await readDraftMessages())) {
    return { kind: 'draft' };
  }

  const threadIds = await listThreadIds();
  const found = await Promise.all(
    threadIds.map(async (threadId) =>
      has((await readThreadRecord(threadId)).messages) ? threadId : undefined
    )
  );
  const threadId = found.find((value) => value !== undefined);
  return threadId === undefined ? undefined : { kind: 'thread', threadId };
};

export const deleteMessage = async (id: string): Promise<boolean> => {
  await ensureMigrated();
  // ID だけでは保存先が分からないため、先に見つけてからそのファイルだけ書き換える
  const location = await findMessageLocation(id);
  if (!location) {
    return false;
  }

  const remove = (current: readonly Message[]): readonly Message[] =>
    current.filter((message) => message.id !== id);

  if (location.kind === 'draft') {
    return updateDraftMessages((current) => ({
      next: remove(current),
      result: true,
    }));
  }

  return updateThreadRecord(location.threadId, (record) => ({
    next: { ...record, messages: remove(record.messages) },
    result: true,
  }));
};

/**
 * 対応中のメッセージを中断にする。
 *
 * 配信そのものを止めるのは呼び出し側の仕事で、ここでは
 * 「返信を得られないまま終わった」ことだけを残す。
 * すでに返信が届いている・見つからないときは false。
 */
export const cancelPendingMessage = async (id: string): Promise<boolean> => {
  await ensureMigrated();
  const location = await findMessageLocation(id);
  // 下書きは配信しないので、対応中になることもない
  if (!location || location.kind === 'draft') {
    return false;
  }

  return updateThreadRecord(location.threadId, (record) => {
    let canceled = false;
    const messages = record.messages.map((message) => {
      if (message.id !== id || message.status !== 'pending') {
        return message;
      }
      canceled = true;
      return {
        ...message,
        status: 'canceled' as const,
        // 配信の担当はもう居ないので落とす（undefined は JSON に残らない）
        deliveryProcessId: undefined,
      };
    });
    return { next: { ...record, messages }, result: canceled };
  });
};

/**
 * 失敗・中断したメッセージへ、対応が済んだ印を書き足す。
 *
 * 再送でも取り消しでも元の 1 通は消さない
 * （何があったのか、どう片付けたのかを、あとから追えるようにするため）。
 * 済んだ話になるので、未読としては数えない。
 * 見つからない・すでに対応済みのときは false。
 */
const settleUnansweredMessage = async (
  id: string,
  settled: Pick<Message, 'resentAt' | 'dismissedAt'>
): Promise<boolean> => {
  await ensureMigrated();
  const location = await findMessageLocation(id);
  // 下書きは配信しないので、失敗も中断もしない
  if (!location || location.kind === 'draft') {
    return false;
  }

  return updateThreadRecord(location.threadId, (record) => {
    let marked = false;
    const messages = record.messages.map((message) => {
      if (
        message.id !== id ||
        !isUnansweredMessage(message) ||
        isSettledMessage(message)
      ) {
        return message;
      }
      marked = true;
      return { ...message, ...settled, read: true };
    });
    return { next: { ...record, messages }, result: marked };
  });
};

/** 失敗・中断したメッセージへ、再送した記録を残す */
export const markMessageAsResent = async (
  id: string,
  resentAt: string
): Promise<boolean> => settleUnansweredMessage(id, { resentAt });

/** 失敗・中断したメッセージへ、再送せずに取り消した記録を残す */
export const markMessageAsDismissed = async (
  id: string,
  dismissedAt: string
): Promise<boolean> => settleUnansweredMessage(id, { dismissedAt });

/**
 * 前のプロセスが残した対応中メッセージを配信失敗にする。
 *
 * 配信していたプロセスが消えた以上、返信は永遠に届かないため、
 * 「対応中」のまま残り続けないように倒しておく。
 */
export const failStalePendingMessages = async (): Promise<number> => {
  await ensureMigrated();
  // 下書きは対応中にならないので、スレッドのファイルだけを見る
  const threadIds = await listThreadIds();
  const targets = await Promise.all(
    threadIds.map(async (threadId) =>
      (await readThreadRecord(threadId)).messages.some(isStalePending)
        ? threadId
        : undefined
    )
  );

  const counts = await Promise.all(
    targets
      .filter((threadId): threadId is string => threadId !== undefined)
      .map((threadId) =>
        updateThreadRecord(threadId, (record) => {
          let updated = 0;
          const messages = record.messages.map((message) => {
            if (!isStalePending(message)) {
              return message;
            }
            updated += 1;
            return {
              ...message,
              status: 'failed' as const,
              error: STALE_PENDING_ERROR,
              read: false,
              // 配信の担当はもう居ないので落とす（undefined は JSON に残らない）
              deliveryProcessId: undefined,
            };
          });
          return { next: { ...record, messages }, result: updated };
        })
      )
  );

  return counts.reduce((total, count) => total + count, 0);
};

/** スレッド内の未読メッセージをすべて既読にする */
export const markThreadAsRead = async (threadId: string): Promise<number> => {
  await ensureMigrated();
  if (!isSafeThreadId(threadId)) {
    return 0;
  }

  return updateThreadRecord(threadId, (record) => {
    let updated = 0;
    const messages = record.messages.map((message) => {
      if (message.read) {
        return message;
      }
      updated += 1;
      return { ...message, read: true };
    });
    return { next: { ...record, messages }, result: updated };
  });
};
