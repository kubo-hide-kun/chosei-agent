# chosei-agent

調整さんライクな日程調整サービス + AI エージェント。

候補日時をボタン操作で 1 件ずつ登録する代わりに、**JSON でまとめて入稿**したり、
**AI エージェントに自然文から候補を組み立てさせたり**できます。

## 機能

- **JSON 一括入稿**: 候補日時を JSON でまとめて登録(形式は [docs/JSON_FORMAT.md](docs/JSON_FORMAT.md))
- **AI エージェント入稿**: 「来週の火曜と木曜の夜」のような自然文から候補日時 JSON を自動生成
  - `ANTHROPIC_API_KEY` があれば Claude API、なければルールベースのフォールバックで解析
- **出欠回答**: 共有 URL から参加者が候補ごとに ◯ / △ / ✕ で回答
- **集計表示**: 調整さん風のマトリクス表示。最有力候補(◯=2点, △=1点)をハイライト

## 使い方

利用者向けの案内(イベント作成 → URL 共有 → 出欠回答 → 日程決定の流れ)は
[docs/USER_GUIDE.md](docs/USER_GUIDE.md) を参照。

## セットアップ

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY を設定(任意)
npm run dev                  # http://localhost:3000
```

| コマンド | 説明 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` / `npm start` | 本番ビルド / 起動 |
| `npm test` | ユニットテスト (vitest) |
| `npm run typecheck` | 型チェック |

## 環境変数

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | - | 未設定の場合、自然文解析はルールベースにフォールバック |
| `CHOSEI_AGENT_MODEL` | - | 使用モデル(既定: `claude-sonnet-5`) |
| `CHOSEI_DATA_DIR` | - | SQLite の保存先(既定: `./data`) |

## アーキテクチャ

- **Next.js 15 (App Router) + TypeScript**
- **SQLite** (better-sqlite3): `events` / `candidates` / `responses` / `answers`
- **zod**: 入稿 JSON のバリデーション(`src/server/domain/event.ts`)
- **AI エージェント**: システムプロンプトの正本は [docs/SYSTEM_PROMPT.md](docs/SYSTEM_PROMPT.md)
- **開発規約**: [AGENTS.md](AGENTS.md)、領域の地図は [docs/steering/repo-map.md](docs/steering/repo-map.md)
- **デザイン**: 独自デザイントークン(`src/app/globals.css` の CSS カスタムプロパティ)で統一

## API

| メソッド | パス | 説明 |
| --- | --- | --- |
| `POST` | `/api/events` | イベント作成(入稿 JSON を受け付け) |
| `GET` | `/api/events/:id` | イベント詳細・回答一覧 |
| `POST` | `/api/events/:id/responses` | 出欠回答の登録 |
| `POST` | `/api/agent/parse` | 自然文 → 入稿 JSON 変換 |
