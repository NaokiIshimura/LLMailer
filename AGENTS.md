# LLMailer

メーラーの操作感でローカルの Claude Code へ指示を送る Next.js アプリ。
宛先＝エージェント、件名＝スレッドのお題、本文＝指示、返信＝Claude Code の応答。
機能の説明・画面の使い方・エージェント定義の書き方は `README.md` を参照する。

このファイルはコーディングエージェント向けの作業ルール。README と重複する説明は置かない。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 技術スタック

| 項目 | 内容 |
| --- | --- |
| フレームワーク | Next.js 16（App Router / Route Handlers） |
| UI | React 19 + CSS Modules（UI ライブラリは入れない） |
| 言語 | TypeScript（`strict`、パスエイリアス `@/*` → `src/*`） |
| 永続化 | `data/` 配下の JSON ファイル（DB なし） |
| LLM | ローカルの `claude` コマンド（API キー不要） |

テストフレームワークは未導入。検証は `npm run lint` と `npm run build`（型チェック込み）で行う。

## コマンド

```bash
npm run dev     # 開発サーバー（http://localhost:25110）
npm run lint    # ESLint
npm run build   # 型チェック込みのビルド
```

- コードを変更したら `npm run lint` と `npm run build` を通してから完了とする。
- `next dev` は同一ディレクトリで 2 つ同時に起動できない。既に起動していないか確認してから立ち上げる。
- 依存の追加は最小限にする（UI ライブラリ・状態管理ライブラリは入れない方針）。

## ディレクトリ構成

```
src/
├─ app/
│  ├─ page.tsx                  # Mailbox を配置するのみ
│  ├─ layout.tsx / globals.css  # テーマ変数はここ
│  └─ api/                      # Route Handlers（agents / templates / threads / messages / files / directories）
├─ features/Mailbox/
│  ├─ Mailbox.tsx               # 3 ペインの組み立て（唯一の画面）
│  ├─ hooks/                    # 取得・送信・作成のロジック
│  └─ components/               # 表示のみ（状態を持たない）
├─ lib/
│  ├─ api/                      # リクエスト検証・レスポンス整形・fetch ラッパ
│  ├─ claudeCode/               # claude コマンドの実行とプロンプト組み立て
│  ├─ transport/                # 「配信して返信を得る」抽象
│  ├─ store/                    # JSON ファイル永続化（リポジトリ層）
│  └─ thread.ts                 # Message[] → Thread[] の導出
└─ types/mail.ts                # 中心的な型（Agent / Message / Thread / Template）
```

## 設計上の約束

変更するときに壊してはいけない前提。

- **メッセージが唯一の真実の source**。スレッドは `Message[]` から導出する実体のない概念で、
  導出できない情報（アーカイブ日時）だけを `data/threads/states.json` に置く。
  アーカイブは真偽値ではなく日時で持ち、それより後のメッセージがあれば「やり取りが再開した」と見なす。
- **メッセージは相手のエージェント（`agentIds`）だけを持つ**。自分が出したものかどうかは
  配信状態（`status`）から導出する。
- **配信は `Transport` インターフェース越し**に呼ぶ。`lib/claudeCode` を UI や API から直接呼ばない
  （実メール実装へ差し替えられる形を保つ）。
- **会話履歴は Claude Code のセッション側が持つ**。LLMailer が渡すのは「前回の応答以降に増えた分」だけ。
- **`POST /api/messages` は配信を待たない**。「対応中」のプレースホルダを保存した時点で応答し、
  実際の配信は `after()` で続け、返信が届いたらプレースホルダを**同じ ID で上書き**する。
  「対応中」はサーバー側の状態なので、ブラウザのメモリに状態を持たせない。
- **対応中のプレースホルダは配信を担当するプロセス ID を持つ**。別プロセスのものが残っていたら、
  読み出し時に「配信失敗」へ倒す（サーバーを止めると返信はもう届かないため）。
- **スレッド ID はクライアントで決める**。応答を待たずにそのスレッドを開けるようにするため。
- **`claude` は `spawn`（`shell: false`）で起動し、プロンプトは標準入力から渡す**。
  `--allowedTools` などの可変長オプションは後続の引数を飲み込むため、カンマ区切りの 1 引数で渡す。
- **親から継承する `CLAUDE*` 環境変数は子プロセスへ渡す前に落とす**
  （LLMailer 自身が Claude Code から起動されている場合があるため）。
- **エージェントの `id` はサーバーが採番**し、リクエストからは受け取らない。画面には出さず、名前で見分ける。
  名前の重複は 409 で弾く。
- **読み取り専用エージェントは `disallowedTools` + `settingSources` から `user` を外す**ことで実現する。
  `allowedTools` だけではグローバルの `permissions.allow` を打ち消せない。

## API

| メソッド | パス | 用途 |
| --- | --- | --- |
| GET | `/api/agents` | エージェント一覧 |
| POST | `/api/agents` | エージェント追加（ID はサーバーが採番） |
| PUT | `/api/agents/[id]` | エージェント変更 |
| DELETE | `/api/agents/[id]` | エージェント削除 |
| GET | `/api/templates` | テンプレート一覧 |
| POST | `/api/templates` | テンプレート追加（ID はサーバーが採番） |
| PUT | `/api/templates/[id]` | テンプレート変更（デフォルトのぶんは 403） |
| DELETE | `/api/templates/[id]` | テンプレート削除（デフォルトのぶんは 403） |
| GET | `/api/threads?folder=&q=` | スレッド一覧・下書き一覧・未読件数・対応中件数 |
| GET | `/api/threads/[id]` | スレッド詳細 |
| PATCH | `/api/threads/[id]` | スレッドを既読にする（`{ "archived": true }` でアーカイブ、`false` で解除） |
| POST | `/api/messages` | 送信する（配信は待たず、宛先ごとの「対応中」を返す） |
| POST | `/api/messages/drafts` | 下書き保存 |
| DELETE | `/api/messages/[id]` | メッセージ（下書き）削除 |

## コーディング規約

`.claude` や外部ガイドより、まず**周辺のコードに合わせる**。以下は既存コードから読み取れる実際の慣習。

### 共通

- コメント・エラーメッセージ・UI 文言は日本語。「なぜそうしているか」を書き、自明な説明は書かない。
- 公開する関数・型には JSDoc（`/** … */`）を 1 行で付ける。
- シングルクォート、セミコロンあり、アロー関数で定義して `export const` で名前付きエクスポートする
  （`export default` は Next.js が要求する `app/page.tsx` / `app/layout.tsx` だけ）。
- ファイル末尾は必ず空行で終える。

### コンポーネント（`features/Mailbox/components/`）

- 1 コンポーネント = 1 ディレクトリ。`index.tsx` + `<Name>.module.css` を並べ、
  `components/index.ts` の barrel から名前付きで再エクスポートする。
- Props は `interface <Name>Props` で定義し、**各プロパティに `readonly`** を付ける。
  配列は `readonly T[]` を使う。
- コンポーネントは**表示に専念**する。データ取得や永続化はフックへ寄せる
  （開閉状態のようなローカル UI 状態は持ってよい）。
- ブラウザ API を触るものには `'use client'` を付ける。
- スタイルは CSS Modules のみ。色・間隔は `globals.css` の CSS 変数を使い、値を直書きしない。

### フック（`features/Mailbox/hooks/`）

- 1 フック = 1 ファイル。`use<Name>` と戻り値型 `Use<Name>Result` を `hooks/index.ts` から再エクスポートする。
- 取得系は `useJsonResource` に寄せ、`{ data, loading, error, reload }` の形に揃える。
- API 呼び出しは `lib/api/fetchJson.ts` の `fetchJson` を使い、`fetch` を直接書かない。
- **API リクエスト中はローダーを表示**する（開始時に表示、成功・失敗を問わず完了時に非表示）。

### Route Handlers（`app/api/`）

- `export const GET = async (request: NextRequest): Promise<NextResponse> => { … }` の形。
- 全体を `try/catch` で包み、想定外は `unexpectedErrorResponse('<METHOD> <path>', error)` に流す。
- 入力検証は `lib/api/` のパーサ（`parseAgentFields` / `parseTemplateFields` など）に置き、
  失敗は `errorResponse('…', 400)`。競合は 409、変更不可のものへの操作は 403。
- 永続化は `lib/store/` のリポジトリ経由。Route Handler から `fs` を直接触らない。

### 永続化（`lib/store/`）

- 読み書きは `jsonFile.ts` のヘルパを通す（書き込みは直列化される）。
- 同梱ファイル（`default.json`）は `readJsonFileIfExists` で読む。
  `readJsonFile` を使うと存在しないときに書き戻され、意図しない差分が出る。
- スレッド ID は `[A-Za-z0-9_-]+` のみ。`drafts` / `states` / `index` は予約語で使えない（400）。

## データ

| パス | 内容 | 扱い |
| --- | --- | --- |
| `data/agents/default.json` | 既定のエージェント | 同梱。コミット対象。画面からは変更・削除できない |
| `data/agents/custom.json` | 画面から追加したエージェント | 利用者ぶん。`.gitignore` 済み |
| `data/templates/default.json` | 同梱のテンプレート | 同梱。コミット対象。画面からは変更・削除できない |
| `data/templates/custom.json` | 画面から追加したテンプレート | 利用者ぶん。`.gitignore` 済み |
| `data/threads/<threadId>.json` | スレッドごとの送受信メッセージ | 利用者の実データ。`.gitignore` 済み |
| `data/threads/drafts.json` | 下書き | 利用者の実データ。`.gitignore` 済み |
| `data/threads/states.json` | スレッドのアーカイブ日時 | 利用者の実データ。`.gitignore` 済み |

- **`data/threads/` 配下と `custom.json` を勝手に書き換えない**（利用者の実データ）。
- 既定と利用者ぶんを分けているのは、個人のエージェント（作業ディレクトリに絶対パスが入る）を
  git の差分に出さないため。テンプレートも同じ理由で分けている。
- 1 ファイル = 1 スレッドにしているのは、1 つの JSON にまとめると返信が 1 通増えるたびに
  それまでのやり取りをすべて書き直すことになるため。ファイル名がそのままスレッド ID になる。
- 同梱ファイルを増やすときは、利用者ぶんと同じ形式にして `isDefault` で区別できるようにする。
  テンプレートの本文はそのままエージェントへの指示になるため、改行やインデントを落とさずに保存する。
- 以前の名前で保存されたファイルは、初回の読み込みで下表のとおり引き継がれる。
  処理は `lib/store/legacy.ts` にあるので、保存先の形を変えるときはここも見る。

| 以前のファイル | 引き継ぎ先 |
| --- | --- |
| `data/agents/user.json`、さらに前の `data/agents.json` | `data/agents/custom.json`（既定を除いたぶん） |
| `data/messages.json` | `data/threads/<threadId>.json`（元は `data/messages.json.bak` へ退避） |
| `data/threadStates.json` | `data/threads/states.json` |

## 作業の進め方

- 変更後は周辺のコードを参考にリファクタリングし、命名・コメント量・粒度を揃える。
- API やデータの置き場所を変えたら、このファイルの「API」「データ」の表も更新する。
- 画面の挙動・エージェント定義の書き方を変えたら `README.md` の該当箇所も更新する。
- コミットメッセージは日本語の常体（例:「本文へ定型文を差し込めるテンプレート機能を追加する」）。
- ブランチ名に `feature/` は付けず、内容を表す短い英語（例: `compose-templates`）にする。
- `.claude/` `.vscode/` `.serena/` はコミットしない。一時ファイルは `.claude/` 配下に置く。
- 上の Next.js 管理ブロックは `next dev` が書き戻すので、消さずにそのまま残す。
