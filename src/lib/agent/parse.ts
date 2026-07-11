import Anthropic from '@anthropic-ai/sdk';
import { eventImportSchema, type EventImport } from '../schema';
import { fallbackParse } from './fallback';
import { SCHEDULE_AGENT_SYSTEM_PROMPT } from './prompt';

export interface ParseResult {
  ok: boolean;
  event?: EventImport;
  error?: string;
  engine: 'claude' | 'fallback';
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export async function parseScheduleText(text: string, now = new Date()): Promise<ParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      return await parseWithClaude(text, now, apiKey);
    } catch (err) {
      console.error('Claude での解析に失敗したためフォールバックします:', err);
    }
  }
  const result = fallbackParse(text, now);
  if ('error' in result) {
    return { ok: false, error: result.error, engine: 'fallback' };
  }
  return { ok: true, event: eventImportSchema.parse(result), engine: 'fallback' };
}

async function parseWithClaude(text: string, now: Date, apiKey: string): Promise<ParseResult> {
  const client = new Anthropic({ apiKey });
  const baseDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')} (${WEEKDAYS[now.getDay()]})`;

  const message = await client.messages.create({
    model: process.env.CHOSEI_AGENT_MODEL ?? 'claude-sonnet-5',
    max_tokens: 2048,
    system: SCHEDULE_AGENT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `基準日: ${baseDate}\n${text}` }],
  });

  const raw = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()
    .replace(/^```(?:json)?\s*|\s*```$/g, '');

  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && 'error' in parsed) {
    return { ok: false, error: String(parsed.error), engine: 'claude' };
  }
  return { ok: true, event: eventImportSchema.parse(parsed), engine: 'claude' };
}
