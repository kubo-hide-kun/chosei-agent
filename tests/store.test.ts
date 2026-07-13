import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.CHOSEI_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chosei-test-'));

import {
  addResponse,
  createEvent,
  getEvent,
  updateEvent,
} from '../src/server/application/useCases/events';
import { NotFoundError } from '../src/server/repositories/eventRepository';

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

describe('updateEvent', () => {
  it('タイトル・説明を更新し、変わらない候補への回答は保持、削除した候補への回答は破棄される', () => {
    const { id } = createEvent({
      title: '元のタイトル',
      description: '元の説明',
      candidates: ['2026-08-01 19:00-21:00', '2026-08-02 19:00-21:00', '2026-08-03'],
    });
    const before = getEvent(id)!;
    const [keep, remove, untouched] = before.candidates;
    addResponse(id, {
      name: '田中',
      comment: '',
      answers: { [keep.id]: 'ok', [remove.id]: 'ng', [untouched.id]: 'maybe' },
    });

    updateEvent(id, {
      title: '新しいタイトル',
      description: '新しい説明',
      // remove(8/2) を落とし、keep(8/1)・untouched(8/3) は据え置いたまま新しい候補を1件追加
      candidates: ['2026-08-01 19:00-21:00', '2026-08-03', '2026-08-10 12:00-13:00'],
    });

    const after = getEvent(id)!;
    expect(after.title).toBe('新しいタイトル');
    expect(after.description).toBe('新しい説明');
    expect(after.candidates).toHaveLength(3);

    const keptCandidate = after.candidates.find((c) => c.date === '2026-08-01');
    const untouchedCandidate = after.candidates.find((c) => c.date === '2026-08-03');
    const newCandidate = after.candidates.find((c) => c.date === '2026-08-10');
    expect(keptCandidate!.id).toBe(keep.id);
    expect(untouchedCandidate!.id).toBe(untouched.id);
    expect(newCandidate).toBeDefined();
    expect(after.candidates.find((c) => c.date === '2026-08-02')).toBeUndefined();

    const response = after.responses[0];
    expect(response.answers[keep.id]).toBe('ok');
    expect(response.answers[untouched.id]).toBe('maybe');
    expect(response.answers[remove.id]).toBeUndefined();
    expect(response.answers[newCandidate!.id]).toBeUndefined();
  });

  it('存在しないイベントの更新は NotFoundError を投げる', () => {
    expect(() =>
      updateEvent('nonexistent', { title: 'x', description: '', candidates: ['2026-08-01'] }),
    ).toThrow(NotFoundError);
  });
});
