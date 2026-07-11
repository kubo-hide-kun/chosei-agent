import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.CHOSEI_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chosei-test-'));

import { addResponse, createEvent, getEvent } from '../src/lib/store';

describe('store', () => {
  let eventId: string;

  beforeAll(() => {
    const { id } = createEvent({
      title: 'テストイベント',
      description: '説明',
      candidates: ['2026-07-21 19:00-21:00', { date: '2026-07-22' }],
    });
    eventId = id;
  });

  it('イベントを作成・取得できる', () => {
    const event = getEvent(eventId);
    expect(event).not.toBeNull();
    expect(event!.title).toBe('テストイベント');
    expect(event!.candidates).toHaveLength(2);
    expect(event!.candidates[0].label).toBe('7/21(火) 19:00〜21:00');
  });

  it('回答を登録・集計できる', () => {
    const event = getEvent(eventId)!;
    const [c1, c2] = event.candidates;
    addResponse(eventId, {
      name: '田中',
      comment: '楽しみです',
      answers: { [c1.id]: 'ok', [c2.id]: 'ng' },
    });
    const updated = getEvent(eventId)!;
    expect(updated.responses).toHaveLength(1);
    expect(updated.responses[0].answers[c1.id]).toBe('ok');
    expect(updated.responses[0].answers[c2.id]).toBe('ng');
  });

  it('不明な候補IDの回答を拒否する', () => {
    expect(() =>
      addResponse(eventId, { name: 'x', comment: '', answers: { bogus: 'ok' } }),
    ).toThrow();
  });

  it('存在しないイベントは null を返す', () => {
    expect(getEvent('nonexistent')).toBeNull();
  });
});
