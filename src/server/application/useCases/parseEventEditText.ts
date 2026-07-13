import type { EventImport } from '@/server/domain/event';
import { editEventWithClaude } from '@/server/infrastructure/gateways/claudeEventEditGateway';
import { ClaudeJsonParseError } from '@/server/infrastructure/gateways/claudeJson';
import { log } from '@/server/infrastructure/logging/logger';

export interface EventEditParseResult {
  ok: boolean;
  event?: EventImport;
  error?: string;
}

const UNAVAILABLE_MESSAGE = 'AI 編集は現在利用できません。内容を直接 JSON で編集してください。';
const FAILED_MESSAGE = 'AI 編集に失敗しました。内容を直接 JSON で編集するか、もう一度お試しください。';

/**
 * 現在の入稿 JSON と自然文の変更指示から、変更を反映した新しい入稿 JSON を作る。
 * 任意の編集内容をルールベースで再現するのは非現実的なため、フォールバックは持たない。
 * API キー未設定・予算超過(allowClaude=false)・解析失敗時は、JSON 直接編集への切り替えを促すエラーを返す。
 *
 * `allowDiagnosticLogging` はユーザーがフォーム上でリスク説明を読んで同意した場合のみ true になる
 * (ADR 0010)。true のときだけ、解析失敗時に Claude の生応答と入力文をログに含める。
 */
export async function parseEventEditText(
  currentEvent: EventImport,
  instruction: string,
  now = new Date(),
  allowClaude = true,
  allowDiagnosticLogging = false,
): Promise<EventEditParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !allowClaude) {
    return { ok: false, error: UNAVAILABLE_MESSAGE };
  }
  try {
    const outcome = await editEventWithClaude(currentEvent, instruction, now, apiKey);
    if (!outcome.ok) return { ok: false, error: outcome.error };
    return { ok: true, event: outcome.event };
  } catch (err) {
    log('warn', 'agent.claude_fallback', {
      kind: 'event_edit',
      message: err instanceof Error ? err.message : String(err),
      ...(err instanceof ClaudeJsonParseError
        ? {
            rawLength: err.rawLength,
            stopReason: err.stopReason ?? null,
            hasJsonStart: err.hasJsonStart,
            truncated: err.truncated,
            errorPosition: err.errorPosition ?? null,
            ...(allowDiagnosticLogging
              ? { rawResponse: err.rawResponse, inputText: instruction, diagnosticConsent: true }
              : {}),
          }
        : {}),
    });
    return { ok: false, error: FAILED_MESSAGE };
  }
}
