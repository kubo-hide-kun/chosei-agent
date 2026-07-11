# CLAUDE.md

**正本は [AGENTS.md](./AGENTS.md)**。ここでは再定義しない。以下の順で読む。

1. [AGENTS.md](./AGENTS.md) — ワークフロー・原則・アーキテクチャ・DoD
2. [docs/steering/repo-map.md](./docs/steering/repo-map.md) — 領域 → 入口の地図(毎回全体を読み直さない)
3. 触る領域の正本 — 入稿 JSON は [docs/JSON_FORMAT.md](./docs/JSON_FORMAT.md)、エージェントのプロンプトは [docs/SYSTEM_PROMPT.md](./docs/SYSTEM_PROMPT.md)

## クイックリファレンス

- `npm run dev` — 開発サーバー (http://localhost:3000)
- `npm run typecheck` — 型チェック(速い確認はまずこれ)
- `npx vitest run <path>` — 対象を絞ったテスト / `npm test` — 全テスト
- `npm run build` — 本番ビルド(DoD 等の必要な場面に限定)
