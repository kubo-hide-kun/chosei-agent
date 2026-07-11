import type { EventImport } from '@/server/domain/event';

/**
 * Claude API が使えない環境向けのルールベース抽出。
 * 日本語の日付・時間帯表現の代表的なパターンのみをカバーする。
 */

interface TimeRange {
  start?: string;
  end?: string;
}

const WEEKDAY_CHARS = ['日', '月', '火', '水', '木', '金', '土'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** 基準日以降で次に来る指定曜日 (nextWeek=true なら来週の週内) */
function nextWeekday(base: Date, weekday: number, nextWeek: boolean): Date {
  const d = new Date(base);
  if (nextWeek) {
    // 次の月曜まで進めてから曜日を合わせる
    const daysToMonday = ((8 - d.getDay()) % 7) || 7;
    d.setDate(d.getDate() + daysToMonday);
    d.setDate(d.getDate() + ((weekday - 1 + 7) % 7));
  } else {
    const diff = (weekday - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
  }
  return d;
}

function extractTimeRange(text: string): TimeRange {
  // "19:00-21:00" / "19:00〜21:00" / "19時-21時" / "19時から21時"
  const range = text.match(
    /(\d{1,2})(?::(\d{2})|時)(?:\s*[-〜~－]\s*|から)(\d{1,2})(?::(\d{2})|時)/,
  );
  if (range) {
    return {
      start: `${pad(Number(range[1]))}:${range[2] ?? '00'}`,
      end: `${pad(Number(range[3]))}:${range[4] ?? '00'}`,
    };
  }
  const single = text.match(/(\d{1,2})(?::(\d{2})|時)(?:から|開始|〜|~)?/);
  if (single) {
    const h = Number(single[1]);
    if (h >= 0 && h <= 23) return { start: `${pad(h)}:${single[2] ?? '00'}` };
  }
  if (/夜|ディナー|晩/.test(text)) return { start: '19:00', end: '21:00' };
  if (/昼|ランチ/.test(text)) return { start: '12:00', end: '13:00' };
  if (/朝|モーニング/.test(text)) return { start: '09:00', end: '10:00' };
  return {};
}

function resolveYear(base: Date, month: number, day: number): string {
  const candidate = new Date(base.getFullYear(), month - 1, day);
  if (toDateString(candidate) < toDateString(base)) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return toDateString(candidate);
}

export function extractDates(text: string, base: Date): string[] {
  const dates = new Set<string>();

  // ISO 形式 2026-07-20 / 2026/07/20
  for (const m of text.matchAll(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g)) {
    dates.add(`${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`);
  }
  // 7/20, 7月20日 (年なし)
  for (const m of text.matchAll(/(?<!\d[-/年])(?<!\d)(\d{1,2})[/月](\d{1,2})日?/g)) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      dates.add(resolveYear(base, month, day));
    }
  }
  if (/今日/.test(text)) dates.add(toDateString(base));
  if (/明日/.test(text)) dates.add(toDateString(addDays(base, 1)));
  if (/明後日/.test(text)) dates.add(toDateString(addDays(base, 2)));

  // 来週/今週 + 曜日 (「来週の火曜と木曜」のような並列にも対応)
  for (const m of text.matchAll(/(来週|今週|次の)([^。\n]*)/g)) {
    const nextWeek = m[1] === '来週';
    for (const wd of m[2].matchAll(/([日月火水木金土])曜/g)) {
      const weekday = WEEKDAY_CHARS.indexOf(wd[1]);
      dates.add(toDateString(nextWeekday(base, weekday, nextWeek)));
    }
    if (/平日/.test(m[2])) {
      for (let w = 1; w <= 5; w++) dates.add(toDateString(nextWeekday(base, w, nextWeek)));
    }
    if (/週末/.test(m[2]) || m[1] + m[2].slice(0, 2) === '今週末') {
      for (const w of [6, 0]) dates.add(toDateString(nextWeekday(base, w, nextWeek)));
    }
  }
  if (/今週末/.test(text)) {
    for (const w of [6, 0]) dates.add(toDateString(nextWeekday(base, w, false)));
  }

  return [...dates].sort().slice(0, 20);
}

function extractTitle(text: string): string {
  const firstLine = text.split('\n')[0].trim();
  const beforePunct = firstLine.split(/[。、]/)[0].trim();
  // 日付・時間の指定だけの行はタイトルにしない
  if (beforePunct && !/^[\d\s/:〜~月日時分-]+$/.test(beforePunct)) {
    return beforePunct.slice(0, 50);
  }
  return '日程調整';
}

export function fallbackParse(text: string, base: Date): EventImport | { error: string } {
  const dates = extractDates(text, base);
  if (dates.length === 0) {
    return { error: '候補日時を抽出できませんでした。日付(例: 7/20、来週の火曜)を含めて入力してください。' };
  }
  const time = extractTimeRange(text);
  return {
    title: extractTitle(text),
    description: '',
    candidates: dates.map((date) => ({ date, ...time })),
  };
}
