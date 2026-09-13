import { readJsonFileIfExists, updateJsonFile } from './jsonFile';
import { STATES_FILE } from './threadFiles';

/** スレッドに関わるものを data/threads/ へ集める前のファイル（読み込み時に引き継ぐ） */
const LEGACY_FILE = 'threadStates.json';

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
 * 保存済みの状態を読む。
 *
 * 一度もアーカイブしていないうちからファイルは作らない。
 * 新しい場所にまだ無ければ、data 直下に置いていた頃のファイルから引き継ぐ。
 * （引き継いだ内容は、次のアーカイブ操作で新しい場所へ書き出される）
 */
const readStates = async (): Promise<readonly ThreadState[]> => {
  const states = await readJsonFileIfExists<readonly ThreadState[] | null>(
    STATES_FILE,
    null
  );
  return (
    states ??
    (await readJsonFileIfExists<readonly ThreadState[]>(
      LEGACY_FILE,
      DEFAULT_STATES
    ))
  );
};

/**
 * スレッドごとのアーカイブ日時。
 *
 * 真偽値ではなく日時を持つのは、アーカイブしたあとに届いた返信を
 * 「やり取りが再開した」と見なしてメールボックスへ戻すため。
 */
export const listArchivedAt = async (): Promise<
  ReadonlyMap<string, string>
> => {
  const states = await readStates();
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
): Promise<boolean> => {
  // 新しい場所にまだ無いときは、旧ファイルから引き継いだ内容を初期値にする
  const fallback = await readStates();
  return updateJsonFile<readonly ThreadState[], boolean>(
    STATES_FILE,
    fallback,
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
};
