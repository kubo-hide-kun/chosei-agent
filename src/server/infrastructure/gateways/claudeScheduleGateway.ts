import Anthropic from '@anthropic-ai/sdk';
import { eventImportSchema, type EventImport } from '@/server/domain/event';
import { SCHEDULE_AGENT_SYSTEM_PROMPT } from '@/server/infrastructure/gateways/schedulePrompt';
import { ClaudeJsonParseError, parseClaudeJson } from '@/server/infrastructure/gateways/claudeJson';

export interface ScheduleParseOutcome {
  ok: boolean;
  event?: EventImport;
  error?: string;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** Claude API で自然文を入稿 JSON に変換する gateway */
export async function parseWithClaude(
  text: string,
  now: Date,
  apiKey: string,
): Promise<ScheduleParseOutcome> {
  const client = new Anthropic({ apiKey });
  const baseDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')} (${WEEKDAYS[now.getDay()]})`;

  const message = await client.messages.create({
    model: process.env.CHOSEI_AGENT_MODEL ?? 'claude-sonnet-5',
    max_tokens: 8192,
    system: SCHEDULE_AGENT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `基準日: ${baseDate}\n${text}` }],
  });

  const raw = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  let parsed: unknown;
  try {
    parsed = parseClaudeJson(raw);
  } catch (err) {
    if (err instanceof ClaudeJsonParseError) err.stopReason = message.stop_reason ?? undefined;
    throw err;
  }
  if (parsed && typeof parsed === 'object' && 'error' in parsed) {
    return { ok: false, error: String(parsed.error) };
  }
  return { ok: true, event: eventImportSchema.parse(parsed) };
}
