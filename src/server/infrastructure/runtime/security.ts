import { timingSafeEqual } from 'node:crypto';

/**
 * 不正利用対策(判断の記録は docs/adr/0006AbuseProtection.md)。
 * - アクセスキー(合言葉): CHOSEI_ACCESS_KEY を設定すると、イベント作成と AI 解析にキーが必須になる
 * - レートリミット: IP 単位のスライディングウィンドウ(インメモリ。単一プロセス前提)
 * - Claude 予算: 1 日あたりの呼び出し上限。超過後は課金を止めルールベースに縮退する
 */

/** キー未設定なら常に許可(開発モード)。設定済みなら定数時間比較で照合する */
export function verifyAccessKey(provided: string | null): boolean {
  const expected = process.env.CHOSEI_ACCESS_KEY;
  if (!expected) return true;
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isAccessKeyRequired(): boolean {
  return Boolean(process.env.CHOSEI_ACCESS_KEY);
}

const buckets = new Map<string, number[]>();
const MAX_BUCKETS = 10_000;

/** true = 許可。windowMs 内のヒット数が limit を超えたら拒否する */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  // メモリ上限: あふれたら古いバケットから捨てる(DoS でメモリを食い潰させない)
  if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest !== undefined) buckets.delete(oldest);
  }
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}

let budgetDate = '';
let budgetUsed = 0;

/**
 * Claude 呼び出しの 1 日予算を 1 消費する。true = まだ予算内。
 * 超過しても API は落とさず、呼び出し側でルールベースに縮退する。
 */
export function consumeClaudeBudget(now = new Date()): boolean {
  const limit = Number(process.env.CHOSEI_AGENT_DAILY_LIMIT ?? '200');
  if (!Number.isFinite(limit) || limit <= 0) return false;
  const today = now.toISOString().slice(0, 10);
  if (budgetDate !== today) {
    budgetDate = today;
    budgetUsed = 0;
  }
  if (budgetUsed >= limit) return false;
  budgetUsed += 1;
  return true;
}

/** テスト用: 予算カウンタをリセットする */
export function resetClaudeBudgetForTest(): void {
  budgetDate = '';
  budgetUsed = 0;
}

export const RATE_LIMITS = {
  /** AI 解析(Claude 課金の可能性がある操作) */
  agent: { limit: 10, windowMs: 60_000 },
  /** イベント作成 */
  createEvent: { limit: 20, windowMs: 60_000 },
  /** 出欠回答 */
  respond: { limit: 30, windowMs: 60_000 },
} as const;

export const ERROR_MESSAGES = {
  unauthorized: '合言葉が正しくありません。イベントの管理者に確認してください。',
  rateLimited: 'リクエストが多すぎます。しばらく待ってから再度お試しください。',
} as const;
