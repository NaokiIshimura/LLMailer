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

/** 指定できる権限モード（リクエストの検証にも使う） */
export const PERMISSION_MODES: readonly PermissionMode[] = [
  'manual',
  'acceptEdits',
  'auto',
  'dontAsk',
  'bypassPermissions',
  'plan',
];

/** Claude Code が読み込む設定ソース */
export type SettingSource = 'user' | 'project' | 'local';

export const SETTING_SOURCES: readonly SettingSource[] = [
  'user',
  'project',
  'local',
];

/** 宛先となる AI エージェント（ローカルの Claude Code を 1 プロセス起動する単位） */
export interface Agent {
  /**
   * エージェントの識別子。追加時にサーバーが採番し、後から変更しない。
   * 送受信済みメッセージから参照されるだけで、画面には出さない。
   */
  readonly id: string;
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

/**
 * 一覧で返すエージェント。
 *
 * デフォルトかどうかは data/agents/default.json に入っているかで決まり、
 * このファイルはサーバーでしか読めない。画面から見分けられるよう、
 * 一覧を返すときにサーバーが付ける（保存する値ではない）。
 */
export interface ListedAgent extends Agent {
  readonly isDefault: boolean;
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

/**
 * 画面から選べる権限のプリセット。
 *
 * Claude Code の権限指定は permissionMode・allowedTools・disallowedTools・
 * settingSources の組み合わせで決まり、単独では読み取り専用を担保できない。
 * 取り違えると意図せずファイルを書き換えられてしまうため、
 * 画面ではこの 2 つのプリセットからだけ選ばせる。
 */
export type AgentAccess = 'full' | 'readOnly';

export const AGENT_ACCESS_LABELS: Readonly<Record<AgentAccess, string>> = {
  full: 'フル権限（ファイル変更・コマンド実行）',
  readOnly: '読み取り専用（読み取りと検索のみ）',
};

/** 表示順に並べた権限プリセット */
export const AGENT_ACCESSES: readonly AgentAccess[] = ['readOnly', 'full'];

/** エージェントの権限に関わる設定 */
export type AgentPermission = Pick<
  Agent,
  'permissionMode' | 'allowedTools' | 'disallowedTools' | 'settingSources'
>;

/** プリセットから、Claude Code に渡す権限設定を組み立てる */
export const toAgentPermission = (access: AgentAccess): AgentPermission =>
  access === 'full'
    ? { permissionMode: 'bypassPermissions' }
    : {
        permissionMode: 'manual',
        allowedTools: READ_ONLY_TOOLS,
        disallowedTools: DENY_WRITE_TOOLS,
        settingSources: ['project', 'local'],
      };

/** 既存のエージェントがどちらのプリセットに当たるか */
export const toAgentAccess = (agent: Agent): AgentAccess =>
  isFullAccessAgent(agent) ? 'full' : 'readOnly';

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
  /**
   * 属するスレッド。
   * 保存形には持たず、スレッドファイル側の値を読み込み時に補う（下書きだけは自分で持つ）。
   */
  readonly threadId: string;
  /**
   * やり取りの相手となるエージェント。
   * 自分が出したもの（下書き・送信済み）は宛先、
   * エージェント側のもの（対応中・受信・失敗）は差出人の 1 件が入る。
   */
  readonly agentIds: readonly string[];
  /**
   * 件名。スレッド内では全通が同じ値になるため、
   * threadId と同じくスレッドファイル側から補う（下書きだけは自分で持つ）。
   */
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

/**
 * 自分が出したメッセージか。
 *
 * やり取りは常に「自分 ↔ エージェント」なので、配信状態から向きが決まる。
 * 利用者を表すアドレスを持たなくても、これで送信と受信を見分けられる。
 */
export const isOutgoingMessage = (message: Pick<Message, 'status'>): boolean =>
  message.status === 'draft' || message.status === 'sent';

/** スレッドファイルから導出するスレッド */
export interface Thread {
  readonly id: string;
  /** スレッドのお題。最初の送信の件名で決まり、後から変更できる */
  readonly subject: string;
  /** このスレッドに出てくるエージェントの ID */
  readonly participants: readonly string[];
  readonly lastMessageAt: string;
  readonly messageCount: number;
  readonly unreadCount: number;
  readonly snippet: string;
  readonly hasPending: boolean;
  readonly hasFailure: boolean;
  /**
   * 対応が済んだものとして片付けられているか。
   * アーカイブしたあとにメッセージが加わると、やり取りが再開したものとして false に戻る。
   */
  readonly archived: boolean;
}

/**
 * 表示するフォルダ。
 * 'home' は概要（ホーム）、'contacts' はアドレス帳、'settings' は設定で、
 * いずれもスレッド一覧を出さない。
 * 'mailbox' は送受信を区別せず、すべてのスレッドを 1 つの一覧にまとめる。
 * 'archive' は対応が済んだものとして 'mailbox' から外したスレッドを出す。
 */
export type Folder =
  | 'home'
  | 'mailbox'
  | 'archive'
  | 'drafts'
  | 'contacts'
  | 'settings';

export const FOLDER_LABELS: Readonly<Record<Folder, string>> = {
  home: 'ホーム',
  mailbox: 'メールボックス',
  archive: 'アーカイブ',
  drafts: '下書き',
  contacts: 'アドレス帳',
  settings: '設定',
};

/** メールの一覧を出すフォルダ（サイドバーで宛先一覧より上に並べる） */
export const MAIL_FOLDERS: readonly Folder[] = [
  'home',
  'mailbox',
  'archive',
  'drafts',
];

/** メール以外の画面（サイドバーで宛先一覧より下に並べる） */
export const TOOL_FOLDERS: readonly Folder[] = ['contacts', 'settings'];

/** 表示順に並べたフォルダ */
export const FOLDERS: readonly Folder[] = [...MAIL_FOLDERS, ...TOOL_FOLDERS];

/** スレッドの一覧と本文を出すフォルダか（ホーム・アドレス帳・設定は専用の画面を出す） */
export const isThreadPaneFolder = (folder: Folder): boolean =>
  folder === 'mailbox' || folder === 'archive' || folder === 'drafts';

export const NO_SUBJECT = '(件名なし)';

/** POST /api/messages のリクエストボディ */
export interface SendMessageRequest {
  /** 宛先のエージェント ID */
  readonly agentIds: readonly string[];
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

/**
 * POST /api/agents のリクエストボディ。
 * ID はサーバーが採番するので、追加でも変更でも同じ内容を送る。
 */
export type CreateAgentRequest = Omit<Agent, 'id'>;

/**
 * PUT /api/agents/[id] のリクエストボディ。
 * ID は送受信済みメッセージから参照される識別子なので、後から変更しない。
 */
export type UpdateAgentRequest = Omit<Agent, 'id'>;

/**
 * PATCH /api/threads/[id] のリクエストボディ。
 *
 * スレッドはメッセージを送ると生まれるもので、作成も削除もしない。
 * 件名と、読んだ・片付けたという状態の更新だけを受け付ける。
 */
export interface UpdateThreadRequest {
  /** true でスレッド内の未読をすべて既読にする（ボディを省略したときと同じ） */
  readonly read?: boolean;
  /** true でアーカイブ、false で解除 */
  readonly archived?: boolean;
  /** スレッドのお題を変える（メッセージ単位では持たないため、表示はすべて変わる） */
  readonly subject?: string;
}

/**
 * スレッドの件名の長さの上限。
 *
 * 件名は一覧でも本文の見出しでも 1 行に収めて出すため、
 * 長さを制限して扱える範囲に収める。
 */
export const THREAD_SUBJECT_MAX_LENGTH = 200;

/** 下書き保存のリクエストボディ */
export interface SaveDraftRequest {
  readonly id?: string;
  /** 宛先のエージェント ID */
  readonly agentIds: readonly string[];
  readonly subject: string;
  readonly body: string;
  readonly threadId?: string;
}

/**
 * 本文へ差し込む定型文。
 *
 * エージェントへの指示は「調べてほしいこと」「出力してほしいこと」のように
 * 書き出しが似通うため、よく使う型を保存しておけるようにする。
 */
export interface Template {
  /**
   * テンプレートの識別子。追加時にサーバーが採番し、後から変更しない。
   * 同梱するぶんだけは、JSON をそのまま読んで分かるよう手で名前を付けている。
   */
  readonly id: string;
  readonly name: string;
  /** 差し込む定型文。改行やインデントもそのまま指示になるため加工しない */
  readonly body: string;
  readonly description?: string;
}

/**
 * 一覧で返すテンプレート。
 *
 * デフォルトかどうかは data/templates/default.json に入っているかで決まり、
 * このファイルはサーバーでしか読めない。エージェントと同じく、
 * 一覧を返すときにサーバーが付ける（保存する値ではない）。
 */
export interface ListedTemplate extends Template {
  readonly isDefault: boolean;
}

/**
 * POST /api/templates のリクエストボディ。
 * ID はサーバーが採番するので、追加でも変更でも同じ内容を送る。
 */
export type CreateTemplateRequest = Omit<Template, 'id'>;

/** PUT /api/templates/[id] のリクエストボディ */
export type UpdateTemplateRequest = Omit<Template, 'id'>;
