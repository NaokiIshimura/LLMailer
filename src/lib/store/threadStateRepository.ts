import { readJsonFileIfExists, updateJsonFile } from './jsonFile';

const FILE_NAME = 'threadStates.json';

/**
 * スレッドに付ける状態。
 *
 * スレッド自体は Message[] から導出されるまとまりで実体を持たないため、
 * メッセージ側ではなくスレッド ID をキーにした別ファイルへ置く。
 */
export interface ThreadState {
  readonly threadId: string;
  /** アーカイブした日時（ISO 8601） */
  readonly archivedAt: string;
}

const DEFAULT_STATES: readonly ThreadState[] = [];

/**
 * スレッドごとのアーカイブ日時。
 *
 * 真偽値ではなく日時を持つのは、アーカイブしたあとに届いた返信を
 * 「やり取りが再開した」と見なしてメールボックスへ戻すため。
 */
export const listArchivedAt = async (): Promise<
  ReadonlyMap<string, string>
> => {
  // 一度もアーカイブしていないうちからファイルを作らない
  const states = await readJsonFileIfExists<readonly ThreadState[]>(
    FILE_NAME,
    DEFAULT_STATES
  );
  return new Map(states.map((state) => [state.threadId, state.archivedAt]));
};

/**
 * スレッドのアーカイブを切り替える。状態が変わったら true を返す。
 *
 * 解除は行ごと消す。アーカイブしていないことと、
 * 解除した記録が残っていることを区別する必要はない。
 */
export const setThreadArchived = async (
  threadId: string,
  archived: boolean
): Promise<boolean> =>
  updateJsonFile<readonly ThreadState[], boolean>(
    FILE_NAME,
    DEFAULT_STATES,
    (current) => {
      const rest = current.filter((state) => state.threadId !== threadId);
      const changed = archived || rest.length !== current.length;
      return {
        next: archived
          ? [...rest, { threadId, archivedAt: new Date().toISOString() }]
          : rest,
        result: changed,
      };
    }
  );
