import { randomUUID } from 'node:crypto';

/**
 * 構造化ログ(1 イベント = 1 JSON 行、stdout)。
 * Railway 等のホスティングはstdoutを収集するため、追加インフラなしで検索できる。
 * 個人情報(名前・回答本文・自然文入力の内容)はログに残さない。
 */

type LogLevel = 'info' | 'warn' | 'error';

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function newRequestId(): string {
  return randomUUID();
}

/** リクエスト単位のロガー。全行に requestId が付く */
export interface RequestLogger {
  requestId: string;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  /** 監査イベント(状態変更・セキュリティ事象)。event は "audit.*" 名前空間 */
  audit(event: string, fields?: LogFields): void;
}

export function createRequestLogger(requestId: string): RequestLogger {
  return {
    requestId,
    info: (event, fields) => log('info', event, { requestId, ...fields }),
    warn: (event, fields) => log('warn', event, { requestId, ...fields }),
    error: (event, fields) => log('error', event, { requestId, ...fields }),
    audit: (event, fields) => log('info', `audit.${event}`, { requestId, audit: true, ...fields }),
  };
}
