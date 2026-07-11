import type { Mark } from '@/server/domain/event';
import { fallbackParseAnswers, type AnswerCandidate } from '@/server/domain/answerText';
import type { EventRepository } from '@/server/repositories/eventRepository';
import { NotFoundError } from '@/server/repositories/eventRepository';
import { getEventRepository } from '@/server/infrastructure/runtime/container';
import { parseAnswersWithClaude } from '@/server/infrastructure/gateways/claudeAnswerGateway';

export interface AnswerParseResult {
  ok: boolean;
  name?: string;
  comment?: string;
  answers?: Record<string, Mark>;
  error?: string;
  engine: 'claude' | 'fallback';
}

/**
 * 出欠回答の自然文を候補ごとの ◯/△/✕ に変換する。
 * API キーがあれば Claude、失敗時・未設定時・予算超過時(allowClaude=false)はルールベースに落とす。
 * 候補一覧に存在しない ID は結果から除外する。
 */
export async function parseAnswerText(
  eventId: string,
  text: string,
  allowClaude = true,
  repo: EventRepository = getEventRepository(),
): Promise<AnswerParseResult> {
  const event = repo.getEvent(eventId);
  if (!event) throw new NotFoundError('イベントが見つかりません');

  const candidates: AnswerCandidate[] = event.candidates.map((c) => ({
    id: c.id,
    date: c.date,
    label: c.label,
  }));
  const knownIds = new Set(candidates.map((c) => c.id));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && allowClaude) {
    try {
      const outcome = await parseAnswersWithClaude(text, candidates, apiKey);
      if (!outcome.ok) return { ok: false, error: outcome.error, engine: 'claude' };
      const answers = Object.fromEntries(
        Object.entries(outcome.answers ?? {}).filter(([id]) => knownIds.has(id)),
      );
      if (Object.keys(answers).length === 0) {
        return { ok: false, error: '回答を読み取れませんでした', engine: 'claude' };
      }
      return { ok: true, name: outcome.name, comment: outcome.comment, answers, engine: 'claude' };
    } catch (err) {
      console.error('Claude での回答解析に失敗したためフォールバックします:', err);
    }
  }

  const result = fallbackParseAnswers(text, candidates);
  if ('error' in result) {
    return { ok: false, error: result.error, engine: 'fallback' };
  }
  return { ok: true, answers: result.answers, engine: 'fallback' };
}
