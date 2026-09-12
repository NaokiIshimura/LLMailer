import type { Message } from '@/types/mail';
import { readJsonFile, updateJsonFile } from './jsonFile';

const FILE_NAME = 'messages.json';
const DEFAULT_MESSAGES: readonly Message[] = [];

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

const byCreatedAtAsc = (a: Message, b: Message): number =>
  a.createdAt.localeCompare(b.createdAt);

export const listMessages = async (): Promise<readonly Message[]> => {
  const messages = await readJsonFile<readonly Message[]>(
    FILE_NAME,
    DEFAULT_MESSAGES
  );
  return [...messages].sort(byCreatedAtAsc);
};

export const listThreadMessages = async (
  threadId: string
): Promise<readonly Message[]> => {
  const messages = await listMessages();
  return messages.filter((message) => message.threadId === threadId);
};

export const findMessage = async (id: string): Promise<Message | undefined> => {
  const messages = await listMessages();
  return messages.find((message) => message.id === id);
};

/** メッセージを追加する（同一 ID が既にある場合は置き換える） */
export const saveMessage = async (message: Message): Promise<Message> =>
  updateJsonFile<readonly Message[], Message>(
    FILE_NAME,
    DEFAULT_MESSAGES,
    (current) => ({
      next: [...current.filter((item) => item.id !== message.id), message],
      result: message,
    })
  );

export const saveMessages = async (
  messages: readonly Message[]
): Promise<readonly Message[]> =>
  updateJsonFile<readonly Message[], readonly Message[]>(
    FILE_NAME,
    DEFAULT_MESSAGES,
    (current) => {
      const ids = new Set(messages.map((message) => message.id));
      return {
        next: [...current.filter((item) => !ids.has(item.id)), ...messages],
        result: messages,
      };
    }
  );

export const deleteMessage = async (id: string): Promise<boolean> =>
  updateJsonFile<readonly Message[], boolean>(
    FILE_NAME,
    DEFAULT_MESSAGES,
    (current) => ({
      next: current.filter((message) => message.id !== id),
      result: current.some((message) => message.id === id),
    })
  );

/**
 * 前のプロセスが残した対応中メッセージを配信失敗にする。
 *
 * 配信していたプロセスが消えた以上、返信は永遠に届かないため、
 * 「対応中」のまま残り続けないように倒しておく。
 */
export const failStalePendingMessages = async (): Promise<number> => {
  const messages = await listMessages();
  if (!messages.some(isStalePending)) {
    return 0;
  }

  return updateJsonFile<readonly Message[], number>(
    FILE_NAME,
    DEFAULT_MESSAGES,
    (current) => {
      let updated = 0;
      const next = current.map((message) => {
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
      return { next, result: updated };
    }
  );
};

/** スレッド内の未読メッセージをすべて既読にする */
export const markThreadAsRead = async (threadId: string): Promise<number> =>
  updateJsonFile<readonly Message[], number>(
    FILE_NAME,
    DEFAULT_MESSAGES,
    (current) => {
      let updated = 0;
      const next = current.map((message) => {
        if (message.threadId !== threadId || message.read) {
          return message;
        }
        updated += 1;
        return { ...message, read: true };
      });
      return { next, result: updated };
    }
  );
