import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { eventImportSchema } from '@/server/domain/event';
import { getEvent, updateEvent } from '@/server/application/useCases/events';
import { NotFoundError } from '@/server/repositories/eventRepository';
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

// イベント URL を知っている人は誰でも編集できる(閲覧・回答と同じアクセスモデル。ADR 0011)
export const PUT = withApiLogging<Ctx>('/api/events/[id]', async (req, ctx, reqLog) => {
  const { id } = await ctx.params;
  const ip = getClientIp(req.headers);
  if (!rateLimit(`update:${ip}`, RATE_LIMITS.updateEvent.limit, RATE_LIMITS.updateEvent.windowMs)) {
    reqLog.audit('rate.limited', { route: 'PUT /api/events/[id]', ip, eventId: id });
    return NextResponse.json({ error: ERROR_MESSAGES.rateLimited }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON の構文が不正です' }, { status: 400 });
  }
  try {
    const input = eventImportSchema.parse(body);
    updateEvent(id, input);
    reqLog.audit('event.updated', { eventId: id, candidateCount: input.candidates.length, ip });
    return NextResponse.json({ id, url: `/events/${id}` });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: '入稿 JSON がスキーマに一致しません',
          issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        { status: 422 },
      );
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
});
