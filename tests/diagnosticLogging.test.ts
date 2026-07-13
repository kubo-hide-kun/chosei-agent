import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaudeJsonParseError } from '../src/server/infrastructure/gateways/claudeJson';

vi.mock('@/server/infrastructure/gateways/claudeScheduleGateway', () => ({
  parseWithClaude: vi.fn(),
}));
vi.mock('@/server/infrastructure/gateways/claudeAnswerGateway', () => ({
  parseAnswersWithClaude: vi.fn(),
}));

describe('agent.claude_fallback の同意ベース診断ログ(ADR 0010)', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('parseScheduleText: 同意が無ければ入力文・生応答をログに含めない', async () => {
    const { parseWithClaude } = await import('@/server/infrastructure/gateways/claudeScheduleGateway');
    const secret = '田中太郎です';
    vi.mocked(parseWithClaude).mockRejectedValue(
      new ClaudeJsonParseError({ rawResponse: secret, hasJsonStart: false, truncated: false }),
    );
    const { parseScheduleText } = await import('@/server/application/useCases/parseScheduleText');

    await parseScheduleText(secret, new Date(), true, false);

    const logged = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain('rawResponse');
    expect(logged).not.toContain('inputText');
  });

  it('parseScheduleText: 同意していれば入力文・生応答をログに含める', async () => {
    const { parseWithClaude } = await import('@/server/infrastructure/gateways/claudeScheduleGateway');
    const secret = '田中太郎です';
    vi.mocked(parseWithClaude).mockRejectedValue(
      new ClaudeJsonParseError({ rawResponse: secret, hasJsonStart: false, truncated: false }),
    );
    const { parseScheduleText } = await import('@/server/application/useCases/parseScheduleText');

    await parseScheduleText(secret, new Date(), true, true);

    const logged = JSON.parse((console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(logged.inputText).toBe(secret);
    expect(logged.rawResponse).toBe(secret);
    expect(logged.diagnosticConsent).toBe(true);
  });

  it('parseAnswerText: 同意していれば入力文・生応答をログに含める', async () => {
    const { parseAnswersWithClaude } = await import(
      '@/server/infrastructure/gateways/claudeAnswerGateway'
    );
    const secret = '田中太郎、火曜OKです';
    vi.mocked(parseAnswersWithClaude).mockRejectedValue(
      new ClaudeJsonParseError({ rawResponse: secret, hasJsonStart: false, truncated: false }),
    );
    const { parseAnswerText } = await import('@/server/application/useCases/parseAnswerText');
    const repo = {
      getEvent: () => ({
        id: 'ev1',
        title: 't',
        description: '',
        candidates: [{ id: 'c1', date: '2026-07-20', start: null, end: null, label: '7/20' }],
        responses: [],
      }),
    } as unknown as Parameters<typeof parseAnswerText>[4];

    await parseAnswerText('ev1', secret, true, true, repo);

    const logged = JSON.parse((console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(logged.inputText).toBe(secret);
    expect(logged.rawResponse).toBe(secret);
    expect(logged.diagnosticConsent).toBe(true);
  });
});
