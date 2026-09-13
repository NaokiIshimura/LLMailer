import { ensureMigrated } from './migration';
import { isSafeThreadId, listThreadIds } from './threadFiles';
import {
  readThreadRecord,
  updateThreadRecord,
  type ThreadRecord,
} from './threadRecord';

/** スレッド 1 件を読む（無いスレッドはメッセージ 0 件で返る） */
export const readThread = async (threadId: string): Promise<ThreadRecord> => {
  await ensureMigrated();
  return readThreadRecord(threadId);
};

/**
 * 保存済みのスレッドをすべて読む。
 *
 * 一覧や未読件数はすべてのスレッドを見ないと作れないため、まとめて読む。
 */
export const listThreadRecords = async (): Promise<readonly ThreadRecord[]> => {
  await ensureMigrated();
  const threadIds = await listThreadIds();
  return Promise.all(threadIds.map(readThreadRecord));
};

/**
 * スレッドのお題を変える。変えられたら true を返す。
 *
 * 件名はスレッドが 1 つだけ持つので、メッセージ側は書き換えない。
 * 表示も、次の配信でエージェントへ伝わる件名も、これで揃う。
 */
export const setThreadSubject = async (
  threadId: string,
  subject: string
): Promise<boolean> => {
  await ensureMigrated();
  if (!isSafeThreadId(threadId)) {
    return false;
  }

  return updateThreadRecord(threadId, (record) =>
    // 無いスレッドの件名だけを書き残さない
    record.messages.length === 0
      ? { next: record, result: false }
      : { next: { ...record, subject }, result: true }
  );
};

/**
 * スレッドのアーカイブを切り替える。状態が変わったら true を返す。
 *
 * 真偽値ではなく日時を持つのは、アーカイブしたあとに届いた返信を
 * 「やり取りが再開した」と見なしてメールボックスへ戻すため。
 */
export const setThreadArchived = async (
  threadId: string,
  archived: boolean
): Promise<boolean> => {
  await ensureMigrated();
  if (!isSafeThreadId(threadId)) {
    return false;
  }

  return updateThreadRecord(threadId, (record) => {
    if (record.messages.length === 0) {
      return { next: record, result: false };
    }
    return {
      next: {
        ...record,
        // 解除は日時を落とすだけ（undefined は JSON に残らない）
        archivedAt: archived ? new Date().toISOString() : undefined,
      },
      result: archived || record.archivedAt !== undefined,
    };
  });
};
