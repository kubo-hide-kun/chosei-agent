import { describe, expect, it } from 'vitest';
import { extractDates, fallbackParse } from '../src/server/domain/scheduleText';

// 2026-07-11 は土曜日
const BASE = new Date(2026, 6, 11);

describe('extractDates', () => {
  it('ISO 形式の日付を抽出する', () => {
    expect(extractDates('2026-07-20 と 2026/07/21', BASE)).toEqual([
      '2026-07-20',
      '2026-07-21',
    ]);
  });

  it('M/D・M月D日 形式を基準日以降の年で解決する', () => {
    expect(extractDates('7/20 か 7月21日', BASE)).toEqual(['2026-07-20', '2026-07-21']);
    // 基準日より過去の月日は翌年に解決される
    expect(extractDates('1/10', BASE)).toEqual(['2027-01-10']);
  });

  it('来週の曜日の並列表現を解決する', () => {
    // 来週 = 7/13(月) の週。火曜=7/14、木曜=7/16
    expect(extractDates('来週の火曜と木曜の夜', BASE)).toEqual(['2026-07-14', '2026-07-16']);
  });

  it('来週の平日を展開する', () => {
    expect(extractDates('来週の平日', BASE)).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
    ]);
  });

  it('今週末を解決する', () => {
    // 基準 7/11(土) → 次の土曜 7/18・次の日曜 7/12
    expect(extractDates('今週末どうですか', BASE)).toEqual(['2026-07-12', '2026-07-18']);
  });

  it('今日・明日・明後日を解決する', () => {
    expect(extractDates('今日か明日か明後日', BASE)).toEqual([
      '2026-07-11',
      '2026-07-12',
      '2026-07-13',
    ]);
  });
});

describe('fallbackParse', () => {
  it('タイトル・時間帯付きで抽出する', () => {
    const result = fallbackParse('チームの暑気払い。来週の火曜と木曜の夜でお願いします', BASE);
    expect(result).toEqual({
      title: 'チームの暑気払い',
      description: '',
      candidates: [
        { date: '2026-07-14', start: '19:00', end: '21:00' },
        { date: '2026-07-16', start: '19:00', end: '21:00' },
      ],
    });
  });

  it('時刻レンジ表記を抽出する', () => {
    const result = fallbackParse('定例会。7/21 の 19:00〜21:00', BASE);
    if ('error' in result) throw new Error('unexpected');
    expect(result.candidates[0]).toEqual({
      date: '2026-07-21',
      start: '19:00',
      end: '21:00',
    });
  });

  it('「19時から21時」形式を抽出する', () => {
    const result = fallbackParse('飲み会 7/24 19時から21時', BASE);
    if ('error' in result) throw new Error('unexpected');
    expect(result.candidates[0]).toEqual({
      date: '2026-07-24',
      start: '19:00',
      end: '21:00',
    });
  });

  it('日付が読み取れない場合はエラーを返す', () => {
    const result = fallbackParse('よろしくお願いします', BASE);
    expect('error' in result).toBe(true);
  });
});
