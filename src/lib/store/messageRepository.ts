import { isOutgoingMessage, type Message } from '@/types/mail';
import { LEGACY_ME_ADDRESS, legacyAddressToAgentId } from './legacy';
import {
  readJsonFileIfExists,
  renameJsonFile,
  updateJsonFile,
  writeJsonFile,
} from './jsonFile';
import { DRAFTS_FILE, listThreadFiles, threadFile } from './threadFiles';

/** すべてのメッセージを 1 つにまとめていた頃のファイル（初回に読んで分割する） */
const LEGACY_FILE = 'messages.json';

/** 分割し終えた旧ファイルの退避先 */
const LEGACY_BACKUP_FILE = 'messages.json.bak';

const NO_MESSAGES: readonly Message[] = [];

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

/**
 * メッセージの保存先。
 *
 * 下書きはスレッドに属さないので 1 ファイルへまとめ、
 * それ以外はスレッドごとのファイルへ分ける。
 */
const fileOf = (message: Message): string | undefined =>
  message.status === 'draft' ? DRAFTS_FILE : threadFile(message.threadId);

/** 1 ファイルぶんのメッセージを読む（無いファイルは空として扱う） */
const readMessageFile = async (
  fileName: string
): Promise<readonly Message[]> =>
  toMessages(await readJsonFileIfExists<readonly StoredMessage[]>(fileName, []));

/**
 * 1 ファイルぶんのメッセージを読み込み → 更新 → 書き込みする。
 *
 * 保存するときに時系列へ並べ直すので、読み出す側は並んでいるものとして扱える。
 * 1 通も残らなかったファイルは削除する（空のスレッドを残さない）。
 */
const updateMessageFile = async <R>(
  fileName: string,
  updater: (current: readonly Message[]) => {
    readonly next: readonly Message[];
    readonly result: R;
  }
): Promise<R> =>
  updateJsonFile<readonly StoredMessage[], R>(fileName, [], (stored) => {
    const { next, result } = updater(toMessages(stored));
    return {
      next: next.length === 0 ? null : [...next].sort(byCreatedAtAsc),
      result,
    };
  });

/** 保存先ごとにメッセージをまとめる（ファイルへの書き込みを 1 回にするため） */
const groupByFile = (
  messages: readonly Message[]
): ReadonlyMap<string, readonly Message[]> => {
  const groups = new Map<string, Message[]>();
  for (const message of messages) {
    const fileName = fileOf(message);
    if (!fileName) {
      throw new Error(
        `ファイル名に使えないスレッド ID です: ${message.threadId}`
      );
    }
    const group = groups.get(fileName);
    if (group) {
      group.push(message);
    } else {
      groups.set(fileName, [message]);
    }
  }
  return groups;
};

/**
 * 1 ファイルだった頃の messages.json をスレッドごとに分けて書き出す。
 *
 * 読むたびに振り分けると件数ぶんの無駄が出るため、一度だけ保存し直す。
 * 分割をすべて書き終えてから旧ファイルを退避するので、
 * 途中で落ちても旧ファイルが残り、次の機会にやり直せる。
 */
const migrateLegacyMessages = async (): Promise<void> => {
  const stored = await readJsonFileIfExists<readonly StoredMessage[] | null>(
    LEGACY_FILE,
    null
  );
  if (!stored) {
    return;
  }

  const groups = new Map<string, Message[]>();
  for (const message of toMessages(stored)) {
    const fileName = fileOf(message);
    if (!fileName) {
      // 引き継げないものは退避する旧ファイルに残るので、気づけるように残しておく
      console.warn(
        '[llmailer] ファイル名に使えないスレッド ID のため引き継げません',
        message.threadId
      );
      continue;
    }
    const group = groups.get(fileName);
    if (group) {
      group.push(message);
    } else {
      groups.set(fileName, [message]);
    }
  }

  for (const [fileName, messages] of groups) {
    // 分割済みのファイルがあれば残したまま足す。
    // 分割の途中で落ちてやり直す場合や、分割した後に旧ファイルへ
    // 書き込みが残っていた場合に、既にあるやり取りを失わないため。
    // 同じ ID のものは、分割元にある方を新しいものとして採る。
    const current = await readMessageFile(fileName);
    const ids = new Set(messages.map((message) => message.id));
    const merged = [
      ...current.filter((message) => !ids.has(message.id)),
      ...messages,
    ];
    await writeJsonFile(fileName, merged.sort(byCreatedAtAsc));
  }
  await renameJsonFile(LEGACY_FILE, LEGACY_BACKUP_FILE);
};

/** 分割が済むまで待つ（同時に呼ばれても分割は 1 度だけ走らせる） */
let migration: Promise<void> | null = null;
const ensureMigrated = (): Promise<void> => {
  if (!migration) {
    migration = migrateLegacyMessages().catch((error: unknown) => {
      // 失敗したまま覚えると以降ずっと同じ結果を返すため、やり直せるようにする
      migration = null;
      throw error;
    });
  }
  return migration;
};

/**
 * 保存済みのメッセージをすべて読む。
 *
 * 一覧や未読件数はすべてのスレッドを見ないと作れないため、
 * ファイルをまとめて読んでから時系列に並べ直す。
 */
export const listMessages = async (): Promise<readonly Message[]> => {
  await ensureMigrated();
  const files = [...(await listThreadFiles()), DRAFTS_FILE];
  const groups = await Promise.all(files.map(readMessageFile));
  return groups.flat().sort(byCreatedAtAsc);
};

export const listThreadMessages = async (
  threadId: string
): Promise<readonly Message[]> => {
  await ensureMigrated();
  const fileName = threadFile(threadId);
  return fileName ? readMessageFile(fileName) : NO_MESSAGES;
};

/** メッセージが入っているファイルを探す（下書きから先に見る） */
const findMessageFile = async (id: string): Promise<string | undefined> => {
  const files = [DRAFTS_FILE, ...(await listThreadFiles())];
  const found = await Promise.all(
    files.map(async (fileName) =>
      (await readMessageFile(fileName)).some((message) => message.id === id)
        ? fileName
        : undefined
    )
  );
  return found.find((fileName) => fileName !== undefined);
};

export const findMessage = async (id: string): Promise<Message | undefined> => {
  const messages = await listMessages();
  return messages.find((message) => message.id === id);
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
    [...groupByFile(messages)].map(([fileName, saved]) =>
      updateMessageFile(fileName, (current) => {
        const ids = new Set(saved.map((message) => message.id));
        return {
          next: [
            ...current.filter((message) => !ids.has(message.id)),
            ...saved,
          ],
          result: null,
        };
      })
    )
  );
  return messages;
};

export const deleteMessage = async (id: string): Promise<boolean> => {
  await ensureMigrated();
  // ID だけでは保存先が分からないため、先に見つけてからそのファイルだけ書き換える
  const fileName = await findMessageFile(id);
  if (!fileName) {
    return false;
  }

  return updateMessageFile(fileName, (current) => ({
    next: current.filter((message) => message.id !== id),
    result: true,
  }));
};

/**
 * 前のプロセスが残した対応中メッセージを配信失敗にする。
 *
 * 配信していたプロセスが消えた以上、返信は永遠に届かないため、
 * 「対応中」のまま残り続けないように倒しておく。
 */
export const failStalePendingMessages = async (): Promise<number> => {
  await ensureMigrated();
  // 下書きは対応中にならないので、スレッドのファイルだけを見る
  const files = await listThreadFiles();
  const targets = await Promise.all(
    files.map(async (fileName) =>
      (await readMessageFile(fileName)).some(isStalePending)
        ? fileName
        : undefined
    )
  );

  const counts = await Promise.all(
    targets
      .filter((fileName): fileName is string => fileName !== undefined)
      .map((fileName) =>
        updateMessageFile(fileName, (current) => {
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
        })
      )
  );

  return counts.reduce((total, count) => total + count, 0);
};

/** スレッド内の未読メッセージをすべて既読にする */
export const markThreadAsRead = async (threadId: string): Promise<number> => {
  await ensureMigrated();
  const fileName = threadFile(threadId);
  if (!fileName) {
    return 0;
  }

  return updateMessageFile(fileName, (current) => {
    let updated = 0;
    const next = current.map((message) => {
      if (message.read) {
        return message;
      }
      updated += 1;
      return { ...message, read: true };
    });
    return { next, result: updated };
  });
};
