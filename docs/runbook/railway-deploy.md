# Railway デプロイ手順書

chosei-agent を [Railway](https://railway.com) にデプロイ・運用するための手順書です。
ホスティング方式の判断は [ADR 0007](../adr/0007RailwayHosting.md) を参照。

## 構成の全体像

```
GitHub (main ブランチ)
   │ push すると自動デプロイ
   ▼
Railway サービス (Dockerfile ビルド, インスタンス 1 台固定)
   ├── 環境変数: CHOSEI_ACCESS_KEY / ANTHROPIC_API_KEY など
   └── 永続ボリューム → /data にマウント (SQLite: /data/chosei.db)
```

- ビルドはリポジトリ直下の `Dockerfile`、デプロイ挙動は `railway.json` が正本
- **インスタンスは必ず 1 台**(レートリミット・Claude 日次予算がインメモリのため。[ADR 0006](../adr/0006AbuseProtection.md))

## 初回セットアップ

### 1. プロジェクト作成と GitHub 連携

1. https://railway.com にログイン(GitHub アカウント連携が楽)
2. **New Project → Deploy from GitHub repo** で `kubo-hide-kun/chosei-agent` を選択
3. 対象ブランチを確認する(既定は `main`。Settings → Source でブランチ変更可)
4. `railway.json` と `Dockerfile` は自動検出される。最初のデプロイが走り始めるが、
   **ボリュームと環境変数の設定前なので一度失敗 or データ非永続で動いても気にしない**

### 2. 永続ボリュームの作成(必須)

SQLite のデータを保存する領域。これを忘れるとデプロイのたびに全イベントが消える。

1. プロジェクト画面でサービスを右クリック(またはコマンドパレット ⌘K)→ **Add Volume**
2. **Mount path に `/data` を指定**(Dockerfile の `CHOSEI_DATA_DIR=/data` と一致させる)
3. サイズは最小(1GB 以下)で十分。後から無停止で拡張できる

### 3. 環境変数の設定

サービスの **Variables** タブで以下を設定する。

| 変数 | 必須 | 設定値 |
|------|------|--------|
| `CHOSEI_ACCESS_KEY` | **必須(本番)** | 身内で共有する合言葉。推測されにくい文字列にする(例: `openssl rand -base64 18` で生成) |
| `ANTHROPIC_API_KEY` | 任意 | Claude API キー。未設定でも動く(AI 解析はルールベースになる) |
| `CHOSEI_AGENT_DAILY_LIMIT` | 任意 | Claude 呼び出しの 1 日上限。既定 200。課金をさらに絞るなら小さく |
| `CHOSEI_DATA_DIR` | 不要 | Dockerfile で `/data` を設定済み。変えたいときのみ上書き |

- 値の由来・意味は [README の環境変数表](../../README.md#環境変数) が正本
- 保存すると自動で再デプロイが走る

### 4. 公開 URL の発行

1. サービスの **Settings → Networking → Generate Domain** で `*.up.railway.app` の URL を発行
2. 独自ドメインを使う場合は **Custom Domain** にドメインを入力し、表示される CNAME を DNS に登録

### 5. 動作確認

デプロイ完了(Deployments タブが `Success`)後、以下を確認する。

```bash
BASE=https://<発行されたドメイン>
KEY=<設定した合言葉>

# 1. トップページが返る
curl -s -o /dev/null -w "%{http_code}\n" $BASE/          # → 200

# 2. 合言葉ガードが効いている(キーなし作成は拒否)
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/events \
  -H 'Content-Type: application/json' -d '{"title":"x","candidates":["2026-08-01"]}'   # → 401

# 3. 正しいキーで作成できる
curl -s -X POST $BASE/api/events \
  -H 'Content-Type: application/json' -H "x-access-key: $KEY" \
  -d '{"title":"デプロイ確認","candidates":["2026-08-01 19:00-21:00"]}'                 # → {"id":...}

# 4. データが永続する(サービスを Restart してから再取得)
curl -s $BASE/api/events/<上で返った id>   # → イベントが返れば OK
```

4 は初回セットアップ時に必ず実施する(ボリュームのマウント漏れ検知)。

## 日常運用

### デプロイ

- `main` に push すると自動デプロイされる(Deployments タブで進行を確認)
- 失敗したら **Build Logs / Deploy Logs** を見る。直前の成功デプロイへは **Rollback** で戻せる

### ログ確認

- サービスの **Observability(Logs)** タブでランタイムログを確認できる
- AI 解析が縮退した場合は `Claude での解析に失敗したためフォールバックします` が出る

### 合言葉のローテーション(漏洩時)

1. Variables で `CHOSEI_ACCESS_KEY` を新しい値に変更(自動再デプロイ)
2. 新しい合言葉を身内に再共有する。以降、旧合言葉のリクエストはすべて 401 になる

### バックアップ

SQLite ファイル 1 つがすべてのデータ。定期バックアップが必要になったら:

```bash
# Railway CLI (npm i -g @railway/cli && railway login && railway link)
railway ssh -- cat /data/chosei.db > backup-$(date +%Y%m%d).db
```

- ボリューム自体のスナップショット機能の有無・仕様は Railway のドキュメントで最新を確認する

### スケール(やらないこと)

- **Replicas を 2 以上にしない**。レートリミットと Claude 日次予算がインメモリのため、
  台数分に緩む + SQLite の同時書き込みが壊れる。負荷が問題になったら
  永続ストア化(DB 移行・レートリミット外部化)を ADR で判断してから
- 縦方向(メモリ/CPU 増)は Settings から安全に変更できる

## トラブルシュート

| 症状 | 見るところ / 対処 |
|------|------------------|
| デプロイ後にイベントが全部消えた | ボリュームが `/data` にマウントされているか(Volume の Mount Path)。`CHOSEI_DATA_DIR` を上書きしていないか |
| 401 が返る | `CHOSEI_ACCESS_KEY` と UI に入力した合言葉の一致。変数変更後は再デプロイ完了を待つ |
| 429 が頻発する | 正当な利用なら `src/server/infrastructure/runtime/security.ts` の `RATE_LIMITS` を調整して再デプロイ |
| AI 解析が常にルールベースになる | `ANTHROPIC_API_KEY` の設定漏れ / `CHOSEI_AGENT_DAILY_LIMIT` 超過(日付が変わればリセット) |
| ビルド失敗 | Build Logs を確認。ローカルで `docker build .` が通るかで切り分ける |
| 料金が想定超え | Usage 画面で内訳確認。CPU/メモリの割り当てを最小にし、Claude 上限(`CHOSEI_AGENT_DAILY_LIMIT`)を下げる |
