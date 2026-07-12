import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/server/infrastructure/runtime/security';
import { createRequestLogger, newRequestId, type RequestLogger } from './logger';

type ApiHandler<Ctx> = (
  req: NextRequest,
  ctx: Ctx,
  reqLog: RequestLogger,
) => Promise<NextResponse>;

/**
 * API ルート共通のロギングラッパ。
 * - リクエストごとに requestId を採番し、全ログ行と x-request-id ヘッダに付与する
 * - 完了時に 1 行(route / method / status / durationMs / ip)を記録する
 * - 未捕捉例外は requestId 付きで記録し、500 + requestId を返す(スタックは応答に含めない)
 */
export function withApiLogging<Ctx>(route: string, handler: ApiHandler<Ctx>) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    const requestId = newRequestId();
    const reqLog = createRequestLogger(requestId);
    const start = Date.now();
    const base = { route, method: req.method, ip: getClientIp(req.headers) };
    try {
      const res = await handler(req, ctx, reqLog);
      res.headers.set('x-request-id', requestId);
      // API 応答は個人情報(回答者名・コメント)を含みうるため、共有キャッシュへの保存を禁止する
      if (!res.headers.has('cache-control')) {
        res.headers.set('cache-control', 'private, no-store');
      }
      reqLog.info('api.request', { ...base, status: res.status, durationMs: Date.now() - start });
      return res;
    } catch (err) {
      reqLog.error('api.unhandled_error', {
        ...base,
        durationMs: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return NextResponse.json(
        { error: 'サーバーエラーが発生しました。時間をおいて再度お試しください。', requestId },
        {
          status: 500,
          headers: { 'x-request-id': requestId, 'cache-control': 'private, no-store' },
        },
      );
    }
  };
}
