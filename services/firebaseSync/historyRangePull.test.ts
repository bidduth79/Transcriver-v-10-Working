import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({ configured: true, pull: vi.fn(), trigger: vi.fn(), missing: vi.fn() }));
vi.mock('../firebase', () => ({ get db() { return m.configured ? { app: 'APP' } : null; }, get isFirebaseConfigured() { return m.configured; }, authPromise: Promise.resolve() }));
vi.mock('../db', () => ({ initDB: async () => ({ fake: true }) }));
vi.mock('./pullStorePages', () => ({ pullStoreInPages: m.pull }));
vi.mock('./cloudReconcile', () => ({ isRangeMissingLocally: m.missing, localHistoryDates: async () => [] }));
vi.mock('../../hooks/useAppStore', () => ({ useAppStore: { getState: () => ({ triggerStoreUpdate: m.trigger }) } }));

import { fetchHistoryDaysFromCloud, fetchOlderHistoryFromCloud } from './historyRangePull';

const ranges = () => m.pull.mock.calls.map(c => [c[0].since.min.slice(0, 10), c[0].since.max.slice(0, 10)]);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  m.configured = true;
  m.pull.mockResolvedValue({ cloudCount: 3, merged: 2, completed: true });
  m.missing.mockResolvedValue(true);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-23T12:00:00'));
  vi.stubGlobal('navigator', { onLine: true });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('fetchHistoryDaysFromCloud', () => {
  it('reads one list day from the cloud once, then remembers it', async () => {
    expect(await fetchHistoryDaysFromCloud(new Date(2026, 9, 5))).toBe(2);
    expect(m.pull.mock.calls[0][0]).toMatchObject({ storeName: 'studio_history', since: { field: 'date', min: '2026-10-05T00:00:00.000Z', max: '2026-10-06T00:00:00.000Z' } });
    expect(m.trigger).toHaveBeenCalledWith('studio_history');
    expect(await fetchHistoryDaysFromCloud(new Date(2026, 9, 5))).toBe(0);
    expect(m.pull).toHaveBeenCalledTimes(1);
  });

  it('does not read a day whose items this device already has (counting showed nothing missing)', async () => {
    m.missing.mockResolvedValue(false);
    expect(await fetchHistoryDaysFromCloud(new Date(2026, 9, 5))).toBe(0);
    expect(m.missing.mock.calls[0][2]).toEqual({ field: 'date', min: '2026-10-05T00:00:00.000Z', max: '2026-10-06T00:00:00.000Z' });
    expect(m.pull).not.toHaveBeenCalled();
    expect(await fetchHistoryDaysFromCloud(new Date(2026, 9, 5))).toBe(0);
    expect(m.missing).toHaveBeenCalledTimes(1);
  });

  it('does not remember yesterday or today, or an interrupted read', async () => {
    await fetchHistoryDaysFromCloud(new Date(2026, 9, 22));
    await fetchHistoryDaysFromCloud(new Date(2026, 9, 22));
    m.pull.mockResolvedValue({ cloudCount: 1, merged: 0, completed: false });
    await fetchHistoryDaysFromCloud(new Date(2026, 9, 1));
    await fetchHistoryDaysFromCloud(new Date(2026, 9, 1));
    expect(m.pull).toHaveBeenCalledTimes(4);
    expect(m.trigger).toHaveBeenCalledTimes(2);
  });

  it('reads nothing when Firebase is off or the browser is offline', async () => {
    m.configured = false;
    expect(await fetchHistoryDaysFromCloud(new Date(2026, 9, 5))).toBe(0);
    m.configured = true;
    (navigator as any).onLine = false;
    expect(await fetchOlderHistoryFromCloud('2026-10-01T10:00:00.000Z')).toBeNull();
    expect(m.pull).not.toHaveBeenCalled();
  });
});

describe('fetchOlderHistoryFromCloud', () => {
  it('steps back a week at a time from the oldest local item', async () => {
    expect(await fetchOlderHistoryFromCloud('2026-10-10T08:00:00.000Z')).toBe(2);
    expect(await fetchOlderHistoryFromCloud('2026-10-10T08:00:00.000Z')).toBe(2);
    expect(ranges()).toEqual([['2026-10-03', '2026-10-10'], ['2026-09-26', '2026-10-03']]);
  });
});
