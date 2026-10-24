import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ cloud: [] as { id: string; date?: string }[], counts: 0, docs: 0, local: [] as { date?: string }[] }));
vi.mock('firebase/firestore/lite', () => ({
  getFirestore: () => ({}), collection: (_db: unknown, name: string) => name,
  query: (_name: string, ...c: any[]) => ({ wheres: c.filter(x => x.w).map(x => x.w), lim: c.find(x => x.lim)?.lim }),
  where: (...w: any[]) => ({ w }), orderBy: () => ({}), limit: (lim: number) => ({ lim }),
  getCount: async (q: any) => { m.counts++; return { data: () => ({ count: inQuery(q).length }) }; },
  getDocs: async (q: any) => {
    const docs = inQuery(q).sort((a, b) => (a.date! < b.date! ? -1 : 1)).slice(0, q.lim);
    m.docs += docs.length;
    return { empty: docs.length === 0, docs: docs.map(d => ({ data: () => d })) };
  },
}));
vi.mock('../historyRecords', () => ({ forEachHistoryRecord: async (visit: (i: any) => void) => m.local.forEach(visit) }));
function inQuery(q: any) {
  return m.cloud.filter(d => q.wheres.every(([, op, x]: string[]) => d.date !== undefined && (op === '>=' ? d.date >= x : d.date < x)));
}

import { monthsBetween, findMissingHistoryMonths, isRangeMissingLocally, localHistoryDates } from './cloudReconcile';
import { useHistoryStore } from '../../hooks/useHistoryStore';

const db = { app: 'APP' } as never;
const at = (date: string) => ({ id: date, date });

beforeEach(() => {
  m.cloud = [];
  m.local = [];
  m.counts = 0;
  m.docs = 0;
  useHistoryStore.setState({ history: [] });
});

describe('cloudReconcile', () => {
  it('lists the months between two months, across a year end', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthsBetween('2026-03', '2026-03')).toEqual(['2026-03']);
  });

  it('finds only the months with items missing here, with one count per month and one document read', async () => {
    m.cloud = [at('2026-08-03T10:00:00.000Z'), at('2026-08-20T10:00:00.000Z'), at('2026-09-15T10:00:00.000Z'), at('2026-10-01T00:00:00.000Z'), { id: 'marker' }];
    const local = ['2026-08-03T10:00:00.000Z', '2026-08-20T10:00:00.000Z', '2026-10-01T00:00:00.000Z'];
    const missing = await findMissingHistoryMonths(db, local, new Date('2026-10-24T12:00:00.000Z'));
    expect(missing).toEqual([{ field: 'date', min: '2026-09', max: '2026-10' }]);
    expect(m.counts).toBe(3);
    expect(m.docs).toBe(1);
  });

  it('reads nothing more when the cloud has no dated history', async () => {
    expect(await findMissingHistoryMonths(db, [])).toEqual([]);
    expect(m.counts).toBe(0);
  });

  it('compares a date range by counting only', async () => {
    m.cloud = [at('2026-10-23T05:00:00.000Z'), at('2026-10-24T05:00:00.000Z')];
    const range = { field: 'date' as const, min: '2026-10-23' };
    expect(await isRangeMissingLocally(db, 'studio_history', range, ['2026-10-23T05:00:00.000Z'])).toBe(true);
    expect(await isRangeMissingLocally(db, 'studio_history', range, ['2026-10-23T05:00:00.000Z', '2026-10-24T05:00:00.000Z', '2026-09-01'])).toBe(false);
    expect(m.docs).toBe(0);
  });

  it('takes local dates from the loaded list, or from IndexedDB before it has loaded', async () => {
    m.local = [{ date: '2026-01-01' }, {}];
    expect(await localHistoryDates()).toEqual(['2026-01-01', '']);
    useHistoryStore.setState({ history: [{ id: 'a', date: '2026-05-05' }] as never });
    expect(await localHistoryDates()).toEqual(['2026-05-05']);
  });
});
