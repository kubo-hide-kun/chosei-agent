import { eventImportSchema, type EventImport } from '@/server/domain/event';
import { fallbackParse } from '@/server/domain/scheduleText';
import { parseWithClaude } from '@/server/infrastructure/gateways/claudeScheduleGateway';

export interface ParseResult {
  ok: boolean;
  event?: EventImport;
  error?: string;
  engine: 'claude' | 'fallback';
}

/**
 * 自然文を入稿 JSON に変換する。
 * API キーがあれば Claude、失敗時・未設定時はルールベース(domain/scheduleText)に落とす。
 */
export async function parseScheduleText(text: string, now = new Date()): Promise<ParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const outcome = await parseWithClaude(text, now, apiKey);
      return { ...outcome, engine: 'claude' };
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
