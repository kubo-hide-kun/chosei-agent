import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { eventImportSchema } from '@/server/domain/event';
import { createEvent } from '@/server/application/useCases/events';
import { withApiLogging } from '@/server/infrastructure/logging/withApiLogging';
import {
  ERROR_MESSAGES,
  getClientIp,
  RATE_LIMITS,
  rateLimit,
  verifyAccessKey,
} from '@/server/infrastructure/runtime/security';

export const POST = withApiLogging<unknown>('/api/events', async (req, _ctx, reqLog) => {
  const ip = getClientIp(req.headers);
  if (!verifyAccessKey(req.headers.get('x-access-key'))) {
    reqLog.audit('auth.denied', { route: '/api/events', ip });
    return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
  }
  if (!rateLimit(`create:${ip}`, RATE_LIMITS.createEvent.limit, RATE_LIMITS.createEvent.windowMs)) {
    reqLog.audit('rate.limited', { route: '/api/events', ip });
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
    const { id } = createEvent(input);
    reqLog.audit('event.created', { eventId: id, candidateCount: input.candidates.length, ip });
    return NextResponse.json({ id, url: `/events/${id}` }, { status: 201 });
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
    throw err;
  }
});
