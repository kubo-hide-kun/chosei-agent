# リポジトリ構成メモ — 領域 → 入口の地図(steering)

> AI が毎回 repo 全体を読み直さないための補助地図。
> 「どの領域を触るか」を決めたら、ここから**入口(パス / 正本ドキュメント)**に最短で入る。
> 注意:本書は補助資料。古くなりうるので、最後は**現行コードと正本ドキュメント**を確認する。

## レイヤ(AGENTS.md §Architecture)

実装は `src/app/` を薄く、`src/lib/` を厚く。1 変更は次の方向に波及する。

```
src/app/ (page / Route Handler のみ)
  -> src/lib/schema.ts   (入稿 JSON のバリデーション・正規化)
  -> src/lib/store.ts    (イベント・回答の操作)
  -> src/lib/db.ts       (SQLite 接続・DDL)
  -> src/lib/agent/      (自然文 → 候補 JSON の AI エージェント)
UI: ページ配下のコンポーネント(スタイルは globals.css のデザイントークン経由)
```

## 領域 → 入口(変更・調査の初手)

| 領域 | 主なパス | 入口の手順 / 正本 |
|------|----------|------------------|
| 入稿 JSON 形式 | `src/lib/schema.ts` | [docs/JSON_FORMAT.md](../JSON_FORMAT.md) が正本。形式を変えたら**必ず**同期し、`tests/schema.test.ts` を更新 |
| AI エージェント(自然文解析) | `src/lib/agent/parse.ts`・`prompt.ts`・`fallback.ts` | プロンプトの正本は [docs/SYSTEM_PROMPT.md](../SYSTEM_PROMPT.md)(`prompt.ts` と同期必須)。フォールバック変更時は `tests/fallback.test.ts` を更新 |
| イベント作成・回答(永続化) | `src/lib/store.ts`・`src/lib/db.ts` | スキーマ変更は DDL(`db.ts`)と `tests/store.test.ts` をセットで。マイグレーション機構は未導入(導入するなら判断を記録) |
| API ルート | `src/app/api/**` | 422 は `{ error, issues }` 形式(AGENTS.md §Harness)。ハンドラは薄く、ロジックは `src/lib/` へ |
| 画面(作成・回答・集計) | `src/app/page.tsx`・`CreateEventForm.tsx`・`src/app/events/[id]/` | UI を触ったら「UI を作ったら必須の確認」(AGENTS.md §Workflow)が発火 |
| デザイントークン | `src/app/globals.css` | CSS カスタムプロパティが正本。生 HEX 直書き禁止、トークン経由で参照 |

## チェック / 検証コマンド(validation ladder)

| 目的 | コマンド |
|------|----------|
| 型の速い確認 | `npm run typecheck` |
| 対象を絞ったテスト | `npx vitest run <path>` / `-t <pattern>` |
| 全テスト | `npm test` |
| DoD(ビルド確認まで) | `npm run build` |

## 調査の初手

- 領域が分からない / 障害調査は、候補を最大 3 つに絞ってから調べる(AGENTS.md §First Read)
- 自分のツールで検証できることは自分で検証する(ログ・テスト・curl での API 確認)
