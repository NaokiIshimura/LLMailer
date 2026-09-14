/** クォートしなくてもシェルがそのまま読むパス */
const PLAIN_PATH = /^[\w./~-]+$/;

/**
 * `cd` に渡せる形へ整える。
 *
 * 先頭の `~` はクォートするとホームへ開かれなくなるため、囲む範囲から外す。
 */
const quotePath = (directory: string): string => {
  if (PLAIN_PATH.test(directory)) {
    return directory;
  }
  const fromHome = directory.startsWith('~/');
  const rest = fromHome ? directory.slice(2) : directory;
  return `${fromHome ? '~/' : ''}'${rest.replace(/'/g, "'\\''")}'`;
};

/**
 * Claude Code のセッションを手元のターミナルで開き直すコマンドを組み立てる。
 *
 * セッションの記録は起動時の作業ディレクトリごとに分かれているため、
 * 同じディレクトリへ移ってからでないと `--resume` で見つけられない。
 */
export const buildResumeCommand = (
  workingDirectory: string,
  sessionId: string
): string =>
  `cd ${quotePath(workingDirectory)} && claude --resume ${sessionId}`;
