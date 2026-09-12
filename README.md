# LLMailer

メーラーの操作感で、**ローカルの Claude Code** に指示を送るクライアント。

チャット UI ではなく、受信箱・スレッド・作成ウィンドウを持つメールクライアントとして LLM を扱う。
Claude API のキーは不要で、すでにログイン済みの Claude Code をそのまま使う。

| メールの概念 | LLMailer での意味 |
| --- | --- |
| 宛先（To） | AI エージェント（モデル・権限・作業ディレクトリの組） |
| 件名（Subject） | スレッドのお題 |
| 本文（Body） | 指示 |
| 返信 | Claude Code の応答 |
| スレッド | Claude Code のセッション（`--resume` で継続） |
| アドレス帳 | エージェント定義一覧（受信箱と並ぶフォルダの 1 つ） |
| 配信失敗通知 | 実行エラー・タイムアウト |

宛先を複数選べば、同じ指示が各エージェントへ**並行配信**され、返信が並んで届く。

## 必要なもの

- Node.js 20 以上
- ログイン済みの [Claude Code](https://claude.com/claude-code)（`claude` コマンドが PATH にあること）

API キーの設定は不要。`claude` が別の場所にある場合は環境変数 `LLMAILER_CLAUDE_BIN` にパスを指定する。

## セットアップ

```bash
npm install
npm run dev
```

`http://localhost:3000` を開く。

## 使い方

1. 左サイドバーの「✉ 新規作成」を押す
2. 宛先（エージェント）を選び、件名と本文（指示）を書く
3. 「送信」を押すと**作成ウィンドウはすぐ閉じ**、そのスレッドが開いて「対応中…」が表示される
   （応答を待つ必要はなく、他のスレッドを見に行ける。一覧のタグと右下のインジケータにも「対応中」が出る）
4. 応答が届くとスレッドに追加される（対応中のあいだは自動で取得し直す）
5. スレッド右上の「↩ 返信」で会話を続ける（Claude Code のセッションが `--resume` され、文脈が引き継がれる）

フォルダは「受信箱 / 送信済み / 下書き / 全件 / アドレス帳」。フォルダを切り替えると検索条件はクリアされる。

- メッセージ本文は **Markdown として装飾表示**される（見出し・リスト・表・コードブロック・引用・リンク）。
  生の HTML は解釈しないため、応答をそのまま描画しても安全。
- 受信メッセージには、実行コスト・所要時間・ターン数・トークン数が表示される。
- 送信そのものが失敗した場合（サーバーに届かなかった場合）は、入力内容を保ったまま作成ウィンドウが戻る。
- 「対応中」は**サーバー側に保存された状態**なので、ブラウザをリロードしても・別のタブで開いても消えない。
  配信中にサーバーを止めた場合は、次のアクセス時に「配信失敗」へ倒れ、そのまま再送できる。

## エージェントと権限

メール 1 通でローカルのファイルが書き換わりうるため、**権限は宛先ごとに分けている**。
左サイドバーの「アドレス帳」を選ぶと、受信箱と同じ 3 ペインでエージェントの一覧と詳細を見られる。
一覧には `フル権限` / `読み取り専用` のバッジが付き、詳細ではモデル・作業ディレクトリ・
許可ツール・無効化ツール・設定ソース・役割（システムプロンプト）を確認できる。
詳細の「✉ メールを書く」から、その宛先を指定した状態で作成ウィンドウが開く。

| アドレス | 名前 | モデル | 権限 |
| --- | --- | --- | --- |
| `opus@llmailer.local` | Opus（汎用） | opus | 読み取り専用 |
| `worker@llmailer.local` | 作業担当 | opus | **フル権限**（ファイル変更・コマンド実行） |
| `reviewer@llmailer.local` | コードレビュアー | opus | 読み取り専用 |
| `haiku@llmailer.local` | Haiku（高速） | haiku | 読み取り専用 |
| `translator@llmailer.local` | 翻訳担当 | sonnet | 読み取り専用 |

定義は `data/agents.json`（初回起動時に生成）。

```jsonc
{
  "address": "myrepo@llmailer.local",
  "name": "myrepo 担当",
  "model": "opus",                       // opus / sonnet / haiku またはフル名
  "systemPrompt": "…",                   // --append-system-prompt に渡す役割
  "description": "…",
  "workingDirectory": "../myrepo",        // Claude Code の cwd（相対は本プロジェクトから）
  "permissionMode": "bypassPermissions",  // フル権限
  "timeoutMs": 600000
}
```

### 読み取り専用の作り方（重要）

`allowedTools` は「**追加で許可する**」指定で、`~/.claude/settings.json` の
`permissions.allow`（`Write` / `Edit` / `Bash(...)` など）を打ち消せない。
確実に読み取りだけに絞るには、次の 2 つを併用する。

```jsonc
{
  "permissionMode": "manual",
  "allowedTools": ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
  "disallowedTools": ["Write", "Edit", "MultiEdit", "NotebookEdit",
                      "Bash", "BashOutput", "KillShell", "KillBash", "Task"],
  "settingSources": ["project", "local"]   // 'user' を外してグローバル allow を継承しない
}
```

deny（`disallowedTools`）は allow より優先される。既定の読み取り専用エージェントはこの形で定義済み。

## 構成

```
src/
├─ app/
│  ├─ page.tsx                  # Mailbox を配置するのみ
│  └─ api/                      # Route Handlers
├─ features/Mailbox/
│  ├─ Mailbox.tsx               # 3 ペインの組み立て
│  ├─ hooks/                    # 取得・送信・作成のロジック
│  └─ components/               # 表示のみ（状態を持たない）
├─ lib/
│  ├─ claudeCode/               # claude コマンドの実行とプロンプト組み立て
│  ├─ transport/                # 「配信して返信を得る」抽象
│  ├─ store/                    # JSON ファイル永続化
│  └─ thread.ts                 # Message[] → Thread[] の導出
└─ types/mail.ts                # 中心的な型
```

- メッセージが唯一の真実の source で、スレッドは `Message[]` から導出する
- 配信は `Transport` インターフェース越しに呼ぶため、実メール（SMTP/IMAP）実装へ差し替えられる
- 会話履歴は Claude Code のセッションが保持し、LLMailer は「前回の応答以降に増えた分」だけを渡す
- `claude` は `spawn`（`shell: false`）で起動し、プロンプトは標準入力から渡す
  （`--allowedTools` などの可変長オプションが後続の引数を飲み込むため）
- 親プロセスが Claude Code の場合に継承される `CLAUDE*` 環境変数は、子プロセスへ渡す前に落とす
- 新規送信でもスレッド ID をクライアントで決めるため、応答を待たずにそのスレッドを開ける
- `POST /api/messages` は送信と「対応中」のプレースホルダを保存した時点で応答し、配信は
  `after()` で応答後に続ける。返信が届くとプレースホルダを**同じ ID で上書き**する
  （状態がブラウザのメモリに無いため、リロードしても「対応中」が消えない）
- 対応中のプレースホルダには配信を担当するプロセス ID を持たせ、別プロセスのものが残っていたら
  読み出し時に「配信失敗」へ倒す（サーバーを止めると返信はもう届かないため）

### API

| メソッド | パス | 用途 |
| --- | --- | --- |
| GET | `/api/agents` | エージェント一覧 |
| GET | `/api/threads?folder=&q=` | スレッド一覧・下書き一覧・未読件数・対応中件数 |
| GET | `/api/threads/[id]` | スレッド詳細 |
| PATCH | `/api/threads/[id]` | スレッドを既読にする |
| POST | `/api/messages` | 送信する（配信は待たず、宛先ごとの「対応中」を返す） |
| POST | `/api/messages/drafts` | 下書き保存 |
| DELETE | `/api/messages/[id]` | メッセージ（下書き）削除 |

## データ

- `data/agents.json` — エージェント定義（コミット対象）
- `data/messages.json` — 送受信したメッセージ（`.gitignore` 済み）

## 開発

```bash
npm run lint    # ESLint
npm run build   # 型チェック込みのビルド
```

`next dev` は同一ディレクトリで 2 つ同時に起動できない点に注意。

## 今後の拡張

| 項目 | 接続点 |
| --- | --- |
| ストリーミング受信 | `--output-format stream-json` と `Transport.deliverStream()` を追加し SSE 化 |
| コードのシンタックスハイライト | `MarkdownBody` の `code` コンポーネントを差し替える |
| エージェント CRUD | アドレス帳の詳細画面に編集フォームを足す（現在は `data/agents.json` を直接編集） |
| 実メール連携 | `Transport` を満たす `MailTransport`（SMTP/IMAP）を追加 |
| SQLite 移行 | `lib/store` のリポジトリ実装を差し替え |
