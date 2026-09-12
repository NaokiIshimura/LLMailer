/** ユーザー自身のアドレス */
export const ME_ADDRESS = 'me@llmailer.local';

/**
 * Claude Code の権限モード。
 * 'manual' は非対話実行では「許可されたツール以外は実行されない」状態になる。
 */
export type PermissionMode =
  | 'manual'
  | 'acceptEdits'
  | 'auto'
  | 'dontAsk'
  | 'bypassPermissions'
  | 'plan';

/** Claude Code が読み込む設定ソース */
export type SettingSource = 'user' | 'project' | 'local';

/** 宛先となる AI エージェント（ローカルの Claude Code を 1 プロセス起動する単位） */
export interface Agent {
  readonly address: string;
  readonly name: string;
  /** Claude Code のモデル指定（'opus' / 'sonnet' / 'haiku' またはフル名） */
  readonly model: string;
  readonly systemPrompt?: string;
  readonly description?: string;
  /** Claude Code の作業ディレクトリ。相対パスは LLMailer プロジェクトからの相対 */
  readonly workingDirectory?: string;
  readonly permissionMode?: PermissionMode;
  readonly allowedTools?: readonly string[];
  readonly disallowedTools?: readonly string[];
  /**
   * 読み込む設定ソース。
   * 'user' を外すと ~/.claude/settings.json の permissions.allow を継承しない。
   */
  readonly settingSources?: readonly SettingSource[];
  /** 配信のタイムアウト（ミリ秒） */
  readonly timeoutMs?: number;
}

/** 読み取り専用エージェントに許可するツール */
export const READ_ONLY_TOOLS: readonly string[] = [
  'Read',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
];

/**
 * 読み取り専用エージェントで無効化するツール。
 *
 * `--allowedTools` は「追加で許可する」指定なので、
 * ~/.claude/settings.json の permissions.allow（Write / Edit / Bash など）を打ち消せない。
 * 確実に読み取りだけに絞るには、deny 側（--disallowedTools）で明示的に無効化する必要がある。
 */
export const DENY_WRITE_TOOLS: readonly string[] = [
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'Bash',
  'BashOutput',
  'KillShell',
  'KillBash',
  // サブエージェント経由で書き込まれるのを防ぐ
  'Task',
];

/** ファイル変更やコマンド実行ができるエージェントかどうか */
export const isFullAccessAgent = (agent: Agent): boolean => {
  const permissive =
    agent.permissionMode === 'bypassPermissions' ||
    agent.permissionMode === 'dontAsk' ||
    agent.permissionMode === 'acceptEdits' ||
    agent.permissionMode === 'auto';

  const writeDenied = (agent.disallowedTools ?? []).includes('Write');
  return permissive && !writeDenied;
};

/** メッセージの配信状態 */
export type MessageStatus =
  /** 下書き */
  | 'draft'
  /** 送信済み（ユーザー発） */
  | 'sent'
  /** 対応中（応答待ちのプレースホルダ） */
  | 'pending'
  /** 受信（エージェントの応答） */
  | 'received'
  /** 配信失敗 */
  | 'failed';

/** トークン使用量 */
export interface MessageUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/** Claude Code の実行結果メタ情報 */
export interface RunInfo {
  readonly costUsd?: number;
  readonly durationMs?: number;
  readonly numTurns?: number;
  /** 権限により実行されなかったツール名 */
  readonly deniedTools?: readonly string[];
}

export interface Message {
  readonly id: string;
  readonly threadId: string;
  readonly from: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly body: string;
  readonly status: MessageStatus;
  /** ISO 8601 */
  readonly createdAt: string;
  readonly inReplyTo?: string;
  readonly read: boolean;
  /** status === 'failed' のときの理由 */
  readonly error?: string;
  readonly usage?: MessageUsage;
  /** Claude Code のセッション ID（次回の --resume に使う） */
  readonly sessionId?: string;
  readonly run?: RunInfo;
  /**
   * 配信を担当しているサーバープロセスの ID（status === 'pending' のときだけ入る）。
   * プロセスが入れ替わると返信はもう届かないため、取り残しの判定に使う。
   */
  readonly deliveryProcessId?: string;
}

/** Message[] から導出するスレッド */
export interface Thread {
  readonly id: string;
  readonly subject: string;
  readonly participants: readonly string[];
  readonly lastMessageAt: string;
  readonly messageCount: number;
  readonly unreadCount: number;
  readonly snippet: string;
  readonly hasPending: boolean;
  readonly hasFailure: boolean;
}

/**
 * 表示するフォルダ。
 * 'home' は概要（ホーム）、'contacts' はアドレス帳で、どちらもスレッド一覧を出さない。
 */
export type Folder = 'home' | 'inbox' | 'sent' | 'drafts' | 'all' | 'contacts';

export const FOLDER_LABELS: Readonly<Record<Folder, string>> = {
  home: 'ホーム',
  inbox: '受信箱',
  sent: '送信済み',
  drafts: '下書き',
  all: '全件',
  contacts: 'アドレス帳',
};

/** 表示順に並べたフォルダ */
export const FOLDERS: readonly Folder[] = [
  'home',
  'inbox',
  'sent',
  'drafts',
  'all',
  'contacts',
];

export const NO_SUBJECT = '(件名なし)';

/** POST /api/messages のリクエストボディ */
export interface SendMessageRequest {
  readonly to: readonly string[];
  readonly subject: string;
  readonly body: string;
  readonly threadId?: string;
  readonly inReplyTo?: string;
  readonly draftId?: string;
}

/**
 * POST /api/messages のレスポンス。
 *
 * 配信の完了は待たず、保存した送信と「対応中」のプレースホルダを返す。
 * 返信が届くとプレースホルダが同じ ID で置き換わる。
 */
export interface SendMessageResponse {
  readonly sent: Message;
  readonly pending: readonly Message[];
}

/** 下書き保存のリクエストボディ */
export interface SaveDraftRequest {
  readonly id?: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly body: string;
  readonly threadId?: string;
}
