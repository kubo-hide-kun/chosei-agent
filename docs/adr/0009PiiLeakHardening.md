# ADR 0009: 個人情報漏洩対策の強化(セキュリティ監査対応)

- ステータス: Accepted
- 日付: 2026-07-11

## 背景

本サービスは回答者の名前・コメント・自然文入力という個人情報(PII)を扱う。
リポジトリ全体のセキュリティ監査で、PII の漏洩につながりうる次の問題が見つかった。

1. **`x-forwarded-for` の先頭を信頼していた**: クライアントはこのヘッダを自由に偽装できるため、
   IP 単位のレートリミット(ADR 0006)を無制限に回避できた。さらに偽装キーを大量生成すると
   バケット上限(10,000)の追い出しで他利用者のカウンタもリセットでき、イベントデータの
   一括収集や Claude 予算の消費を防げなかった
2. **`GET /api/events/[id]` に Cache-Control が無かった**: 名前・コメントを含む応答は
   HTTP 仕様(RFC 9111)のヒューリスティックキャッシュにより共有キャッシュへ保存されうる。
   またこのルートだけレートリミット対象外で、収集を減速させる手段が無かった
3. **Claude 応答の `JSON.parse` 失敗時、SyntaxError のメッセージに入力断片が含まれる**
   (Node 20+)。ユーザーの自然文(名前等)由来のモデル出力が `agent.claude_fallback`
   ログに流出し、「PII をログに残さない」方針(ADR 0008)に違反していた
4. **セキュリティヘッダ未設定**: `X-Content-Type-Options` / `Referrer-Policy` /
   `X-Frame-Options` が無かった
5. **依存脆弱性**: next が固定参照する postcss 8.4.31 に XSS(GHSA-qx2v-qp2m-jg93)があった

## 決定

1. `getClientIp` は `x-forwarded-for` の**末尾**(信頼できるリバースプロキシが付けた実 IP)を
   採用し、64 文字に切り詰める(`security.ts`)
2. `withApiLogging` が全 API 応答(500 含む)に `Cache-Control: private, no-store` を付与する
   (ハンドラが明示した場合は上書きしない)。`GET /api/events/[id]` に読み取りレートリミット
   (120 回/分/IP)を追加する
3. Claude 応答の JSON 解析を `gateways/claudeJson.ts` の `parseClaudeJson` に集約し、
   解析失敗時は入力内容を含まない固定メッセージのエラーに差し替える
4. `next.config.mjs` の `headers()` で全ルートに `X-Content-Type-Options: nosniff`、
   `Referrer-Policy: strict-origin-when-cross-origin`、`X-Frame-Options: DENY` を付与する
5. `package.json` の `overrides` で postcss を `^8.5.10` に引き上げる

## 理由

- いずれも「URL を知っている人だけが見られる」という既存の共有モデル(ADR 0006)を変えずに、
  漏洩の増幅経路(レート制限回避・キャッシュ・ログ・埋め込み)だけを塞ぐ最小の対処
- 末尾採用は Railway 等の「プロキシが実 IP を末尾に積む」構成が前提。プロキシ無しの
  ローカル開発ではヘッダ自体が無く `x-real-ip` / `unknown` に落ちるので影響しない

## 影響・トレードオフ

- イベント ID(nanoid 12 文字 ≒ 71 bit)自体がアクセス権であるモデルは維持する。
  総当たりは事実上不可能で、読み取りレートリミットはあくまで収集の減速が目的
- 多段プロキシ構成を変える場合は `getClientIp` の前提(末尾 = 実 IP)を見直すこと
- `X-Frame-Options: DENY` により本アプリの iframe 埋め込みは不可になる(現状ユースケース無し)

## 代替案

- **イベント閲覧に合言葉を必須にする**: 参加者(URL を受け取っただけの人)の体験を壊すため
  不採用(ADR 0006 と同じ判断)
- **CSP(Content-Security-Policy)の導入**: Next.js のインラインスクリプトと nonce 運用の
  設計が必要で、この監査のスコープを超える。XSS は React のエスケープで防がれており、
  必要になったら別 ADR で判断
