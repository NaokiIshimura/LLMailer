import {
  PERMISSION_MODES,
  SETTING_SOURCES,
  type PermissionMode,
  type SettingSource,
  type UpdateAgentRequest,
} from '@/types/mail';

/** 必須の文字列。前後の空白は落とし、空なら不正とする */
const requiredText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * リクエストボディをエージェントの設定として読み取る（ID は含まない）。
 * 形式が不正なら null を返す。
 *
 * 任意項目は「未指定」と「空」を区別せず undefined にして、
 * JSON へ空文字や空配列が残らないようにする。
 */
export const parseAgentFields = (value: unknown): UpdateAgentRequest | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const body = value as Record<string, unknown>;

  const name = requiredText(body.name);
  if (name === null) {
    return null;
  }

  // 途中で型が合わなければ、最後にまとめて不正として扱う
  let invalid = false;

  const optionalText = (item: unknown): string | undefined => {
    if (item === undefined || item === null) {
      return undefined;
    }
    if (typeof item !== 'string') {
      invalid = true;
      return undefined;
    }
    return item.trim() || undefined;
  };

  const optionalTexts = (item: unknown): readonly string[] | undefined => {
    if (item === undefined || item === null) {
      return undefined;
    }
    if (!Array.isArray(item) || item.some((el) => typeof el !== 'string')) {
      invalid = true;
      return undefined;
    }
    const texts = (item as readonly string[])
      .map((el) => el.trim())
      .filter((el) => el !== '');
    return texts.length > 0 ? texts : undefined;
  };

  const optionalChoice = <T extends string>(
    item: unknown,
    allowed: readonly T[]
  ): T | undefined => {
    if (item === undefined || item === null) {
      return undefined;
    }
    if (!allowed.includes(item as T)) {
      invalid = true;
      return undefined;
    }
    return item as T;
  };

  const optionalChoices = <T extends string>(
    item: unknown,
    allowed: readonly T[]
  ): readonly T[] | undefined => {
    if (item === undefined || item === null) {
      return undefined;
    }
    if (!Array.isArray(item) || item.some((el) => !allowed.includes(el as T))) {
      invalid = true;
      return undefined;
    }
    return item.length > 0 ? (item as readonly T[]) : undefined;
  };

  const optionalDuration = (item: unknown): number | undefined => {
    if (item === undefined || item === null) {
      return undefined;
    }
    if (typeof item !== 'number' || !Number.isFinite(item) || item <= 0) {
      invalid = true;
      return undefined;
    }
    return item;
  };

  const fields: UpdateAgentRequest = {
    name,
    // 未指定なら Claude Code のデフォルトに任せるので、キーごと落とす
    model: optionalText(body.model),
    description: optionalText(body.description),
    systemPrompt: optionalText(body.systemPrompt),
    workingDirectory: optionalText(body.workingDirectory),
    permissionMode: optionalChoice<PermissionMode>(
      body.permissionMode,
      PERMISSION_MODES
    ),
    allowedTools: optionalTexts(body.allowedTools),
    disallowedTools: optionalTexts(body.disallowedTools),
    settingSources: optionalChoices<SettingSource>(
      body.settingSources,
      SETTING_SOURCES
    ),
    timeoutMs: optionalDuration(body.timeoutMs),
  };

  return invalid ? null : fields;
};
