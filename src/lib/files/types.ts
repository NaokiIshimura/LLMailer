/** ビューアで開けるファイルの拡張子 */
export const VIEWABLE_EXTENSIONS: readonly string[] = [
  '.md',
  '.markdown',
  '.mdx',
  '.txt',
];

/** ビューアで開けるファイルか（拡張子だけで判定する） */
export const isViewablePath = (target: string): boolean => {
  const lower = target.toLowerCase();
  return VIEWABLE_EXTENSIONS.some((extension) => lower.endsWith(extension));
};

/** Markdown として描画するファイルか（それ以外はそのままの文字で出す） */
export const isMarkdownPath = (target: string): boolean => {
  const lower = target.toLowerCase();
  return (
    lower.endsWith('.md') ||
    lower.endsWith('.markdown') ||
    lower.endsWith('.mdx')
  );
};

/** ビューアが 1 ファイルを表示するための情報 */
export interface FileContent {
  /** 読んだファイルの絶対パス */
  readonly path: string;
  /** 本文に書かれていたパス（ビューアの見出しに使う） */
  readonly requestedPath: string;
  readonly name: string;
  readonly content: string;
  /** バイト数 */
  readonly size: number;
  /** 最終更新日時（ISO 8601） */
  readonly modifiedAt: string;
}
