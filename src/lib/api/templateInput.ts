import type { UpdateTemplateRequest } from '@/types/mail';

/** 必須の文字列。前後の空白は落とし、空なら不正とする */
const requiredText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * 必須の本文。
 *
 * 定型文はそのままエージェントへの指示になるため、空かどうかの判定だけ
 * trim して行い、中身は改行もインデントも落とさずに保つ。
 */
const requiredBody = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value;
};

/**
 * リクエストボディをテンプレートの内容として読み取る（ID は含まない）。
 * 形式が不正なら null を返す。
 */
export const parseTemplateFields = (
  value: unknown
): UpdateTemplateRequest | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const payload = value as Record<string, unknown>;

  const name = requiredText(payload.name);
  const body = requiredBody(payload.body);
  if (name === null || body === null) {
    return null;
  }

  const { description } = payload;
  if (
    description !== undefined &&
    description !== null &&
    typeof description !== 'string'
  ) {
    return null;
  }

  return {
    name,
    body,
    // 「未指定」と「空」を区別せず、JSON へ空文字が残らないようにする
    description:
      typeof description === 'string'
        ? description.trim() || undefined
        : undefined,
  };
};
