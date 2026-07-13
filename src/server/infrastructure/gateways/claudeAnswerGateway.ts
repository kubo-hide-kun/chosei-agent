import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { markSchema, type Mark } from '@/server/domain/event';
import type { AnswerCandidate } from '@/server/domain/answerText';
import { ANSWER_AGENT_SYSTEM_PROMPT } from '@/server/infrastructure/gateways/answerPrompt';
import { ClaudeJsonParseError, parseClaudeJson } from '@/server/infrastructure/gateways/claudeJson';

export interface AnswerParseOutcome {
  ok: boolean;
  name?: string;
  comment?: string;
  answers?: Record<string, Mark>;
  error?: string;
}

const answerResultSchema = z.object({
  name: z.string().max(50).optional(),
  comment: z.string().max(500).optional().default(''),
  answers: z.record(z.string(), markSchema),
});

/** Claude API で出欠の自然文を候補ごとの ◯/△/✕ に変換する gateway */
export async function parseAnswersWithClaude(
  text: string,
  candidates: AnswerCandidate[],
  apiKey: string,
): Promise<AnswerParseOutcome> {
  const client = new Anthropic({ apiKey });
  const candidateList = candidates.map((c) => ({ id: c.id, label: c.label }));

  const message = await client.messages.create({
    model: process.env.CHOSEI_AGENT_MODEL ?? 'claude-sonnet-5',
    max_tokens: 1024,
    system: ANSWER_AGENT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `候補: ${JSON.stringify(candidateList)}\n回答: ${text}`,
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
  const result = answerResultSchema.parse(parsed);
  return { ok: true, name: result.name, comment: result.comment, answers: result.answers };
}
