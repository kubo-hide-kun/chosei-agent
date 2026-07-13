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

  it('同じ名前で再送信すると別行を追加せず既存回答を上書きする(ADR 0012)', () => {
    const { id } = createEvent({
      title: '上書きテスト',
      description: '',
      candidates: ['2026-09-01', '2026-09-02'],
    });
    const [c1, c2] = getEvent(id)!.candidates;

    const first = addResponse(id, {
      name: '佐藤',
      comment: '最初のコメント',
      answers: { [c1.id]: 'ok', [c2.id]: 'ng' },
    });
    expect(first.updated).toBe(false);

    const second = addResponse(id, {
      name: '佐藤',
      comment: '直したコメント',
      answers: { [c1.id]: 'maybe' },
    });
    expect(second.updated).toBe(true);
    expect(second.id).toBe(first.id);

    const after = getEvent(id)!;
    expect(after.responses).toHaveLength(1);
    expect(after.responses[0].comment).toBe('直したコメント');
    expect(after.responses[0].answers[c1.id]).toBe('maybe');
    // 上書き時に答え直さなかった候補は「回答なし」に戻る(送信内容で丸ごと置き換え)
    expect(after.responses[0].answers[c2.id]).toBeUndefined();
  });

  it('前後の空白を除いた名前が一致すれば上書き対象と判定する(ADR 0012)', () => {
    const { id } = createEvent({
      title: '空白トリムテスト',
      description: '',
      candidates: ['2026-09-10'],
    });
    const [c1] = getEvent(id)!.candidates;

    addResponse(id, { name: '鈴木', comment: '', answers: { [c1.id]: 'ok' } });
    const result = addResponse(id, { name: '  鈴木  ', comment: '', answers: { [c1.id]: 'ng' } });

    expect(result.updated).toBe(true);
    const after = getEvent(id)!;
    expect(after.responses).toHaveLength(1);
    expect(after.responses[0].name).toBe('鈴木');
  });

  it('名前が異なれば別行として追加する', () => {
    const { id } = createEvent({
      title: '別名テスト',
      description: '',
      candidates: ['2026-09-15'],
    });
    const [c1] = getEvent(id)!.candidates;

    addResponse(id, { name: 'A', comment: '', answers: { [c1.id]: 'ok' } });
    const result = addResponse(id, { name: 'B', comment: '', answers: { [c1.id]: 'ng' } });

    expect(result.updated).toBe(false);
    expect(getEvent(id)!.responses).toHaveLength(2);
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
