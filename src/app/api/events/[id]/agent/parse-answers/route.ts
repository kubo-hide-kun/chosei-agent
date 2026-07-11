import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseAnswerText } from '@/server/application/useCases/parseAnswerText';
import { NotFoundError } from '@/server/repositories/eventRepository';
import {
  consumeClaudeBudget,
  ERROR_MESSAGES,
  getClientIp,
  RATE_LIMITS,
  rateLimit,
  verifyAccessKey,
} from '@/server/infrastructure/runtime/security';

const requestSchema = z.object({
  text: z.string().min(1, 'text は必須です').max(2000),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!verifyAccessKey(req.headers.get('x-access-key'))) {
    return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
  }
  const ip = getClientIp(req.headers);
  if (!rateLimit(`agent:${ip}`, RATE_LIMITS.agent.limit, RATE_LIMITS.agent.windowMs)) {
    return NextResponse.json({ error: ERROR_MESSAGES.rateLimited }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON の構文が不正です' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const allowClaude = process.env.ANTHROPIC_API_KEY ? consumeClaudeBudget() : false;
  try {
    const result = await parseAnswerText(id, parsed.data.text, allowClaude);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, engine: result.engine }, { status: 422 });
    }
    return NextResponse.json({
      name: result.name,
      comment: result.comment,
      answers: result.answers,
      engine: result.engine,
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
