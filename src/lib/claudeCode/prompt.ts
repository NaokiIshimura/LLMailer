import {
  isFullAccessAgent,
  isOutgoingMessage,
  type Agent,
  type Message,
} from '@/types/mail';

/**
 * `--append-system-prompt` に渡す役割文。
 *
 * 権限を明示するのは、ツールが無効化されているのに
 * 「作成しました」と実態と異なる返信をするのを防ぐため。
 */
export const buildRolePrompt = (agent: Agent, subject: string): string => {
  const workingDirectory = agent.workingDirectory ?? '.';
  const tools = agent.allowedTools ?? [];
  const canUseWeb = tools.includes('WebSearch') || tools.includes('WebFetch');

  /** 読み取り専用エージェントに、何ができて何ができないかを具体的に伝える */
  const readOnlyNotice = [
    'あなたは読み取り専用です。',
    canUseWeb
      ? `ファイルの読み取りと検索（${workingDirectory} 配下）、および Web 検索・Web ページの取得は使えます。`
      : `ファイルの読み取りと検索（${workingDirectory} 配下）は使えます。`,
    'ただしファイルの作成・変更とコマンド実行はできません（ツールが無効化されています）。',
    'できない依頼には、できたふりをせず「できません」と正直に返信し、代わりに内容や手順を文章で示してください。',
    '最新の情報を求められたら、まず使えるツールで調べてから答えてください。',
  ].join('');

  const lines = [
    `あなたはメールクライアント "LLMailer" 上のエージェント「${agent.name}」です。`,
    'ユーザーから届いたメールに対し、メールの返信として自然な日本語で答えてください。',
    '返信の本文だけを書いてください（件名の繰り返しや署名は不要です）。',
    `このスレッドの件名: ${subject}`,
    '',
    isFullAccessAgent(agent)
      ? `あなたは作業ディレクトリ ${workingDirectory} でファイルの変更やコマンド実行ができます。依頼された作業は実際に行ってから、何をどう変更したかを返信してください。`
      : readOnlyNotice,
  ];

  if (agent.systemPrompt) {
    lines.push('', `あなたの役割: ${agent.systemPrompt}`);
  }

  return lines.join('\n');
};

/**
 * 前回の応答以降に増えたメッセージからプロンプトを組み立てる。
 *
 * 会話履歴は Claude Code のセッション（--resume）が保持しているため、
 * LLMailer 側は差分だけを渡す。
 * 自分の発言は本文そのまま、同席している他エージェントの発言は名前を付けて畳み込む。
 */
export const buildPrompt = (input: {
  readonly newMessages: readonly Message[];
  readonly subject: string;
  readonly isFirstTurn: boolean;
  readonly agentNames: ReadonlyMap<string, string>;
}): string => {
  const { newMessages, subject, isFirstTurn, agentNames } = input;

  const blocks = newMessages.map((message) => {
    if (isOutgoingMessage(message)) {
      return message.body;
    }
    const sender = message.agentIds[0];
    const name = agentNames.get(sender) ?? '他のエージェント';
    return `【${name} の回答】\n${message.body}`;
  });

  const body = blocks.join('\n\n');
  return isFirstTurn ? `件名: ${subject}\n\n${body}` : body;
};
