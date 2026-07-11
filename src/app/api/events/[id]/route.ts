import { NextResponse } from 'next/server';
import { getEvent } from '@/server/application/useCases/events';
import { withApiLogging } from '@/server/infrastructure/logging/withApiLogging';
import {
  ERROR_MESSAGES,
  getClientIp,
  RATE_LIMITS,
  rateLimit,
} from '@/server/infrastructure/runtime/security';

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiLogging<Ctx>('/api/events/[id]', async (req, ctx, reqLog) => {
  const { id } = await ctx.params;
  // 応答に回答者の名前・コメントを含むため、ID 総当たりや一括収集を IP 単位で減速させる
  const ip = getClientIp(req.headers);
  if (!rateLimit(`read:${ip}`, RATE_LIMITS.readEvent.limit, RATE_LIMITS.readEvent.windowMs)) {
    reqLog.audit('rate.limited', { route: '/api/events/[id]', ip, eventId: id });
    return NextResponse.json({ error: ERROR_MESSAGES.rateLimited }, { status: 429 });
  }
  const event = getEvent(id);
  if (!event) {
    return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
  }
  return NextResponse.json(event);
});
