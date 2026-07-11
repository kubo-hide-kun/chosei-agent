# ADR (Architecture Decision Records)

設計・仕様の重要な判断を記録する。**この index が一覧の正本**。
新しい ADR は既存の採番の続き(4 桁ゼロ埋め + PascalCase)で追加し、この一覧にも必ず追記する。

## 書き方

- 1 ADR = 1 判断。ステータス(Accepted / Superseded / Deprecated)を持つ
- 構成: 背景(なぜ判断が必要か)→ 決定 → 理由 → 影響・トレードオフ → 代替案
- 判断を覆すときは新しい ADR を起票し、旧 ADR のステータスを Superseded にする(上書き編集しない)

## 一覧

| 番号 | タイトル | ステータス |
|------|----------|-----------|
| [0001](./0001HarnessAndArchitecture.md) | ハーネスとレイヤアーキテクチャ | Accepted |
| [0002](./0002JsonImportFormat.md) | 入稿 JSON フォーマットの設計 | Accepted |
| [0003](./0003AgentParsingStrategy.md) | AI エージェントの解析戦略(Claude + ルールベースフォールバック) | Accepted |
| [0004](./0004CiGate.md) | CI ゲート(typecheck + テスト + ビルド) | Accepted |
| [0005](./0005AiAnswerInput.md) | 回答側の AI エージェント入力 | Accepted |
| [0006](./0006AbuseProtection.md) | 不正利用対策(合言葉・レートリミット・日次予算) | Accepted |
| [0007](./0007RailwayHosting.md) | ホスティングを Railway(単一インスタンス + 永続ボリューム)にする | Accepted |
