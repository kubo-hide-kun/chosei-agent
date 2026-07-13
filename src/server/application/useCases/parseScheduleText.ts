import { eventImportSchema, type EventImport } from '@/server/domain/event';
import { fallbackParse } from '@/server/domain/scheduleText';
import { parseWithClaude } from '@/server/infrastructure/gateways/claudeScheduleGateway';
import { ClaudeJsonParseError } from '@/server/infrastructure/gateways/claudeJson';
import { log } from '@/server/infrastructure/logging/logger';

export interface ParseResult {
  ok: boolean;
  event?: EventImport;
  error?: string;
  engine: 'claude' | 'fallback';
}

/**
 * 自然文を入稿 JSON に変換する。
 * API キーがあれば Claude、失敗時・未設定時・予算超過時(allowClaude=false)はルールベースに落とす。
 *
 * `allowDiagnosticLogging` はユーザーがフォーム上でリスク説明を読んで同意した場合のみ true になる
 * (ADR 0010)。true のときだけ、解析失敗時に Claude の生応答と入力文をログに含める。
 */
export async function parseScheduleText(
  text: string,
  now = new Date(),
  allowClaude = true,
  allowDiagnosticLogging = false,
): Promise<ParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && allowClaude) {
    try {
      const outcome = await parseWithClaude(text, now, apiKey);
      return { ...outcome, engine: 'claude' };
    } catch (err) {
      log('warn', 'agent.claude_fallback', {
        kind: 'schedule',
        message: err instanceof Error ? err.message : String(err),
        ...(err instanceof ClaudeJsonParseError
          ? {
              rawLength: err.rawLength,
              stopReason: err.stopReason ?? null,
              hasJsonStart: err.hasJsonStart,
              truncated: err.truncated,
              errorPosition: err.errorPosition ?? null,
              ...(allowDiagnosticLogging
                ? { rawResponse: err.rawResponse, inputText: text, diagnosticConsent: true }
                : {}),
            }
          : {}),
      });
    }
  }
  const result = fallbackParse(text, now);
  if ('error' in result) {
    return { ok: false, error: result.error, engine: 'fallback' };
  }
  return { ok: true, event: eventImportSchema.parse(result), engine: 'fallback' };
}
