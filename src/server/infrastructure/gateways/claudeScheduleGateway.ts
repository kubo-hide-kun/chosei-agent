import Anthropic from '@anthropic-ai/sdk';
import { eventImportSchema, type EventImport } from '@/server/domain/event';
import { SCHEDULE_AGENT_SYSTEM_PROMPT } from '@/server/infrastructure/gateways/schedulePrompt';
import { ClaudeJsonParseError, parseClaudeJson } from '@/server/infrastructure/gateways/claudeJson';
import { formatBaseDate } from '@/server/infrastructure/gateways/baseDate';

export interface ScheduleParseOutcome {
  ok: boolean;
  event?: EventImport;
  error?: string;
}

/** Claude API で自然文を入稿 JSON に変換する gateway */
export async function parseWithClaude(
  text: string,
  now: Date,
  apiKey: string,
): Promise<ScheduleParseOutcome> {
  const client = new Anthropic({ apiKey });
  const baseDate = formatBaseDate(now);

  const message = await client.messages.create({
    model: process.env.CHOSEI_AGENT_MODEL ?? 'claude-sonnet-5',
    // 思考(thinking)トークンも max_tokens に含まれるため、テキスト出力が残るよう大きめに確保する
    max_tokens: 16384,
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
