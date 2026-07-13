import { z } from 'zod';

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

/** カレンダー上に実在する日付か(2026-02-31 のようなロールオーバーを弾く) */
export function isRealDate(date: string): boolean {
  if (!dateRe.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

const START_BEFORE_END_MESSAGE = 'end は start より後の時刻にしてください';

/** 候補日時オブジェクト形式 */
export const candidateObjectSchema = z
  .object({
    date: z
      .string()
      .regex(dateRe, 'date は YYYY-MM-DD 形式で指定してください')
      .refine(isRealDate, '実在する日付を指定してください'),
    start: z.string().regex(timeRe, 'start は HH:mm 形式で指定してください').optional(),
    end: z.string().regex(timeRe, 'end は HH:mm 形式で指定してください').optional(),
    label: z.string().max(100).optional(),
  })
  .refine((c) => !c.start || !c.end || c.start < c.end, {
    message: START_BEFORE_END_MESSAGE,
    path: ['end'],
  });

/**
 * 候補日時の文字列ショートハンド。
 * 例: "2026-07-20", "2026-07-20 19:00", "2026-07-20 19:00-21:00"
 */
export const candidateStringSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}( ([01]\d|2[0-3]):[0-5]\d(-([01]\d|2[0-3]):[0-5]\d)?)?$/,
    '候補は "YYYY-MM-DD"、"YYYY-MM-DD HH:mm"、"YYYY-MM-DD HH:mm-HH:mm" のいずれかの形式で指定してください',
  )
  .refine((s) => isRealDate(s.split(' ')[0]), '実在する日付を指定してください')
  .refine((s) => {
    const time = s.split(' ')[1];
    if (!time || !time.includes('-')) return true;
    const [start, end] = time.split('-');
    return start < end;
  }, START_BEFORE_END_MESSAGE);

export const candidateSchema = z.union([candidateObjectSchema, candidateStringSchema]);

/** イベント入稿 JSON のスキーマ */
export const eventImportSchema = z.object({
  title: z.string().min(1, 'title は必須です').max(200),
  description: z.string().max(2000).optional().default(''),
  candidates: z
    .array(candidateSchema)
    .min(1, 'candidates は 1 件以上指定してください')
    .max(100, 'candidates は 100 件までです'),
});

export type CandidateInput = z.infer<typeof candidateSchema>;
export type EventImport = z.infer<typeof eventImportSchema>;

export interface NormalizedCandidate {
  date: string;
  start: string | null;
  end: string | null;
  label: string;
}

/** 文字列ショートハンド・オブジェクト形式を単一の形へ正規化する */
export function normalizeCandidate(input: CandidateInput): NormalizedCandidate {
  if (typeof input === 'string') {
    const [date, time] = input.split(' ');
    const [start, end] = time ? time.split('-') : [undefined, undefined];
    return {
      date,
      start: start ?? null,
      end: end ?? null,
      label: formatCandidateLabel(date, start ?? null, end ?? null),
    };
  }
  const start = input.start ?? null;
  const end = input.end ?? null;
  return {
    date: input.date,
    start,
    end,
    label: input.label || formatCandidateLabel(input.date, start, end),
  };
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function formatCandidateLabel(date: string, start: string | null, end: string | null): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const base = `${m}/${d}(${weekday})`;
  if (start && end) return `${base} ${start}〜${end}`;
  if (start) return `${base} ${start}〜`;
  return base;
}

export const markSchema = z.enum(['ok', 'maybe', 'ng']);
export type Mark = z.infer<typeof markSchema>;

export const responseSchema = z.object({
  name: z.string().trim().min(1, '名前は必須です').max(50),
  comment: z.string().max(500).optional().default(''),
  answers: z.record(z.string(), markSchema),
});
export type ResponseInput = z.infer<typeof responseSchema>;
