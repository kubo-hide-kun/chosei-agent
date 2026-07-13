import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eventImportSchema } from '@/server/domain/event';
import { parseEventEditText } from '@/server/application/useCases/parseEventEditText';
import { withApiLogging } from '@/server/infrastructure/logging/withApiLogging';
import {
  consumeClaudeBudget,
  ERROR_MESSAGES,
  getClientIp,
  RATE_LIMITS,
  rateLimit,
  verifyAccessKey,
} from '@/server/infrastructure/runtime/security';

const requestSchema = z.object({
  currentEvent: eventImportSchema,
  instruction: z.string().min(1, 'instruction は必須です').max(2000),
  // ADR 0010: 解析失敗時に入力内容・Claude 応答をログに残すことへの明示同意
  allowDiagnosticLogging: z.boolean().optional().default(false),
});

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApiLogging<Ctx>(
  '/api/events/[id]/agent/parse-edit',
  async (req, ctx, reqLog) => {
    const { id } = await ctx.params;
    const ip = getClientIp(req.headers);
    if (!verifyAccessKey(req.headers.get('x-access-key'))) {
      reqLog.audit('auth.denied', { route: '/api/events/[id]/agent/parse-edit', ip, eventId: id });
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
    }
    if (!rateLimit(`agent:${ip}`, RATE_LIMITS.agent.limit, RATE_LIMITS.agent.windowMs)) {
      reqLog.audit('rate.limited', { route: '/api/events/[id]/agent/parse-edit', ip, eventId: id });
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
      return NextResponse.json(
        {
          error: '入力がスキーマに一致しません',
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        { status: 422 },
      );
    }

    const claudeConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
    const allowClaude = claudeConfigured && consumeClaudeBudget();
    if (claudeConfigured && !allowClaude) {
      reqLog.audit('agent.budget_exhausted', { route: '/api/events/[id]/agent/parse-edit', ip });
    }
    const start = Date.now();
    const result = await parseEventEditText(
      parsed.data.currentEvent,
      parsed.data.instruction,
      new Date(),
      allowClaude,
      parsed.data.allowDiagnosticLogging,
    );
    // PII 最小化: 変更指示の本文はログに残さず長さのみ記録する
    reqLog.info('agent.parse', {
      kind: 'event_edit',
      ok: result.ok,
      eventId: id,
      textLength: parsed.data.instruction.length,
      durationMs: Date.now() - start,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    return NextResponse.json({ event: result.event });
  },
);
