import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { responseSchema } from '@/server/domain/event';
import { addResponse } from '@/server/application/useCases/events';
import { NotFoundError, ValidationError } from '@/server/repositories/eventRepository';
import { withApiLogging } from '@/server/infrastructure/logging/withApiLogging';
import {
  ERROR_MESSAGES,
  getClientIp,
  RATE_LIMITS,
  rateLimit,
} from '@/server/infrastructure/runtime/security';

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApiLogging<Ctx>(
  '/api/events/[id]/responses',
  async (req, ctx, reqLog) => {
    const { id } = await ctx.params;
    const ip = getClientIp(req.headers);
    if (!rateLimit(`respond:${ip}`, RATE_LIMITS.respond.limit, RATE_LIMITS.respond.windowMs)) {
      reqLog.audit('rate.limited', { route: '/api/events/[id]/responses', ip, eventId: id });
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
      // PII 最小化: 名前・コメント内容はログに残さない
      reqLog.audit(result.updated ? 'response.updated' : 'response.added', {
        eventId: id,
        responseId: result.id,
        answerCount: Object.keys(input.answers).length,
        hasComment: Boolean(input.comment),
        ip,
      });
      return NextResponse.json(result, { status: result.updated ? 200 : 201 });
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
  },
);
