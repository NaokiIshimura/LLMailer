/** ディレクトリ一覧の 1 件 */
export interface DirectoryEntry {
  readonly name: string;
  /** 絶対パス */
  readonly path: string;
}

/** ディレクトリ選択ダイアログが 1 階層を表示するための情報 */
export interface DirectoryListing {
  /** 表示中のディレクトリの絶対パス */
  readonly path: string;
  /** エージェントに保存する値。プロジェクト配下なら相対パス、外なら絶対パス */
  readonly value: string;
  /** 親ディレクトリの絶対パス（ルートまで来ていたら null） */
  readonly parent: string | null;
  readonly entries: readonly DirectoryEntry[];
  /** 移動のショートカット */
  readonly shortcuts: {
    /** LLMailer プロジェクトのルート */
    readonly project: string;
    readonly home: string;
  };
}
