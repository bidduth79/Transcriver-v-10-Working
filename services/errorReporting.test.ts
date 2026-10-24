import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock('./SystemLogger', () => ({ logSystemActivity: m.log }));

import { reportAppError } from './errorReporting';

beforeEach(() => { m.log.mockClear(); vi.useRealTimers(); });

describe('reportAppError', () => {
  it('keeps the message and the code location in the activity log', () => {
    const err = new Error('boom');
    err.stack = 'Error: boom with private words\n    at load (app.js:10:5)\n    at run (app.js:20:1)';
    reportAppError('window', err);
    expect(m.log).toHaveBeenCalledWith('SYSTEM', 'ERROR', 'App error (window)', 'boom\nat load (app.js:10:5)\nat run (app.js:20:1)');
    expect(m.log.mock.calls[0][3]).not.toContain('private words');
  });

  it('cuts long messages and records the same error once a minute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T10:00:00'));
    const long = 'x'.repeat(500);
    reportAppError('promise', long);
    reportAppError('promise', long);
    expect(m.log).toHaveBeenCalledTimes(1);
    expect(m.log.mock.calls[0][3]).toBe(`${'x'.repeat(200)}…`);
    vi.setSystemTime(new Date('2026-10-24T10:01:01'));
    reportAppError('promise', long);
    expect(m.log).toHaveBeenCalledTimes(2);
  });

  it('handles values that are not errors', () => {
    reportAppError('promise-other', { reason: 1 });
    reportAppError('promise-null', null);
    expect(m.log.mock.calls.map(c => c[3])).toEqual(['[object Object]', 'null']);
  });
});
