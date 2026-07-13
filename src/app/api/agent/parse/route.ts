import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseScheduleText } from '@/server/application/useCases/parseScheduleText';
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
  text: z.string().min(1, 'text は必須です').max(4000),
  // ADR 0010: 解析失敗時に入力内容・Claude 応答をログに残すことへの明示同意
  allowDiagnosticLogging: z.boolean().optional().default(false),
});

export const POST = withApiLogging<unknown>('/api/agent/parse', async (req, _ctx, reqLog) => {
  const ip = getClientIp(req.headers);
  if (!verifyAccessKey(req.headers.get('x-access-key'))) {
    reqLog.audit('auth.denied', { route: '/api/agent/parse', ip });
    return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
  }
  if (!rateLimit(`agent:${ip}`, RATE_LIMITS.agent.limit, RATE_LIMITS.agent.windowMs)) {
    reqLog.audit('rate.limited', { route: '/api/agent/parse', ip });
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

  const claudeConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const allowClaude = claudeConfigured && consumeClaudeBudget();
  if (claudeConfigured && !allowClaude) {
    reqLog.audit('agent.budget_exhausted', { route: '/api/agent/parse', ip });
  }
  const start = Date.now();
  const result = await parseScheduleText(
    parsed.data.text,
    new Date(),
    allowClaude,
    parsed.data.allowDiagnosticLogging,
  );
  // PII 最小化: 入力本文はログに残さず長さのみ記録する
  reqLog.info('agent.parse', {
    kind: 'schedule',
    engine: result.engine,
    ok: result.ok,
    textLength: parsed.data.text.length,
    durationMs: Date.now() - start,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, engine: result.engine }, { status: 422 });
  }
  return NextResponse.json({ event: result.event, engine: result.engine });
});
