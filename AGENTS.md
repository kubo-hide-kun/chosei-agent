# AGENTS.md

> chosei-agent で AI(Claude / Codex 等)が作業するときの入口。
> AGENTS.md はポインタとして薄く保ち、詳細は各正本ドキュメントへ誘導する。

## First Read

- まず [README.md](./README.md) を確認する
- 設計判断(ADR)は [docs/adr/README.md](./docs/adr/README.md)(index が一覧の正本)から必要分だけ参照する
- どの領域を触るかが決まったら、毎回 repo 全体を読み直さず [docs/steering/repo-map.md](./docs/steering/repo-map.md)(領域→入口の地図)から最短で入口に入る
- 入稿 JSON の仕様は [docs/JSON_FORMAT.md](./docs/JSON_FORMAT.md) が正本
- AI エージェント(候補日時抽出)のシステムプロンプトは [docs/SYSTEM_PROMPT.md](./docs/SYSTEM_PROMPT.md) が正本(実装 `src/server/infrastructure/gateways/schedulePrompt.ts` と必ず同期)
- 何を調べるか迷う/障害調査では、調査手段を使う前に候補を最大 3 つに絞り、最小で効く一手から調べる(全体検索・全読み・全体テストに走らない)

## Workflow — 意図駆動・適応型・手戻り最小

3 フェーズ + 3 チェックポイントで進める。狙いは **意図のすれ違い・仕様の曖昧さ・大きな一括実装による手戻りを着手前に潰す**こと。

- **3 フェーズ + 3 チェックポイント(✋ で人間が承認)**:Inception(何を / なぜ:意図・スコープ・DoD を合意)→ Construction(どう作る:薄い実装計画を承認 → 小バッチ実装 + `npm run typecheck` / 対象を絞ったテスト)→ Operations(確かめて閉じる:DoD と意図充足を確認)
- **指示を鵜呑みにしない(「実装する」前に「検証する」)**:依頼者の指示は完璧とは限らない。Inception で指示内容とその目的自体(①前提・目的 ②手段 ③関連する抜け漏れ ④ビジネス影響 ⑤スコープ)を客観的に再評価し、疑問・より良い代替・抜け漏れは**勝手に対応せず確認**、スコープ外は**別 issue 化を提案**する
- **メタ認知フレームを常時保持**:4 視点 — ①システム(状態・制約・負債)②依頼(なぜ今依頼されたか)③自分(期待される役割と自分の限界)④アウトカム(完了で誰の何が良くなるか)— を保持し、✋ チェックポイント・完了報告の前に自己評価を回す。言語化コストは規模比例(S は頭の中のみ)
- **適応ルール(S / M / L)**:価値を生む工程だけ実行する。typo・1 ファイル数行(S)は即実装、機能追加(M)は意図ブリーフをチャットで合意、新機能・アーキ判断(L)は厳密フロー + 設計判断の記録
- **UI を作ったら必須(省略不可)**:全画面サイズ(モバイル / タブレット / デスクトップ + 極狭・極広・空/エラー/ローディング状態)で崩れないか確認し、UI/UX をデザイン論 + 行動経済学の観点でレビューして根拠つきで最適案を提示する(ダークパターン禁止)
- **共通のレビュー作法**:証拠必須(`path:line`)/ accuracy over alarm(誤検知を捏造しない。確信が無いものは「要確認」に落とす)/ 漸進ロード(必要分だけ読む)/ 指摘と修正を分ける

## Mindset — 開発者としての姿勢

- 好奇心:既存実装をまず分解して仕組みを理解する。小さく実験し、失敗から学ぶ
- システム思考:1 つの変更が `src/app`(ルート)→ `src/server`(application / domain / repositories / infrastructure)→ DB・テスト・ドキュメントへどう波及するかを俯瞰する
- 明確なコミュニケーション:着手前にタスク範囲と完了条件を明示する。固有値(日付・料金・URL・固有名詞)は AI が確定せず原典確認 or 依頼者確認
- オーナーシップ:AI が生成したコードでも最終品質と結果に責任を持つ
- ポリマス:技術的正しさに加え、ユーザー体験(回答しやすさ)と運用(イベント作成の手間)の二軸で判断する

## Principles

- KISS / DRY / YAGNI / PIE / SLAP / OCP を守る
- 名前で責務が分かる構造を優先する
- 正本はひとつ(No duplication):仕様は docs、判断は docs、実装は src。重複させずポインタで参照する

## Architecture

- `src/app/` は Route Handler と page のみ(薄く保つ)
- ビジネスロジックは `src/server/application/useCases` に置く
- ドメインルール(スキーマ・正規化・ルールベース解析)は `src/server/domain` に置く
- 永続化や外部保存の抽象(ポート)は `src/server/repositories` に置く
- infrastructure は adapter 種別で揃える
  - `src/server/infrastructure/repositories`: repository adapter 実装(SQLite)
  - `src/server/infrastructure/gateways`: 外部 API gateway adapter 実装(Claude)
  - `src/server/infrastructure/runtime`: 依存の合成点(composition root)
- application はポートにのみ依存する。実装の解決は `infrastructure/runtime/container.ts` に集約(application からの infrastructure import はこの合成点のみ許可)
- UI コンポーネントはページ配下に置き、`src/server/infrastructure/*` を直接 import しない。スタイルはデザイントークン(`src/app/globals.css` の CSS カスタムプロパティ)経由で参照する。生の HEX 値を直接書かない
- 相対 import より `@/` エイリアスを優先する

## Harness

- AGENTS.md はポインタとして保ち、長い説明を増やしすぎない
- AI が繰り返し読む内部指示は簡潔に、ユーザー向けの説明・報告は日本語で読みやすく
- 速いフィードバックを優先する:`npm run typecheck` を小さく回し、テストは変更ファイル・関連に絞る(`npx vitest run <path>`)
- 全体テスト・本番ビルド(`npm run build`)は Definition of Done など必要な場面に限定する
- 変更した分岐・防御コードにはテストを追加する(`tests/`)
- ユーザー向け文言・エラーメッセージは日本語
- API のバリデーションエラーは 422 で `{ error, issues }` 形式を返す
- API ルートは必ず `withApiLogging` で包む(requestId 付き構造化ログ)。状態変更・セキュリティ事象は `reqLog.audit()` で記録し、PII(名前・コメント・入力本文)はログに残さない([docs/runbook/observability.md](./docs/runbook/observability.md))
- logger(`infrastructure/logging`)は横断関心事として全レイヤから import してよい(container 経由不要)

## Definition of Done

- DoD = **要件の動作を保証するのに必要な確認が行われていること**。確認の範囲は変更の性質・影響・リスクに見合わせて適応的に決める(過剰確認も手戻り)
- 変更した分岐と防御コードには対応テストを追加する
- 入稿 JSON の形式を変えたら `docs/JSON_FORMAT.md` を、エージェントのプロンプトを変えたら `docs/SYSTEM_PROMPT.md` と `src/server/infrastructure/gateways/schedulePrompt.ts` の両方を同期する(正本のズレを作らない)
- ユーザーから見える機能・画面・入稿形式を変えたら `docs/USER_GUIDE.md` とアプリ内ガイド(ヘルプ文言・凡例)を同期する
- UI を作る / 変えたなら「UI を作ったら必須の確認」(崩れチェック + UX レビュー)を満たす。これは適応で省略できない
- 設計・仕様の判断が増えたら [docs/adr/](./docs/adr/README.md) に起票する(採番は既存の続き。index にも追記)
- CI(typecheck + 全テスト + ビルド)が基準線の関門([ADR 0004](./docs/adr/0004CiGate.md))。手元は絞った確認で速く回してよい
- 「テストが通った」で閉じず、理解確認(なぜ / データの流れ / 失敗時挙動 / 戻し方)を満たす。説明できない点は捏造せず「未確認」として報告に残す
- commit / push はユーザーが明示したときのみ。PR はユーザーが明示したときだけ作る
