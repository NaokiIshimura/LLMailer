import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * 書き込みを直列化するためのキュー。
 * 単一プロセス前提の簡易ロックで、JSON ファイルの破損を防ぐ。
 */
const writeQueues = new Map<string, Promise<unknown>>();

const filePath = (fileName: string): string => path.join(DATA_DIR, fileName);

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === 'ENOENT';

/** JSON ファイルを読み込む。存在しない場合は既定値で初期化する */
export const readJsonFile = async <T>(
  fileName: string,
  defaultValue: T
): Promise<T> => {
  try {
    const raw = await readFile(filePath(fileName), 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if (isNotFound(error)) {
      await writeJsonFile(fileName, defaultValue);
      return defaultValue;
    }
    throw error;
  }
};

/** JSON ファイルへ書き込む（同一ファイルへの書き込みは直列化される） */
export const writeJsonFile = async <T>(
  fileName: string,
  value: T
): Promise<void> => {
  const previous = writeQueues.get(fileName) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(
        filePath(fileName),
        `${JSON.stringify(value, null, 2)}\n`,
        'utf-8'
      );
    });

  writeQueues.set(fileName, next);
  try {
    await next;
  } finally {
    if (writeQueues.get(fileName) === next) {
      writeQueues.delete(fileName);
    }
  }
};

/**
 * 読み込み → 更新 → 書き込みを直列化して行う。
 * 同時リクエストによる更新の取りこぼしを防ぐ。
 */
export const updateJsonFile = async <T, R>(
  fileName: string,
  defaultValue: T,
  updater: (current: T) => { readonly next: T; readonly result: R }
): Promise<R> => {
  const previous = writeQueues.get(fileName) ?? Promise.resolve();
  const task = previous
    .catch(() => undefined)
    .then(async (): Promise<R> => {
      let current: T;
      try {
        const raw = await readFile(filePath(fileName), 'utf-8');
        current = JSON.parse(raw) as T;
      } catch (error) {
        if (!isNotFound(error)) {
          throw error;
        }
        current = defaultValue;
      }

      const { next, result } = updater(current);
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(
        filePath(fileName),
        `${JSON.stringify(next, null, 2)}\n`,
        'utf-8'
      );
      return result;
    });

  writeQueues.set(fileName, task);
  try {
    return await task;
  } finally {
    if (writeQueues.get(fileName) === task) {
      writeQueues.delete(fileName);
    }
  }
};
