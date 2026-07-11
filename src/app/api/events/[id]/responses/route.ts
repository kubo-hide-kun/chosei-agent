import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { responseSchema } from '@/server/domain/event';
import { addResponse } from '@/server/application/useCases/events';
import { NotFoundError, ValidationError } from '@/server/repositories/eventRepository';
import {
  ERROR_MESSAGES,
  getClientIp,
  RATE_LIMITS,
  rateLimit,
} from '@/server/infrastructure/runtime/security';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = getClientIp(req.headers);
  if (!rateLimit(`respond:${ip}`, RATE_LIMITS.respond.limit, RATE_LIMITS.respond.windowMs)) {
    return NextResponse.json({ error: ERROR_MESSAGES.rateLimited }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON の構文が不正です' }, { status: 400 });
  }
  try {
    const input = responseSchema.parse(body);
    const result = addResponse(id, input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: '回答の形式が不正です',
          issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        { status: 422 },
      );
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
