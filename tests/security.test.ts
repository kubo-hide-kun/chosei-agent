import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  consumeClaudeBudget,
  rateLimit,
  resetClaudeBudgetForTest,
  verifyAccessKey,
} from '../src/server/infrastructure/runtime/security';

describe('verifyAccessKey', () => {
  const original = process.env.CHOSEI_ACCESS_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.CHOSEI_ACCESS_KEY;
    else process.env.CHOSEI_ACCESS_KEY = original;
  });

  it('キー未設定なら常に許可する(開発モード)', () => {
    delete process.env.CHOSEI_ACCESS_KEY;
    expect(verifyAccessKey(null)).toBe(true);
    expect(verifyAccessKey('anything')).toBe(true);
  });

  it('キー設定時は一致した場合のみ許可する', () => {
    process.env.CHOSEI_ACCESS_KEY = 'himitsu';
    expect(verifyAccessKey('himitsu')).toBe(true);
    expect(verifyAccessKey('wrong')).toBe(false);
    expect(verifyAccessKey('')).toBe(false);
    expect(verifyAccessKey(null)).toBe(false);
  });

  it('長さの異なるキーを拒否する', () => {
    process.env.CHOSEI_ACCESS_KEY = 'himitsu';
    expect(verifyAccessKey('himitsu-nagai')).toBe(false);
  });
});

describe('rateLimit', () => {
  it('ウィンドウ内の上限を超えたら拒否する', () => {
    const key = `test:${Math.random()}`;
    const now = 1_000_000;
    expect(rateLimit(key, 3, 60_000, now)).toBe(true);
    expect(rateLimit(key, 3, 60_000, now + 1)).toBe(true);
    expect(rateLimit(key, 3, 60_000, now + 2)).toBe(true);
    expect(rateLimit(key, 3, 60_000, now + 3)).toBe(false);
  });

  it('ウィンドウが過ぎたら再び許可する', () => {
    const key = `test:${Math.random()}`;
    const now = 1_000_000;
    expect(rateLimit(key, 1, 60_000, now)).toBe(true);
    expect(rateLimit(key, 1, 60_000, now + 1)).toBe(false);
    expect(rateLimit(key, 1, 60_000, now + 60_001)).toBe(true);
  });

  it('キーが異なれば独立してカウントする', () => {
    const a = `test:${Math.random()}`;
    const b = `test:${Math.random()}`;
    const now = 1_000_000;
    expect(rateLimit(a, 1, 60_000, now)).toBe(true);
    expect(rateLimit(b, 1, 60_000, now)).toBe(true);
  });
});

describe('consumeClaudeBudget', () => {
  const original = process.env.CHOSEI_AGENT_DAILY_LIMIT;
  beforeEach(() => resetClaudeBudgetForTest());
  afterEach(() => {
    if (original === undefined) delete process.env.CHOSEI_AGENT_DAILY_LIMIT;
    else process.env.CHOSEI_AGENT_DAILY_LIMIT = original;
    resetClaudeBudgetForTest();
  });

  it('1 日の上限まで消費でき、超えたら false を返す', () => {
    process.env.CHOSEI_AGENT_DAILY_LIMIT = '2';
    const day = new Date('2026-07-11T01:00:00Z');
    expect(consumeClaudeBudget(day)).toBe(true);
    expect(consumeClaudeBudget(day)).toBe(true);
    expect(consumeClaudeBudget(day)).toBe(false);
  });

  it('JST の 0:00 でリセットされる(UTC 基準ではない)', () => {
    process.env.CHOSEI_AGENT_DAILY_LIMIT = '1';
    // 2026-07-11T14:00Z = JST 7/11 23:00
    expect(consumeClaudeBudget(new Date('2026-07-11T14:00:00Z'))).toBe(true);
    // 2026-07-11T14:30Z = JST 7/11 23:30 → 同日なので予算切れ
    expect(consumeClaudeBudget(new Date('2026-07-11T14:30:00Z'))).toBe(false);
    // 2026-07-11T15:10Z = JST 7/12 0:10 → 日付が変わりリセット
    expect(consumeClaudeBudget(new Date('2026-07-11T15:10:00Z'))).toBe(true);
  });

  it('上限 0 以下・不正値は常に false(Claude を使わない)', () => {
    process.env.CHOSEI_AGENT_DAILY_LIMIT = '0';
    expect(consumeClaudeBudget(new Date('2026-07-11T10:00:00Z'))).toBe(false);
  });
});
