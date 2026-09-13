import {
  isOutgoingMessage,
  NO_SUBJECT,
  type Message,
  type MessageStatus,
} from '@/types/mail';
import { LEGACY_ME_ADDRESS, legacyAddressToAgentId } from './legacy';
import { readJsonFileIfExists, updateJsonFile } from './jsonFile';
import { DRAFTS_FILE, threadFile } from './threadFiles';

/**
 * スレッドファイル（data/threads/<threadId>.json）の中身。
 *
 * スレッドの実体はこのファイルで、件名とアーカイブ日時もここに持つ。
 * 1 ファイル = 1 スレッドなので、メッセージ側の threadId と subject は
 * 全通で同じ値の繰り返しにしかならない。保存形からは落とし、読み込み時に補う。
 */
export interface ThreadRecord {
  /** スレッド ID。ファイル名が正で、中の値はそれに合わせる */
  readonly id: string;
  readonly subject: string;
  /** アーカイブした日時（ISO 8601）。片付けていなければ持たない */
  readonly archivedAt?: string;
  readonly messages: readonly Message[];
}

/**
 * 保存するメッセージ。
 *
 * threadId と subject はスレッド側が持つので落とす。
 * 以前の形式で保存されたぶんは値が残っているため、読むときだけ受け取る。
 */
export type StoredMessage = Omit<Message, 'threadId' | 'subject'> & {
  readonly threadId?: string;
  readonly subject?: string;
  /** アドレスで宛先を表していた頃のメッセージ */
  readonly from?: string;
  readonly to?: readonly string[];
};

/** 保存するスレッド（メッセージの配列だけだった頃のファイルも読む） */
interface StoredThread {
  readonly id?: string;
  readonly subject?: string;
  readonly archivedAt?: string;
  readonly messages?: readonly StoredMessage[];
}

export const byCreatedAtAsc = (a: Message, b: Message): number =>
  a.createdAt.localeCompare(b.createdAt);

/**
 * アドレスで宛先を表していた頃の from / to をエージェント ID へ畳む。
 *
 * 自分発かどうかは配信状態から分かるため、利用者のアドレスは読み捨てる。
 */
const toAgentIds = (
  status: MessageStatus,
  from: string | undefined,
  to: readonly string[] | undefined
): readonly string[] =>
  (isOutgoingMessage({ status }) ? (to ?? []) : [from ?? ''])
    .filter((address) => address !== '' && address !== LEGACY_ME_ADDRESS)
    .map(legacyAddressToAgentId);

/** スレッドに属さないメッセージ（下書き）を読む。threadId と subject は自分で持つ */
export const toStandaloneMessage = ({
  from,
  to,
  ...stored
}: StoredMessage): Message => ({
  ...stored,
  threadId: stored.threadId ?? '',
  subject: stored.subject || NO_SUBJECT,
  agentIds: stored.agentIds ?? toAgentIds(stored.status, from, to),
});

/** スレッドファイルのメッセージを読む（threadId と subject はスレッド側の値で埋める） */
const toThreadMessage = (
  { from, to, ...stored }: StoredMessage,
  threadId: string,
  subject: string
): Message => ({
  ...stored,
  threadId,
  subject,
  agentIds: stored.agentIds ?? toAgentIds(stored.status, from, to),
});

/** 保存されている内容をスレッドとして読む（配列だった頃のファイルも受け取る） */
const toRecord = (
  threadId: string,
  stored: StoredThread | readonly StoredMessage[] | null
): ThreadRecord => {
  // 配列で保存していた頃は件名がメッセージ側にしか無いので、先頭のものを引き継ぐ
  const thread: StoredThread = Array.isArray(stored)
    ? { messages: stored }
    : ((stored as StoredThread | null) ?? {});
  const storedMessages = thread.messages ?? [];

  if (thread.id !== undefined && thread.id !== threadId) {
    // スレッド ID の定義はファイル名なので、中の値は二重の source にしない
    console.warn(
      '[llmailer] スレッド ID がファイル名と異なります',
      threadId,
      thread.id
    );
  }

  const subject = thread.subject || storedMessages[0]?.subject || NO_SUBJECT;
  return {
    id: threadId,
    subject,
    archivedAt: thread.archivedAt,
    messages: storedMessages.map((message) =>
      toThreadMessage(message, threadId, subject)
    ),
  };
};

/** 書き込む形にする（スレッド側が持つ値は undefined にして JSON へ残さない） */
const toStoredMessage = (message: Message): StoredMessage => ({
  ...message,
  threadId: undefined,
  subject: undefined,
});

const toStoredThread = (record: ThreadRecord): StoredThread => ({
  id: record.id,
  subject: record.subject,
  archivedAt: record.archivedAt,
  messages: [...record.messages].sort(byCreatedAtAsc).map(toStoredMessage),
});

const emptyRecord = (threadId: string): ThreadRecord => ({
  id: threadId,
  subject: NO_SUBJECT,
  messages: [],
});

/** スレッド 1 件を読む（無いファイルはメッセージ 0 件として扱い、作りはしない） */
export const readThreadRecord = async (
  threadId: string
): Promise<ThreadRecord> => {
  const fileName = threadFile(threadId);
  if (!fileName) {
    return emptyRecord(threadId);
  }

  const stored = await readJsonFileIfExists<
    StoredThread | readonly StoredMessage[] | null
  >(fileName, null);
  return toRecord(threadId, stored);
};

/**
 * スレッド 1 件を読み込み → 更新 → 書き込みする。
 *
 * 保存するときに時系列へ並べ直すので、読み出す側は並んでいるものとして扱える。
 * 1 通も残らなかったスレッドはファイルごと削除する
 * （一覧に出ないファイルを、件名だけ残して溜めないため）。
 */
export const updateThreadRecord = async <R>(
  threadId: string,
  updater: (current: ThreadRecord) => {
    readonly next: ThreadRecord;
    readonly result: R;
  }
): Promise<R> => {
  const fileName = threadFile(threadId);
  if (!fileName) {
    throw new Error(`ファイル名に使えないスレッド ID です: ${threadId}`);
  }

  return updateJsonFile<StoredThread | readonly StoredMessage[], R>(
    fileName,
    {},
    (stored) => {
      const { next, result } = updater(toRecord(threadId, stored));
      return {
        next: next.messages.length === 0 ? null : toStoredThread(next),
        result,
      };
    }
  );
};

/**
 * メッセージを足したスレッドを作る（同一 ID のものは置き換える）。
 *
 * 初めて保存するスレッドでは、最初のメッセージの件名がそのままお題になる。
 * 以降は件名をスレッド側だけで持つので、送信のたびに上書きしない。
 */
export const addMessages = (
  record: ThreadRecord,
  messages: readonly Message[]
): ThreadRecord => {
  const ids = new Set(messages.map((message) => message.id));
  const merged = [
    ...record.messages.filter((message) => !ids.has(message.id)),
    ...messages,
  ].sort(byCreatedAtAsc);

  return {
    ...record,
    subject:
      record.messages.length === 0
        ? merged[0]?.subject || record.subject
        : record.subject,
    messages: merged,
  };
};

/** 下書きを読む（スレッドに属さないので 1 ファイルにまとめてある） */
export const readDraftMessages = async (): Promise<readonly Message[]> => {
  const stored = await readJsonFileIfExists<readonly StoredMessage[]>(
    DRAFTS_FILE,
    []
  );
  return stored.map(toStandaloneMessage);
};

/** 下書きを読み込み → 更新 → 書き込みする */
export const updateDraftMessages = async <R>(
  updater: (current: readonly Message[]) => {
    readonly next: readonly Message[];
    readonly result: R;
  }
): Promise<R> =>
  updateJsonFile<readonly StoredMessage[], R>(DRAFTS_FILE, [], (stored) => {
    const { next, result } = updater(stored.map(toStandaloneMessage));
    return {
      next: next.length === 0 ? null : [...next].sort(byCreatedAtAsc),
      result,
    };
  });
