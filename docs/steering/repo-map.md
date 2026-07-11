# リポジトリ構成メモ — 領域 → 入口の地図(steering)

> AI が毎回 repo 全体を読み直さないための補助地図。
> 「どの領域を触るか」を決めたら、ここから**入口(パス / 正本ドキュメント)**に最短で入る。
> 注意:本書は補助資料。古くなりうるので、最後は**現行コードと正本ドキュメント**を確認する。

## レイヤ(AGENTS.md §Architecture)

実装は `src/app/` を薄く、`src/server/` を厚く。1 変更は次の方向に波及する。

```
src/app/ (page / Route Handler のみ)
  -> src/server/application/useCases (ビジネスロジック)
  -> src/server/domain               (スキーマ・正規化・ルールベース解析)
  -> src/server/repositories         (永続化のポート)
  -> src/server/infrastructure       (repositories / gateways / runtime = adapter 実装)
UI: ページ配下のコンポーネント(スタイルは globals.css のデザイントークン経由)
```

## 領域 → 入口(変更・調査の初手)

| 領域 | 主なパス | 入口の手順 / 正本 |
|------|----------|------------------|
| 入稿 JSON 形式 | `src/server/domain/event.ts` | [docs/JSON_FORMAT.md](../JSON_FORMAT.md) が正本([ADR 0002](../adr/0002JsonImportFormat.md))。形式を変えたら**必ず**同期し、`tests/schema.test.ts` を更新 |
| AI エージェント(候補日時抽出) | `src/server/application/useCases/parseScheduleText.ts`・`gateways/claudeScheduleGateway.ts`・`src/server/domain/scheduleText.ts` | プロンプトの正本は [docs/SYSTEM_PROMPT.md](../SYSTEM_PROMPT.md) §1(`gateways/schedulePrompt.ts` と同期必須)、解析戦略は [ADR 0003](../adr/0003AgentParsingStrategy.md)。フォールバック変更時は `tests/fallback.test.ts` を更新 |
| AI エージェント(出欠回答抽出) | `src/server/application/useCases/parseAnswerText.ts`・`gateways/claudeAnswerGateway.ts`・`src/server/domain/answerText.ts` | プロンプトの正本は [docs/SYSTEM_PROMPT.md](../SYSTEM_PROMPT.md) §2(`gateways/answerPrompt.ts` と同期必須)、判断は [ADR 0005](../adr/0005AiAnswerInput.md)。フォールバック変更時は `tests/answerText.test.ts` を更新 |
| 不正利用対策(合言葉・レートリミット・予算) | `src/server/infrastructure/runtime/security.ts`・各 API ルート | 判断は [ADR 0006](../adr/0006AbuseProtection.md)。変更時は `tests/security.test.ts` を更新。エラー文言は `ERROR_MESSAGES` に集約 |
| イベント作成・回答(永続化) | `src/server/application/useCases/events.ts`・`src/server/repositories/eventRepository.ts`・`src/server/infrastructure/repositories/sqliteEventRepository.ts` | DB スキーマ変更は DDL と `tests/store.test.ts` をセットで。レイヤの判断は [ADR 0001](../adr/0001HarnessAndArchitecture.md)。マイグレーション機構は未導入(導入するなら ADR 起票) |
| API ルート | `src/app/api/**` | 422 は `{ error, issues }` 形式(AGENTS.md §Harness)。ハンドラは薄く、ロジックは `src/server/` へ |
| 画面(作成・回答・集計) | `src/app/page.tsx`・`CreateEventForm.tsx`・`src/app/events/[id]/` | UI を触ったら「UI を作ったら必須の確認」(AGENTS.md §Workflow)が発火 |
| デザイントークン | `src/app/globals.css` | CSS カスタムプロパティが正本。生 HEX 直書き禁止、トークン経由で参照 |
| ユーザー向け使用案内 | [docs/USER_GUIDE.md](../USER_GUIDE.md)・アプリ内ガイド(トップの流れ表示・フォームのヘルプ・集計表の凡例) | 機能・画面・入稿形式を変えたら**両方**を同期する(リポジトリ側とアプリ内でズレを作らない) |
| ホスティング / デプロイ | `Dockerfile`・`railway.json` | 手順は [runbook/railway-deploy.md](../runbook/railway-deploy.md)、判断は [ADR 0007](../adr/0007RailwayHosting.md)。レプリカは 1 固定 |

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
