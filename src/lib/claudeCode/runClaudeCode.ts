import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import type { Agent } from '@/types/mail';
import { isClaudeCodeResult, type ClaudeCodeResult } from './types';

/** claude コマンドのパス（PATH が通らない環境向けに上書きできる） */
const CLAUDE_BIN = process.env.LLMAILER_CLAUDE_BIN ?? 'claude';

/** 既定のタイムアウト（10 分） */
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

/** SIGTERM のあと強制終了するまでの猶予 */
const KILL_GRACE_MS = 5000;

export interface RunInput {
  readonly agent: Agent;
  readonly prompt: string;
  readonly rolePrompt: string;
  /** 継続するセッション ID。未指定なら新規セッションを開始する */
  readonly resumeSessionId?: string;
  /** 新規セッションに割り当てる ID */
  readonly newSessionId: string;
}

/** 実行に失敗したことを表すエラー */
export class ClaudeCodeError extends Error {
  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = 'ClaudeCodeError';
  }
}

/** エージェントの作業ディレクトリを絶対パスに解決する */
export const resolveWorkingDirectory = async (
  agent: Agent
): Promise<string> => {
  const resolved = path.resolve(process.cwd(), agent.workingDirectory ?? '.');

  try {
    await access(resolved);
  } catch {
    throw new ClaudeCodeError(
      `作業ディレクトリが見つかりません: ${resolved}（agents.json の workingDirectory を確認してください）`
    );
  }

  return resolved;
};

const buildArgs = (input: RunInput): readonly string[] => {
  const { agent, rolePrompt, resumeSessionId, newSessionId } = input;
  const args = ['-p', '--output-format', 'json'];

  // 未指定なら --model ごと省いて Claude Code のデフォルトに任せる
  if (agent.model) {
    args.push('--model', agent.model);
  }

  if (resumeSessionId) {
    args.push('--resume', resumeSessionId);
  } else {
    // スレッド初回は ID を指定して開始し、以降の返信で resume できるようにする
    args.push('--session-id', newSessionId);
    args.push('--append-system-prompt', rolePrompt);
  }

  args.push('--permission-mode', agent.permissionMode ?? 'manual');

  // 'user' を外すと ~/.claude/settings.json の permissions.allow を継承しない
  if (agent.settingSources && agent.settingSources.length > 0) {
    args.push('--setting-sources', agent.settingSources.join(','));
  }

  // 可変長オプションが後続の引数を飲み込まないよう、カンマ区切りの 1 引数で渡す
  if (agent.allowedTools && agent.allowedTools.length > 0) {
    args.push('--allowedTools', agent.allowedTools.join(','));
  }
  if (agent.disallowedTools && agent.disallowedTools.length > 0) {
    args.push('--disallowedTools', agent.disallowedTools.join(','));
  }

  return args;
};

/** 親プロセスが Claude Code 内で動いている場合に継承される変数を落とす */
const CLAUDE_ENV_ALLOW_LIST: readonly string[] = ['CLAUDE_CONFIG_DIR'];

const buildEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('CLAUDE') && !CLAUDE_ENV_ALLOW_LIST.includes(key)) {
      delete env[key];
    }
  }
  return env;
};

interface SpawnOutcome {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}

const spawnClaude = (
  args: readonly string[],
  prompt: string,
  cwd: string,
  timeoutMs: number
): Promise<SpawnOutcome> =>
  new Promise((resolve, reject) => {
    // shell: false（既定）で起動し、プロンプトは標準入力から渡す
    const child = spawn(CLAUDE_BIN, [...args], {
      cwd,
      env: buildEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS);
    }, timeoutMs);

    child.stdout.setEncoding('utf-8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf-8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(killTimer);
      if (error.code === 'ENOENT') {
        reject(
          new ClaudeCodeError(
            `claude コマンドが見つかりません（${CLAUDE_BIN}）。Claude Code をインストールするか、LLMAILER_CLAUDE_BIN にパスを設定してください。`,
            { cause: error }
          )
        );
        return;
      }
      reject(
        new ClaudeCodeError(`claude の起動に失敗しました: ${error.message}`, {
          cause: error,
        })
      );
    });

    child.on('close', (code) => {
      clearTimeout(killTimer);
      resolve({ code, stdout, stderr, timedOut });
    });

    child.stdin.end(prompt, 'utf-8');
  });

/** 末尾の JSON オブジェクトを取り出す（起動時の警告などが混ざっても拾えるようにする） */
const parseResult = (stdout: string): ClaudeCodeResult => {
  const trimmed = stdout.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start < 0 || end <= start) {
    throw new ClaudeCodeError(
      `claude の出力を解釈できませんでした: ${trimmed.slice(0, 200) || '(出力なし)'}`
    );
  }

  try {
    const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1));
    if (!isClaudeCodeResult(parsed)) {
      throw new ClaudeCodeError('claude の出力が想定した形式ではありません。');
    }
    return parsed;
  } catch (error) {
    if (error instanceof ClaudeCodeError) {
      throw error;
    }
    throw new ClaudeCodeError('claude の出力の JSON 解析に失敗しました。', {
      cause: error,
    });
  }
};

/**
 * 異常終了したときの原因を取り出す。
 *
 * `--output-format json` は異常終了でも result にエラー本文を入れて返すため、
 * JSON をそのまま切り詰めず result を優先する（切り詰めると原因が落ちる）。
 */
const extractFailureDetail = (outcome: SpawnOutcome): string => {
  try {
    const result = parseResult(outcome.stdout);
    const detail = (result.result ?? result.subtype ?? '').trim();
    if (detail) {
      return detail;
    }
  } catch {
    // JSON として読めなければ生の出力から拾う
  }

  return outcome.stderr.trim() || outcome.stdout.trim();
};

/** ローカルの Claude Code を 1 回実行する */
export const runClaudeCode = async (
  input: RunInput
): Promise<ClaudeCodeResult> => {
  const cwd = await resolveWorkingDirectory(input.agent);
  const timeoutMs = input.agent.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const outcome = await spawnClaude(
    buildArgs(input),
    input.prompt,
    cwd,
    timeoutMs
  );

  if (outcome.timedOut) {
    throw new ClaudeCodeError(
      `応答が ${Math.round(timeoutMs / 1000)} 秒を超えたため中断しました。`
    );
  }

  if (outcome.code !== 0) {
    const detail = extractFailureDetail(outcome);
    throw new ClaudeCodeError(
      `claude が異常終了しました（exit ${outcome.code ?? '不明'}）: ${
        detail.slice(0, 500) || '詳細なし'
      }`
    );
  }

  const result = parseResult(outcome.stdout);

  if (result.is_error) {
    throw new ClaudeCodeError(
      `Claude Code がエラーを返しました: ${result.result ?? result.subtype ?? '詳細なし'}`
    );
  }

  return result;
};
