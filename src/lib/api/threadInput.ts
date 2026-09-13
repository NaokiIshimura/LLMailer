import { THREAD_SUBJECT_MAX_LENGTH, type UpdateThreadRequest } from '@/types/mail';

/**
 * スレッドの件名として読み取る。
 *
 * 一覧でも本文の見出しでも 1 行で出すため、改行と続いた空白は 1 つの空白へ畳む。
 * 空になるものと長すぎるものは受け付けない。
 */
const parseSubject = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const subject = value.replace(/\s+/g, ' ').trim();
  return subject === '' || subject.length > THREAD_SUBJECT_MAX_LENGTH
    ? null
    : subject;
};

/**
 * リクエストボディをスレッドの更新内容として読み取る。形式が不正なら null を返す。
 *
 * ボディ無しの PATCH（既読化）も受け付けるため、空のオブジェクトは不正としない。
 */
export const parseThreadUpdate = (
  value: unknown
): UpdateThreadRequest | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const payload = value as Record<string, unknown>;

  const { read, archived, subject } = payload;
  if (read !== undefined && typeof read !== 'boolean') {
    return null;
  }
  if (archived !== undefined && typeof archived !== 'boolean') {
    return null;
  }
  if (subject === undefined) {
    return { read, archived };
  }

  const parsed = parseSubject(subject);
  return parsed === null ? null : { read, archived, subject: parsed };
};
