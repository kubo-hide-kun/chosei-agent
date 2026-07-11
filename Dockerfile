# ビルドステージ
FROM node:22-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 のネイティブビルドに必要(プレビルドが無い Node バージョンでも通るように)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 実行ステージ
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.mjs ./

# SQLite の保存先(Railway ではここに永続ボリュームをマウントする)
ENV CHOSEI_DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 3000
# next start は PORT 環境変数(Railway が自動注入)を読む
CMD ["npm", "start"]
