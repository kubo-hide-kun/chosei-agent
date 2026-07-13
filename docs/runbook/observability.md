# Observability / ログの読み方

構造化ログ・監査ログ・requestId 追跡の運用手順。判断の記録は [ADR 0008](../adr/0008StructuredLoggingAndAudit.md)。

## ログの形式

すべてのログは **1 イベント = 1 JSON 行(stdout)**。Railway では Observability(Logs)タブで
そのまま検索できる(追加のログ基盤は不要)。

```json
{"time":"2026-07-11T12:34:56.789Z","level":"info","event":"api.request","requestId":"...","route":"/api/events","method":"POST","status":201,"durationMs":12,"ip":"..."}
```

| フィールド | 説明 |
|-----------|------|
| `event` | イベント種別(下の一覧)。`audit.*` は監査イベント |
| `requestId` | リクエスト単位の追跡 ID。レスポンスの `x-request-id` ヘッダと一致 |
| `level` | `info` / `warn` / `error` |

## イベント一覧

### アクセスログ

| event | 意味 | 主なフィールド |
|-------|------|---------------|
| `api.request` | API リクエスト完了(全ルート共通) | route, method, status, durationMs, ip |
| `api.unhandled_error` | 未捕捉例外(500)。スタックはログのみに残り応答には出ない | message, stack |
| `agent.parse` | AI 解析の実行結果 | kind(schedule/answers), engine, ok, textLength, durationMs |
| `agent.claude_fallback` | Claude 呼び出しが失敗しルールベースに縮退 | kind, message, rawLength(JSON parse 失敗時のみ), stopReason(同) |

### 監査イベント(`audit.*`, `audit: true`)

| event | 意味 | 主なフィールド |
|-------|------|---------------|
| `audit.event.created` | イベント作成 | eventId, candidateCount, ip |
| `audit.response.added` | 出欠回答の登録 | eventId, responseId, answerCount, hasComment, ip |
| `audit.auth.denied` | 合言葉の不一致(401) | route, ip |
| `audit.rate.limited` | レートリミット超過(429) | route, ip |
| `audit.agent.budget_exhausted` | Claude 日次予算の超過(縮退発動) | route, ip |

## PII の扱い

**名前・コメント本文・自然文入力の内容はログに残さない**(ID・件数・文字数のみ)。
ログ出力を追加するときもこの原則を守る(正本: `src/server/infrastructure/logging/logger.ts` のヘッダコメント)。

## 調査手順

### ユーザーから「エラーが出た」と報告されたとき

1. 500 エラー画面/レスポンスに **requestId** が含まれているので聞き取る
2. Railway の Logs でその requestId を検索する
3. `api.unhandled_error` の行に message / stack があるので原因を特定する

### 不正利用が疑われるとき

1. Logs で `audit.auth.denied` / `audit.rate.limited` を検索する
2. `ip` フィールドで集計し、特定 IP からの集中を確認する
3. 攻撃が続く場合は `CHOSEI_ACCESS_KEY` をローテーションする
   (手順: [railway-deploy.md](./railway-deploy.md) の「合言葉のローテーション」)

### Claude のコストを確認したいとき

1. `agent.parse` の `engine` 別件数で Claude / ルールベースの割合を見る
2. `audit.agent.budget_exhausted` が出ていれば日次上限に到達している
   (上限変更は `CHOSEI_AGENT_DAILY_LIMIT`)

### `agent.claude_fallback` が JSON parse エラーで多発するとき

トークンは消費されている(=API 呼び出し自体は成功している)のに毎回 fallback する場合、
`rawLength` / `stopReason` フィールドで切り分ける。

- `stopReason` が `max_tokens` → 出力が途中で切れて不完全な JSON になっている。
  `claudeScheduleGateway.ts` / `claudeAnswerGateway.ts` の `max_tokens` を引き上げる
- `stopReason` が `end_turn` で `rawLength` が想定より大きい → モデルが JSON の前後に
  説明文を付けている可能性が高い(`parseClaudeJson` は前後の説明文があっても JSON 本体を
  抽出するが、JSON 自体が壊れていれば抽出できない)。プロンプト(`docs/SYSTEM_PROMPT.md`)の
  出力形式指定を強めるか、モデル(`CHOSEI_AGENT_MODEL`)を見直す
- `rawLength` が 0 → 応答に text ブロックが含まれていない(空応答)

## 実装の入口

- ロガー: `src/server/infrastructure/logging/logger.ts`
- API 共通ラッパ(requestId 採番・アクセスログ・500 変換): `src/server/infrastructure/logging/withApiLogging.ts`
- 新しい API ルートを作るときは必ず `withApiLogging` で包み、状態変更には `reqLog.audit()` を付ける
