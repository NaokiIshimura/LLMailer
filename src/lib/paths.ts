import os from 'node:os';
import path from 'node:path';

/** 先頭の `~`（ホーム。単体か、区切り文字が続くときだけ） */
const HOME_PREFIX = /^~(?=[/\\]|$)/;

/**
 * 先頭の `~` をホームへ開く。
 *
 * ホームを `~` のまま保存できるようにしているのは、利用者ごとに違う絶対パスを
 * 保存ファイルや画面に出さずに済ませるため。`~` はシェルが開く書き方なので、
 * `spawn` で起動する `claude` には開いたあとのパスを渡す必要がある。
 */
export const expandHome = (target: string): string =>
  target.replace(HOME_PREFIX, () => os.homedir());

/** ホーム配下の絶対パスを `~` 表記へ畳む（外を指していればそのまま） */
export const collapseHome = (absolute: string): string => {
  const relative = path.relative(os.homedir(), absolute);
  if (relative === '') {
    return '~';
  }
  return relative.startsWith('..') || path.isAbsolute(relative)
    ? absolute
    : path.join('~', relative);
};

/**
 * 保存されたパスを絶対パスへ直す。
 * 相対パスの基準はプロジェクトのルート、`~` はホーム。
 */
export const resolveStoredPath = (target?: string): string =>
  path.resolve(process.cwd(), expandHome(target ?? '.'));
