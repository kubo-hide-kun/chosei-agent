# ADR 0008: 構造化ログと監査イベント(stdout JSON + requestId)

- ステータス: Accepted
- 日付: 2026-07-11

## 背景

これまでログは Next.js の既定出力と散発的な `console.error` のみで、
(1) 障害時にリクエスト単位で追跡できない、(2) 誰がいつイベント作成・回答・認証失敗したかの
監査証跡がない、(3) Claude 縮退やコスト状況が観測できない、という状態だった。

## 決定

1. **構造化ログ**: 1 イベント = 1 JSON 行を stdout に出す(`infrastructure/logging/logger.ts`)。
   ログ基盤は追加せず、ホスティング(Railway)の標準ログ収集に乗せる
2. **requestId**: 全 API ルートを共通ラッパ `withApiLogging` で包み、リクエストごとに
   requestId を採番。全ログ行・`x-request-id` ヘッダ・500 応答本文に付与する。
   未捕捉例外はスタックをログにのみ残し、応答には出さない
3. **監査イベント**: 状態変更(イベント作成・回答登録)とセキュリティ事象
   (401 / 429 / Claude 予算超過)を `audit.*` 名前空間 + `audit: true` で記録する
4. **PII 最小化**: 名前・コメント・自然文入力の本文はログに残さない(ID・件数・文字数のみ)
5. イベント一覧・調査手順の正本は [runbook/observability.md](../runbook/observability.md)

## 影響・トレードオフ

- 監査ログの保持期間はホスティングのログ保持設定に依存する(現状は DB 保存しない)。
  長期保全・改ざん耐性が要件になったら SQLite の append-only テーブル化を別 ADR で判断
- application 層(useCases)から logger を import する(横断関心事として許可)。
  依存注入にはしない — この規模では過剰
- requestId はリクエスト内で閉じる(分散トレーシングはスコープ外)

## 代替案

- **外部 o11y SaaS(Sentry 等)**: 身内利用の規模に対して導入・運用コスト過剰。stdout JSON で検索要件は満たせる
- **監査ログの DB 保存**: 現段階では要件がなく、stdout で十分。要件が出た時点で追加(上記)
