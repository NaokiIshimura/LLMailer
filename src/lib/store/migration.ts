import type { Message } from '@/types/mail';
import { readJsonFileIfExists, renameJsonFile } from './jsonFile';
import { isSafeThreadId } from './threadFiles';
import {
  addMessages,
  toStandaloneMessage,
  updateDraftMessages,
  updateThreadRecord,
  type StoredMessage,
} from './threadRecord';

/**
 * 以前の名前・形式で保存されたファイルを、いまの置き場所へ引き継ぐ。
 *
 * 読むたびに振り分けると件数ぶんの無駄が出るため、初回の読み込みで一度だけ保存し直す。
 * どの引き継ぎも、すべて書き終えてから元のファイルを退避する。
 * 途中で落ちても元が残り、次の機会にやり直せる（二度走らせても結果は変わらない）。
 */

/** すべてのメッセージを 1 つにまとめていた頃のファイル */
const MESSAGES_FILE = 'messages.json';
const MESSAGES_BACKUP_FILE = 'messages.json.bak';

/** アーカイブ日時をスレッドとは別に持っていた頃のファイル（さらに前は data 直下） */
const STATES_FILE = 'threads/states.json';
const STATES_BACKUP_FILE = 'threads/states.json.bak';
const LEGACY_STATES_FILE = 'threadStates.json';
const LEGACY_STATES_BACKUP_FILE = 'threadStates.json.bak';

/** 保存されていたアーカイブ日時 */
interface StoredThreadState {
  readonly threadId: string;
  readonly archivedAt: string;
}

/** 保存先ごとにまとめる（下書きはスレッドに属さないので null をキーにする） */
const groupByThread = (
  messages: readonly Message[]
): ReadonlyMap<string | null, readonly Message[]> => {
  const groups = new Map<string | null, Message[]>();
  for (const message of messages) {
    if (message.status !== 'draft' && !isSafeThreadId(message.threadId)) {
      // 引き継げないものは退避する旧ファイルに残るので、気づけるように残しておく
      console.warn(
        '[llmailer] ファイル名に使えないスレッド ID のため引き継げません',
        message.threadId
      );
      continue;
    }
    const key = message.status === 'draft' ? null : message.threadId;
    const group = groups.get(key);
    if (group) {
      group.push(message);
    } else {
      groups.set(key, [message]);
    }
  }
  return groups;
};

/** 1 ファイルだった頃の messages.json をスレッドごとに分けて書き出す */
const migrateMessages = async (): Promise<void> => {
  const stored = await readJsonFileIfExists<readonly StoredMessage[] | null>(
    MESSAGES_FILE,
    null
  );
  if (!stored) {
    return;
  }

  // 旧ファイルのメッセージは threadId と件名を自分で持っている
  const messages = stored.map(toStandaloneMessage);

  for (const [threadId, grouped] of groupByThread(messages)) {
    // 分割済みのファイルがあれば残したまま足す。
    // 分割の途中で落ちてやり直す場合や、分割した後に旧ファイルへ
    // 書き込みが残っていた場合に、既にあるやり取りを失わないため。
    // 同じ ID のものは、分割元にある方を新しいものとして採る。
    if (threadId === null) {
      await updateDraftMessages((current) => {
        const ids = new Set(grouped.map((message) => message.id));
        return {
          next: [
            ...current.filter((message) => !ids.has(message.id)),
            ...grouped,
          ],
          result: null,
        };
      });
      continue;
    }

    await updateThreadRecord(threadId, (record) => ({
      next: addMessages(record, grouped),
      result: null,
    }));
  }

  await renameJsonFile(MESSAGES_FILE, MESSAGES_BACKUP_FILE);
};

/** 別ファイルで持っていたアーカイブ日時を、それぞれのスレッドファイルへ移す */
const migrateThreadStates = async (): Promise<void> => {
  const states =
    (await readJsonFileIfExists<readonly StoredThreadState[] | null>(
      STATES_FILE,
      null
    )) ??
    (await readJsonFileIfExists<readonly StoredThreadState[] | null>(
      LEGACY_STATES_FILE,
      null
    ));
  if (!states) {
    return;
  }

  for (const { threadId, archivedAt } of states) {
    if (!isSafeThreadId(threadId)) {
      continue;
    }
    // スレッドが残っていなければ、書き込みの中でファイルごと片付けられる
    await updateThreadRecord(threadId, (record) => ({
      next: { ...record, archivedAt },
      result: null,
    }));
  }

  await renameJsonFile(STATES_FILE, STATES_BACKUP_FILE);
  await renameJsonFile(LEGACY_STATES_FILE, LEGACY_STATES_BACKUP_FILE);
};

/**
 * 引き継ぎが済むまで待つ（同時に呼ばれても一度だけ走らせる）。
 *
 * アーカイブ日時はスレッドファイルへ書き込むため、
 * メッセージの分割が終わってから引き継ぐ。
 */
let migration: Promise<void> | null = null;
export const ensureMigrated = (): Promise<void> => {
  if (!migration) {
    migration = (async () => {
      await migrateMessages();
      await migrateThreadStates();
    })().catch((error: unknown) => {
      // 失敗したまま覚えると以降ずっと同じ結果を返すため、やり直せるようにする
      migration = null;
      throw error;
    });
  }
  return migration;
};
