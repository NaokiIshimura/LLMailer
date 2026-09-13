import { listJsonFileNames } from './jsonFile';

/**
 * スレッドに関わるものを置くディレクトリ。
 *
 * メッセージはスレッドごとに 1 ファイルへ分ける。
 * 1 つの JSON にまとめていると、返信が 1 通増えるたびに
 * それまでのやり取りすべてを書き直すことになるため。
 */
const THREADS_DIR = 'threads';

/** 下書き。スレッドに属さないので 1 ファイルにまとめる */
export const DRAFTS_FILE = `${THREADS_DIR}/drafts.json`;

/**
 * スレッド以外の用途で使っているファイル名。
 *
 * スレッド ID をそのままファイル名にするため、
 * これらと同じ ID を許すと下書きや、以前アーカイブ日時を置いていたファイルを
 * 上書きしてしまう（'states' は過去のファイル名と衝突させないために残す）。
 */
const RESERVED_IDS: ReadonlySet<string> = new Set(['drafts', 'states', 'index']);

const JSON_EXTENSION = '.json';

/**
 * ファイル名に使えるスレッド ID か。
 *
 * ID は `/api/threads/[id]` の URL や送信リクエストのボディから来る。
 * そのままパスへつなぐと `../` を含む値で data ディレクトリの外を触れてしまうため、
 * 英数字とハイフン・アンダースコアだけに絞り、予約名も弾く。
 */
export const isSafeThreadId = (threadId: string): boolean =>
  /^[A-Za-z0-9_-]+$/.test(threadId) && !RESERVED_IDS.has(threadId);

/** スレッドの保存先。ファイル名に使えない ID なら undefined */
export const threadFile = (threadId: string): string | undefined =>
  isSafeThreadId(threadId)
    ? `${THREADS_DIR}/${threadId}${JSON_EXTENSION}`
    : undefined;

/**
 * 保存済みのスレッド ID。
 *
 * 予約名のファイルは ID として使えないものなので、
 * ここを通すだけで drafts.json などをスレッドとして拾わずに済む。
 */
export const listThreadIds = async (): Promise<readonly string[]> => {
  const names = await listJsonFileNames(THREADS_DIR);
  return names
    .map((name) => name.slice(0, -JSON_EXTENSION.length))
    .filter(isSafeThreadId);
};
