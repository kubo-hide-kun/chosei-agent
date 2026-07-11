import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { eventImportSchema } from '@/server/domain/event';
import { createEvent } from '@/server/application/useCases/events';
import {
  ERROR_MESSAGES,
  getClientIp,
  RATE_LIMITS,
  rateLimit,
  verifyAccessKey,
} from '@/server/infrastructure/runtime/security';

export async function POST(req: NextRequest) {
  if (!verifyAccessKey(req.headers.get('x-access-key'))) {
    return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
  }
  const ip = getClientIp(req.headers);
  if (!rateLimit(`create:${ip}`, RATE_LIMITS.createEvent.limit, RATE_LIMITS.createEvent.windowMs)) {
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
}
