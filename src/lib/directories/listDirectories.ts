import { readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { DirectoryEntry, DirectoryListing } from './types';

/** ディレクトリを読めなかったことを表すエラー */
export class DirectoryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DirectoryError';
    this.status = status;
  }
}

/**
 * 絶対パスを保存用の値に直す。
 *
 * プロジェクト配下は相対パスのまま持つ（agents.json を別マシンへ持って
 * いっても動くようにするため）。外を指しているときだけ絶対パスにする。
 */
export const toStoredValue = (absolute: string): string => {
  const relative = path.relative(process.cwd(), absolute);
  if (relative === '') {
    return '.';
  }
  return relative.startsWith('..') || path.isAbsolute(relative)
    ? absolute
    : relative;
};

/** 隠しディレクトリは数が多く目当てのものが埋もれるため、後ろにまとめる */
const compareEntries = (a: DirectoryEntry, b: DirectoryEntry): number => {
  const aHidden = a.name.startsWith('.');
  const bHidden = b.name.startsWith('.');
  if (aHidden !== bHidden) {
    return aHidden ? 1 : -1;
  }
  return a.name.localeCompare(b.name, 'ja');
};

/** ディレクトリを指しているエントリだけを返す（それ以外は null） */
const toDirectoryEntry = async (
  parent: string,
  name: string,
  isDirectory: boolean,
  isSymbolicLink: boolean
): Promise<DirectoryEntry | null> => {
  const full = path.join(parent, name);
  if (isDirectory) {
    return { name, path: full };
  }
  if (!isSymbolicLink) {
    return null;
  }

  // シンボリックリンクは、辿った先がディレクトリのときだけ候補にする
  try {
    return (await stat(full)).isDirectory() ? { name, path: full } : null;
  } catch {
    return null;
  }
};

/**
 * 指定ディレクトリの直下にあるディレクトリを一覧する。
 * target を省略するとプロジェクトのルートを見る。
 */
export const listDirectories = async (
  target?: string
): Promise<DirectoryListing> => {
  const resolved = path.resolve(process.cwd(), target ?? '.');

  let dirents;
  try {
    dirents = await readdir(resolved, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new DirectoryError(
        `ディレクトリが見つかりません: ${resolved}`,
        404
      );
    }
    if (code === 'ENOTDIR') {
      throw new DirectoryError(
        `ディレクトリではありません: ${resolved}`,
        400
      );
    }
    if (code === 'EACCES' || code === 'EPERM') {
      throw new DirectoryError(`読み取りを許可されていません: ${resolved}`, 403);
    }
    throw error;
  }

  const entries = (
    await Promise.all(
      dirents.map((dirent) =>
        toDirectoryEntry(
          resolved,
          dirent.name,
          dirent.isDirectory(),
          dirent.isSymbolicLink()
        )
      )
    )
  )
    .filter((entry): entry is DirectoryEntry => entry !== null)
    .sort(compareEntries);

  const parent = path.dirname(resolved);

  return {
    path: resolved,
    value: toStoredValue(resolved),
    parent: parent === resolved ? null : parent,
    entries,
    shortcuts: { project: process.cwd(), home: os.homedir() },
  };
};
