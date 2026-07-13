import Anthropic from '@anthropic-ai/sdk';
import { eventImportSchema, type EventImport } from '@/server/domain/event';
import { EVENT_EDIT_AGENT_SYSTEM_PROMPT } from '@/server/infrastructure/gateways/eventEditPrompt';
import { ClaudeJsonParseError, parseClaudeJson } from '@/server/infrastructure/gateways/claudeJson';
import { formatBaseDate } from '@/server/infrastructure/gateways/baseDate';

export interface EventEditOutcome {
  ok: boolean;
  event?: EventImport;
  error?: string;
}

/** Claude API で「現在の入稿 JSON + 自然文の変更指示」を新しい入稿 JSON に変換する gateway */
export async function editEventWithClaude(
  currentEvent: EventImport,
  instruction: string,
  now: Date,
  apiKey: string,
): Promise<EventEditOutcome> {
  const client = new Anthropic({ apiKey });
  const baseDate = formatBaseDate(now);

  const message = await client.messages.create({
    model: process.env.CHOSEI_AGENT_MODEL ?? 'claude-sonnet-5',
    max_tokens: 8192,
    system: EVENT_EDIT_AGENT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `基準日: ${baseDate}\n現在の内容: ${JSON.stringify(currentEvent)}\n変更指示: ${instruction}`,
      },
    ],
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
