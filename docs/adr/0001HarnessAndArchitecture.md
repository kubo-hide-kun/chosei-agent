# ADR 0001: ハーネスとレイヤアーキテクチャ

- ステータス: Accepted
- 日付: 2026-07-11

## 背景

chosei-agent は「候補日時のぽちぽち入力がしんどい」という課題を解く日程調整サービス。
小規模だが、AI エージェント(外部 API)・永続化・UI が絡むため、責務の置き場所を最初に決めておかないと
Route Handler にロジックが溜まり、テスト・差し替え(DB 変更、モデル変更)が難しくなる。

## 決定

1. **スタック**: Next.js 15 (App Router) + TypeScript + SQLite (better-sqlite3) + zod + vitest
2. **レイヤ構造**: `src/app/` は page / Route Handler のみ(薄く)。ロジックは `src/server/` に置き、依存方向は次に固定する

   ```
   app -> application/useCases -> domain
                               -> repositories(ポート) <- infrastructure(adapter 実装)
   ```

   - `domain`: スキーマ・正規化・ルールベース解析(外部依存なしの純粋ロジック)
   - `repositories`: 永続化のポート(interface)とエラー型
   - `infrastructure/repositories`: SQLite adapter / `infrastructure/gateways`: 外部 API adapter / `infrastructure/runtime`: 依存の合成点(container)
   - application からの infrastructure import は合成点(`runtime/container.ts`)経由のみ許可
3. **ハーネス**: 速い確認は `typecheck` + 対象を絞った vitest。全体テスト・build は DoD 等に限定。規約の入口は AGENTS.md

## 理由

- SQLite はセットアップ不要で自己完結し、初期フェーズの運用が最も軽い。Repository をポートで抽象化してあるため、将来のマネージド DB への移行は adapter 追加で済む
- zod により入稿 JSON のバリデーションエラーをフィールド単位でユーザーに返せる(本サービスの中核 UX)

## 影響・トレードオフ

- 小規模アプリにしては層が多い。ただし各層のファイルは薄く、責務の置き場所に迷わない利点が上回ると判断
- SQLite はサーバーレス環境(エッジ)にそのままデプロイできない。デプロイ先を決める際に adapter 追加の ADR を起票する

## 代替案

- **単層構成(lib に全部)**: 初速は速いが、AI gateway と永続化のテスト・差し替えが密結合になるため不採用(初期実装後にこの構造から移行した)
- **Prisma / Drizzle 等の ORM**: この規模ではスキーマ 4 テーブルの生 SQL の方が見通しがよく、依存も減るため不採用
