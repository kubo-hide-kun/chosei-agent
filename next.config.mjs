/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // MIME スニッフィングによる意図しないコンテンツ解釈を防ぐ
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // イベント URL(共有リンク = 実質のアクセス権)を外部サイトへの遷移で漏らさない
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // iframe 埋め込みを禁止し、クリックジャッキング経由の誤操作を防ぐ
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
