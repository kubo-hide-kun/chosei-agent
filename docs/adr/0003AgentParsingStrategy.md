# ADR 0003: AI エージェントの解析戦略(Claude + ルールベースフォールバック)

- ステータス: Accepted
- 日付: 2026-07-11

## 決定

自然文 → 入稿 JSON の変換は 2 段構えにする。

1. `ANTHROPIC_API_KEY` があれば **Claude API**(gateway: `src/server/infrastructure/gateways/claudeScheduleGateway.ts`)
2. キー未設定・API 失敗時は **ルールベース解析**(domain: `src/server/domain/scheduleText.ts`)に自動フォールバックし、レスポンスの `engine` フィールドでどちらが使われたかを明示する

プロンプトの正本は [docs/SYSTEM_PROMPT.md](../SYSTEM_PROMPT.md)(実装 `schedulePrompt.ts` と同期必須)。

## 理由

- API キーなしでもサービスの中核体験(まとめて入稿)が成立し、ローカル開発・デモが自己完結する
- LLM の出力は必ず zod スキーマ(`eventImportSchema`)で検証してから使う。スキーマ違反は 422 で返し、不正な候補が DB に入らない
- **推測で日付を確定しない**: 解析できない入力はエラー(`{"error": ...}`)に落とす。曖昧な表現を勝手に埋めるより、ユーザーに修正してもらう方が事故が少ない

## 影響・トレードオフ

- ルールベースは代表的な日本語表現(来週の◯曜・平日・週末・M/D・時刻レンジ等)のみ対応。カバレッジは Claude に劣るが、`engine: "fallback"` の明示で期待値を調整する
- ユーザーは解析結果をプレビューで編集してから確定するため、解析ミスは作成前に修正できる(human in the loop)

## 代替案

- **Claude 必須(フォールバックなし)**: キー未設定環境で中核体験が失われるため不採用
- **ルールベースのみ**: 表現カバレッジに限界があり「AI エージェント」の価値が出ないため不採用
- **JSON mode / tool use での構造化出力**: 現状はテキスト出力 + zod 検証で十分。精度問題が観測されたら移行を検討
