import type { Mark } from '@/server/domain/event';

/**
 * 出欠回答の自然文をルールベースで ◯/△/✕ に変換する。
 * Claude API が使えない環境向けフォールバック。代表的な日本語表現のみカバーする。
 */

export interface AnswerCandidate {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
}

export interface ParsedAnswers {
  answers: Record<string, Mark>;
}

const WEEKDAY_CHARS = ['日', '月', '火', '水', '木', '金', '土'];

function weekdayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAY_CHARS[new Date(y, m - 1, d).getDay()];
}

/** 否定 → 保留 → 肯定の順で判定する(「参加できない」を「参加」と誤読しないため) */
function polarityOf(segment: string): Mark | null {
  if (/無理|行けない|行けません|いけない|参加できない|できません|欠席|不可|NG|✕|×|ダメ|だめ|厳しい|外して/.test(segment)) {
    return 'ng';
  }
  if (/微妙|たぶん|多分|かも|未定|わからない|分からない|調整|検討|△|遅れ/.test(segment)) {
    return 'maybe';
  }
  if (/行ける|行けます|いけます|参加|大丈夫|OK|オッケー|おっけ|◯|○|〇|可能|いける|空いて/.test(segment)) {
    return 'ok';
  }
  return null;
}

/** セグメント内で言及されている候補を探す(M/D・M月D日・曜日) */
function referencedCandidates(segment: string, candidates: AnswerCandidate[]): AnswerCandidate[] {
  return candidates.filter((c) => {
    const [, m, d] = c.date.split('-').map(Number);
    // 前後に数字が続かない完全一致のみ(「7/24」が「7/2」にマッチしないように)
    if (new RegExp(`(?<![\\d/])${m}/${d}(?![\\d/])`).test(segment)) return true;
    if (new RegExp(`(?<!\\d)${m}月${d}日`).test(segment)) return true;
    if (segment.includes(c.date)) return true;
    const wd = weekdayOf(c.date);
    if (new RegExp(`${wd}曜`).test(segment)) return true;
    return false;
  });
}

export function fallbackParseAnswers(
  text: string,
  candidates: AnswerCandidate[],
): ParsedAnswers | { error: string } {
  const answers: Record<string, Mark> = {};
  const segments = text.split(/[、。\n,;]/).filter((s) => s.trim().length > 0);

  for (const segment of segments) {
    const polarity = polarityOf(segment);
    if (!polarity) continue;

    // 「全部」「どれも」は全候補に適用
    if (/全部|全日|全日程|どれも|いずれも|すべて|全て/.test(segment)) {
      for (const c of candidates) answers[c.id] = polarity;
      continue;
    }

    const referenced = referencedCandidates(segment, candidates);

    // 「火曜以外は無理」= 言及された候補では**ない**方に適用する。
    // 言及された候補自体の出欠は推測で埋めず未割り当てのまま残す
    if (referenced.length > 0 && /以外/.test(segment)) {
      const referencedIds = new Set(referenced.map((c) => c.id));
      for (const c of candidates) {
        if (!referencedIds.has(c.id) && !(c.id in answers)) answers[c.id] = polarity;
      }
      continue;
    }

    if (referenced.length > 0) {
      for (const c of referenced) answers[c.id] = polarity;
      continue;
    }

    // 「それ以外は」「残りは」は未割り当ての候補に適用
    if (/それ以外|他は|ほかは|あとは|残り/.test(segment)) {
      for (const c of candidates) {
        if (!(c.id in answers)) answers[c.id] = polarity;
      }
    }
  }

  if (Object.keys(answers).length === 0) {
    return {
      error:
        '回答を読み取れませんでした。「7/21 は参加、金曜は無理」のように日付・曜日と出欠を書いてください。',
    };
  }
  return { answers };
}
