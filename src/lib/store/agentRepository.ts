import type { Agent } from '@/types/mail';
import { DENY_WRITE_TOOLS, READ_ONLY_TOOLS } from '@/types/mail';
import { readJsonFile } from './jsonFile';

const FILE_NAME = 'agents.json';

/**
 * 初回起動時にシードされる既定のエージェント。
 *
 * 権限は宛先ごとに分ける。フル権限（ファイル変更・コマンド実行が可能）は
 * worker@ のみとし、他は読み取り専用にしている。
 * 読み取り専用は disallowedTools（deny）と settingSources（user を外す）の
 * 二重で担保する。allowedTools だけではユーザー設定の allow を打ち消せない。
 * workingDirectory は Claude Code の作業ディレクトリで、相対パスは
 * LLMailer プロジェクトからの相対として解決される。
 */
const DEFAULT_AGENTS: readonly Agent[] = [
  {
    address: 'opus@llmailer.local',
    name: 'Opus（汎用）',
    model: 'opus',
    description: '調べもの・相談。ファイルは読むだけ',
    systemPrompt:
      '幅広い相談に応じる汎用アシスタントです。要点を押さえて簡潔に答えてください。',
    workingDirectory: '.',
    permissionMode: 'manual',
    allowedTools: READ_ONLY_TOOLS,
    disallowedTools: DENY_WRITE_TOOLS,
    settingSources: ['project', 'local'],
  },
  {
    address: 'worker@llmailer.local',
    name: '作業担当（フル権限）',
    model: 'opus',
    description: '実装・修正を実際に行う。ファイルを変更できる',
    systemPrompt:
      '依頼された作業を実際に行う担当です。作業を終えたら、何をどう変更したかを返信してください。',
    workingDirectory: '.',
    permissionMode: 'bypassPermissions',
  },
  {
    address: 'reviewer@llmailer.local',
    name: 'コードレビュアー',
    model: 'opus',
    description: 'コードを読んで問題点を指摘する',
    systemPrompt:
      'コードレビュアーです。バグ・可読性・保守性の観点で問題点を指摘し、修正案を添えてください。良い点の列挙より、具体的な指摘を優先してください。',
    workingDirectory: '.',
    permissionMode: 'manual',
    allowedTools: READ_ONLY_TOOLS,
    disallowedTools: DENY_WRITE_TOOLS,
    settingSources: ['project', 'local'],
  },
  {
    address: 'haiku@llmailer.local',
    name: 'Haiku（高速）',
    model: 'haiku',
    description: '短時間で要点だけ返す',
    systemPrompt:
      '速さを優先し、要点だけを短く返してください。前置きや締めの挨拶は書かないでください。',
    workingDirectory: '.',
    permissionMode: 'manual',
    allowedTools: READ_ONLY_TOOLS,
    disallowedTools: DENY_WRITE_TOOLS,
    settingSources: ['project', 'local'],
  },
  {
    address: 'translator@llmailer.local',
    name: '翻訳担当',
    model: 'sonnet',
    description: '日英の翻訳のみを返す',
    systemPrompt:
      '翻訳担当です。日本語が届いたら英語に、英語が届いたら日本語に翻訳し、翻訳結果のみを返してください。解説は書かないでください。',
    workingDirectory: '.',
    permissionMode: 'manual',
    allowedTools: READ_ONLY_TOOLS,
    disallowedTools: DENY_WRITE_TOOLS,
    settingSources: ['project', 'local'],
  },
];

export const listAgents = async (): Promise<readonly Agent[]> =>
  readJsonFile<readonly Agent[]>(FILE_NAME, DEFAULT_AGENTS);

export const findAgent = async (address: string): Promise<Agent | undefined> => {
  const agents = await listAgents();
  return agents.find((agent) => agent.address === address);
};
