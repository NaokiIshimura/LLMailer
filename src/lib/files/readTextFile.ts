import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { expandHome, resolveStoredPath } from '@/lib/paths';
import { isViewablePath, type FileContent } from './types';

/** ファイルを読めなかったことを表すエラー */
export class FileReadError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'FileReadError';
    this.status = status;
  }
}

/**
 * 読み込む上限（バイト）。
 * ビューアは本文をそのまま画面に流し込むため、
 * ログのような巨大なファイルを開いてしまわないように区切る。
 */
const MAX_SIZE = 1024 * 1024;

/** child が root の中（root 自身を含む）にあるか */
const isInside = (root: string, child: string): boolean => {
  const relative = path.relative(root, child);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
};

/**
 * シンボリックリンクを辿った先のパス。
 * 存在しないファイルはそのままのパスを返す（後段で 404 として扱う）。
 */
const toRealPath = async (target: string): Promise<string> => {
  try {
    return await realpath(target);
  } catch {
    return target;
  }
};

/**
 * 本文に書かれたパスのテキストファイルを読む。
 *
 * baseDirectory はエージェントの作業ディレクトリ。
 * 相対パスの基準にするとともに、読み取りを許す範囲としても使う。
 * 画面から任意のファイルを読めてしまわないよう、
 * 「LLMailer プロジェクト配下」か「作業ディレクトリ配下」に限る。
 */
export const readTextFile = async (
  target: string,
  baseDirectory?: string
): Promise<FileContent> => {
  if (target.trim() === '') {
    throw new FileReadError('パスが指定されていません', 400);
  }
  if (!isViewablePath(target)) {
    throw new FileReadError(
      `このファイルは開けません（Markdown とテキストのみ）: ${target}`,
      400
    );
  }

  const base = resolveStoredPath(baseDirectory);
  const resolved = path.resolve(base, expandHome(target));
  const real = await toRealPath(resolved);

  const roots = [process.cwd(), base];
  if (!roots.some((root) => isInside(root, real))) {
    throw new FileReadError(
      `読み取りを許可されていない場所です: ${resolved}`,
      403
    );
  }

  let stats;
  try {
    stats = await stat(real);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new FileReadError(`ファイルが見つかりません: ${resolved}`, 404);
    }
    if (code === 'EACCES' || code === 'EPERM') {
      throw new FileReadError(`読み取りを許可されていません: ${resolved}`, 403);
    }
    throw error;
  }

  if (stats.isDirectory()) {
    throw new FileReadError(`ディレクトリです: ${resolved}`, 400);
  }
  if (stats.size > MAX_SIZE) {
    throw new FileReadError(
      `ファイルが大きすぎます（${Math.round(stats.size / 1024)}KB / 上限 1024KB）`,
      413
    );
  }

  const content = await readFile(real, 'utf8');

  return {
    path: resolved,
    requestedPath: target,
    name: path.basename(resolved),
    content,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
  };
};
