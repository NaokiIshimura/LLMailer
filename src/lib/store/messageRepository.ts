import type { Message } from '@/types/mail';
import { readJsonFile, updateJsonFile } from './jsonFile';

const FILE_NAME = 'messages.json';
const DEFAULT_MESSAGES: readonly Message[] = [];

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
