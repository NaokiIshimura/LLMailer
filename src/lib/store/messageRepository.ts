import { isOutgoingMessage, type Message } from '@/types/mail';
import { LEGACY_ME_ADDRESS, legacyAddressToAgentId } from './legacy';
import { readJsonFile, updateJsonFile } from './jsonFile';

const FILE_NAME = 'messages.json';
const DEFAULT_MESSAGES: readonly Message[] = [];

/** アドレスで宛先を表していた頃のメッセージ */
type StoredMessage = Message & {
  readonly from?: string;
  readonly to?: readonly string[];
};

/**
 * 保存済みのメッセージを読む（旧形式は from / to をエージェント ID へ畳む）。
 *
 * 自分発かどうかは配信状態から分かるため、利用者のアドレスは読み捨てる。
 */
const toMessage = ({ from, to, ...message }: StoredMessage): Message => {
  if (message.agentIds) {
    return message;
  }
  const addresses = isOutgoingMessage(message) ? (to ?? []) : [from ?? ''];
  return {
    ...message,
    agentIds: addresses
      .filter((address) => address !== '' && address !== LEGACY_ME_ADDRESS)
      .map(legacyAddressToAgentId),
  };
};

/** 保存済みの一覧を読む（書き戻すとその時点で新しい形式に揃う） */
const toMessages = (stored: readonly StoredMessage[]): readonly Message[] =>
  stored.map(toMessage);

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
  const messages = await readJsonFile<readonly StoredMessage[]>(
    FILE_NAME,
    DEFAULT_MESSAGES
  );
  return [...toMessages(messages)].sort(byCreatedAtAsc);
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
  updateJsonFile<readonly StoredMessage[], Message>(
    FILE_NAME,
    DEFAULT_MESSAGES,
    (current) => ({
      next: [
        ...toMessages(current).filter((item) => item.id !== message.id),
        message,
      ],
      result: message,
    })
  );

export const saveMessages = async (
  messages: readonly Message[]
): Promise<readonly Message[]> =>
  updateJsonFile<readonly StoredMessage[], readonly Message[]>(
    FILE_NAME,
    DEFAULT_MESSAGES,
    (current) => {
      const ids = new Set(messages.map((message) => message.id));
      return {
        next: [
          ...toMessages(current).filter((item) => !ids.has(item.id)),
          ...messages,
        ],
        result: messages,
      };
    }
  );

export const deleteMessage = async (id: string): Promise<boolean> =>
  updateJsonFile<readonly StoredMessage[], boolean>(
    FILE_NAME,
    DEFAULT_MESSAGES,
    (current) => ({
      next: toMessages(current).filter((message) => message.id !== id),
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

  return updateJsonFile<readonly StoredMessage[], number>(
    FILE_NAME,
    DEFAULT_MESSAGES,
    (current) => {
      let updated = 0;
      const next = toMessages(current).map((message) => {
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
  updateJsonFile<readonly StoredMessage[], number>(
    FILE_NAME,
    DEFAULT_MESSAGES,
    (current) => {
      let updated = 0;
      const next = toMessages(current).map((message) => {
        if (message.threadId !== threadId || message.read) {
          return message;
        }
        updated += 1;
        return { ...message, read: true };
      });
      return { next, result: updated };
    }
  );
