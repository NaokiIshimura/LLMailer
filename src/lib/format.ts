const timeFormatter = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** 一覧向け。当日は時刻、それ以外は日付 */
export const formatListDate = (iso: string): string => {
  const date = new Date(iso);
  return isSameDay(date, new Date())
    ? timeFormatter.format(date)
    : dateFormatter.format(date);
};

/** 本文向けの日時表記 */
export const formatDateTime = (iso: string): string =>
  dateTimeFormatter.format(new Date(iso));

/** 実行コスト（USD）。極小の場合も桁を落とさずに見せる */
export const formatCost = (costUsd: number): string =>
  `$${costUsd < 0.01 ? costUsd.toFixed(4) : costUsd.toFixed(2)}`;

/** 所要時間 */
export const formatDuration = (durationMs: number): string =>
  durationMs < 1000
    ? `${durationMs}ms`
    : durationMs < 60_000
      ? `${(durationMs / 1000).toFixed(1)}秒`
      : `${Math.floor(durationMs / 60_000)}分${Math.round(
          (durationMs % 60_000) / 1000
        )}秒`;

/** トークン数 */
export const formatTokens = (tokens: number): string =>
  tokens.toLocaleString('ja-JP');

/** ファイルサイズ */
export const formatFileSize = (bytes: number): string =>
  bytes < 1024
    ? `${bytes}B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)}KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
