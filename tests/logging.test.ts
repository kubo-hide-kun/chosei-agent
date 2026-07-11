import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger, log } from '../src/server/infrastructure/logging/logger';
import { withApiLogging } from '../src/server/infrastructure/logging/withApiLogging';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('log', () => {
  it('1 行の JSON として出力される', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log('info', 'test.event', { foo: 'bar', count: 3 });
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed).toMatchObject({ level: 'info', event: 'test.event', foo: 'bar', count: 3 });
    expect(parsed.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('error レベルは console.error に出る', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    log('error', 'test.error');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('createRequestLogger', () => {
  it('全行に requestId が付き、audit は audit.* 名前空間 + audit フラグになる', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const reqLog = createRequestLogger('req-123');
    reqLog.info('some.event');
    reqLog.audit('event.created', { eventId: 'e1' });
    const first = JSON.parse(spy.mock.calls[0][0]);
    const second = JSON.parse(spy.mock.calls[1][0]);
    expect(first.requestId).toBe('req-123');
    expect(second).toMatchObject({
      requestId: 'req-123',
      event: 'audit.event.created',
      audit: true,
      eventId: 'e1',
    });
  });
});

describe('withApiLogging', () => {
  it('成功時: x-request-id ヘッダを付与し、api.request を 1 行記録する', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = withApiLogging<unknown>('/api/test', async () =>
      NextResponse.json({ ok: true }, { status: 201 }),
    );
    const res = await handler(new NextRequest('http://localhost/api/test', { method: 'POST' }), {});
    expect(res.status).toBe(201);
    expect(res.headers.get('x-request-id')).toBeTruthy();
    const lines = spy.mock.calls.map((c) => JSON.parse(c[0]));
    const reqLine = lines.find((l) => l.event === 'api.request');
    expect(reqLine).toMatchObject({ route: '/api/test', method: 'POST', status: 201 });
    expect(typeof reqLine.durationMs).toBe('number');
  });

  it('未捕捉例外: スタックを応答に含めず、requestId 付きの 500 を返す', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = withApiLogging<unknown>('/api/test', async () => {
      throw new Error('boom');
    });
    const res = await handler(new NextRequest('http://localhost/api/test'), {});
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.requestId).toBe(res.headers.get('x-request-id'));
    expect(JSON.stringify(body)).not.toContain('boom');
    const logged = JSON.parse(spy.mock.calls[0][0]);
    expect(logged).toMatchObject({ event: 'api.unhandled_error', message: 'boom' });
    expect(logged.requestId).toBe(body.requestId);
  });
});
