import { describe, expect, it } from 'vitest';
import { eventImportSchema, normalizeCandidate } from '../src/server/domain/event';

describe('eventImportSchema', () => {
  it('オブジェクト形式と文字列形式の混在を受け付ける', () => {
    const input = {
      title: '新年会',
      candidates: [
        { date: '2026-07-21', start: '19:00', end: '21:00' },
        '2026-07-22 19:00-21:00',
        '2026-07-24',
      ],
    };
    const parsed = eventImportSchema.parse(input);
    expect(parsed.candidates).toHaveLength(3);
  });

  it('title 欠落を拒否する', () => {
    expect(() =>
      eventImportSchema.parse({ candidates: ['2026-07-21'] }),
    ).toThrow();
  });

  it('不正な日付形式を拒否する', () => {
    expect(() =>
      eventImportSchema.parse({ title: 'x', candidates: ['2026/07/21'] }),
    ).toThrow();
    expect(() =>
      eventImportSchema.parse({ title: 'x', candidates: [{ date: '7月21日' }] }),
    ).toThrow();
  });

  it('不正な時刻を拒否する', () => {
    expect(() =>
      eventImportSchema.parse({
        title: 'x',
        candidates: [{ date: '2026-07-21', start: '25:00' }],
      }),
    ).toThrow();
  });

  it('実在しない日付を拒否する(ロールオーバーさせない)', () => {
    expect(() =>
      eventImportSchema.parse({ title: 'x', candidates: [{ date: '2026-02-31' }] }),
    ).toThrow();
    expect(() =>
      eventImportSchema.parse({ title: 'x', candidates: ['2026-13-01'] }),
    ).toThrow();
    // うるう年は許容
    expect(() =>
      eventImportSchema.parse({ title: 'x', candidates: ['2028-02-29'] }),
    ).not.toThrow();
    expect(() =>
      eventImportSchema.parse({ title: 'x', candidates: ['2026-02-29'] }),
    ).toThrow();
  });

  it('start >= end を拒否する', () => {
    expect(() =>
      eventImportSchema.parse({
        title: 'x',
        candidates: [{ date: '2026-07-21', start: '21:00', end: '19:00' }],
      }),
    ).toThrow();
    expect(() =>
      eventImportSchema.parse({ title: 'x', candidates: ['2026-07-21 21:00-19:00'] }),
    ).toThrow();
    expect(() =>
      eventImportSchema.parse({
        title: 'x',
        candidates: [{ date: '2026-07-21', start: '19:00', end: '19:00' }],
      }),
    ).toThrow();
  });

  it('candidates 空配列を拒否する', () => {
    expect(() => eventImportSchema.parse({ title: 'x', candidates: [] })).toThrow();
  });
});

describe('normalizeCandidate', () => {
  it('文字列ショートハンドを正規化する', () => {
    expect(normalizeCandidate('2026-07-22 19:00-21:00')).toEqual({
      date: '2026-07-22',
      start: '19:00',
      end: '21:00',
      label: '7/22(水) 19:00〜21:00',
    });
  });

  it('日付のみの文字列を正規化する', () => {
    expect(normalizeCandidate('2026-07-24')).toEqual({
      date: '2026-07-24',
      start: null,
      end: null,
      label: '7/24(金)',
    });
  });

  it('label 指定があればそれを優先する', () => {
    const c = normalizeCandidate({ date: '2026-07-21', label: '一次会' });
    expect(c.label).toBe('一次会');
  });
});
