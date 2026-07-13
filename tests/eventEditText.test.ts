import { afterEach, describe, expect, it } from 'vitest';
import { parseEventEditText } from '../src/server/application/useCases/parseEventEditText';
import type { EventImport } from '../src/server/domain/event';

const CURRENT_EVENT: EventImport = {
  title: '新年会',
  description: '',
  candidates: [{ date: '2026-07-21', start: '19:00', end: '21:00' }],
};

describe('parseEventEditText', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('API キー未設定なら JSON 直接編集を促すエラーを返す', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await parseEventEditText(CURRENT_EVENT, 'タイトルを変えて');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/直接 JSON で編集/);
  });

  it('allowClaude=false(予算超過等)なら Claude を呼ばずエラーを返す', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const result = await parseEventEditText(CURRENT_EVENT, 'タイトルを変えて', new Date(), false);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/直接 JSON で編集/);
  });
});
