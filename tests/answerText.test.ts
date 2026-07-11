import { describe, expect, it } from 'vitest';
import { fallbackParseAnswers, type AnswerCandidate } from '../src/server/domain/answerText';

// 7/21=火, 7/24=金, 7/25=土 (2026年)
const CANDIDATES: AnswerCandidate[] = [
  { id: 'c1', date: '2026-07-21', label: '7/21(火) 19:00〜21:00' },
  { id: 'c2', date: '2026-07-24', label: '7/24(金) 19:00〜21:00' },
  { id: 'c3', date: '2026-07-25', label: '7/25(土)' },
];

describe('fallbackParseAnswers', () => {
  it('曜日と日付の併記を読み取る', () => {
    const result = fallbackParseAnswers('火曜は行けます、7/24 は無理、土曜は微妙', CANDIDATES);
    expect(result).toEqual({ answers: { c1: 'ok', c2: 'ng', c3: 'maybe' } });
  });

  it('M月D日形式を読み取る', () => {
    const result = fallbackParseAnswers('7月21日は参加できます。7月25日は欠席です', CANDIDATES);
    expect(result).toEqual({ answers: { c1: 'ok', c3: 'ng' } });
  });

  it('「全部OK」を全候補に適用する', () => {
    const result = fallbackParseAnswers('全部大丈夫です', CANDIDATES);
    expect(result).toEqual({ answers: { c1: 'ok', c2: 'ok', c3: 'ok' } });
  });

  it('「それ以外は無理」を未割り当て候補に適用する', () => {
    const result = fallbackParseAnswers('火曜は行けます、それ以外は無理です', CANDIDATES);
    expect(result).toEqual({ answers: { c1: 'ok', c2: 'ng', c3: 'ng' } });
  });

  it('「参加できない」を「参加」と誤読しない', () => {
    const result = fallbackParseAnswers('金曜は参加できないです', CANDIDATES);
    expect(result).toEqual({ answers: { c2: 'ng' } });
  });

  it('出欠が読み取れない入力はエラーを返す', () => {
    const result = fallbackParseAnswers('よろしくお願いします', CANDIDATES);
    expect('error' in result).toBe(true);
  });

  it('日付への言及がない出欠だけの文はエラーを返す(推測で埋めない)', () => {
    // 「行けます」だけでは対象候補が特定できない
    const result = fallbackParseAnswers('行けます', CANDIDATES);
    expect('error' in result).toBe(true);
  });
});
