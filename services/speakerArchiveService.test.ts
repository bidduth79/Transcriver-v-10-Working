import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({ records: [] as any[] }));
vi.mock('./db', () => ({ STORES: { HISTORY: 'studio_history' }, getAllFromStore: vi.fn(async () => m.records) }));
// IndexedDB cursor order is deliberately the reverse of the list order
vi.mock('./historyRecords', () => ({ forEachHistoryRecord: vi.fn(async (visit: any) => [...m.records].reverse().forEach(visit)) }));

import { scanDatabaseForSpeaker } from './speakerArchiveService';
import { useHistoryStore } from '../hooks/useHistoryStore';

const rec = (id: string, fileName: string, transcript: string) => ({ id, fileName, date: `2026-10-0${id}`, transcript });

beforeEach(() => {
  // The current transcript is dated today; keep "today" fixed so the snapshot does not change daily
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-23T12:00:00'));
  m.records = [
    rec('3', 'c.mp3', '[00:01] **রহিম:** সীমান্তে বিজিবি সাহসী কাজ করছে\n[00:05] **করিম:** হ্যাঁ'),
    rec('2', 'b.mp3', '**রহিম:** বিএসএফ গুলি চালিয়েছে, অভিযোগ আছে\n**সালাম:** ঠিক\nরহিম বলেন সীমান্ত খোলা'),
    rec('1', 'a.mp3', '[00:02] **রহিম**: বিজিবি দুর্নীতি করেছে বলে অভিযোগ\n**করিম**: কিছু না'),
    rec('4', 'd.mp3', '**রহিম**: সীমান্ত পাহারায় বিজিবি সাহসী\n**সালাম**: হ্যাঁ'),
    { id: '0', fileName: 'empty.mp3', date: '2026-10-01' },
  ];
  useHistoryStore.setState({ history: m.records as any });
});

afterEach(() => vi.useRealTimers());

describe('scanDatabaseForSpeaker', () => {
  it('collects appearances, BGB mentions with sentiment, and co-speakers in list order', async () => {
    const stats = await scanDatabaseForSpeaker('রহিম', '**রহিম:** বর্ডার গার্ড ধন্যবাদ পাওয়ার যোগ্য');
    expect(stats).toMatchSnapshot();
    expect(stats.mentions.map(x => x.historyId)).toMatchSnapshot('mention order');
  });

  it('returns no stance when the speaker is not found', async () => {
    const stats = await scanDatabaseForSpeaker('অচেনা');
    expect(stats).toMatchObject({ totalAppearances: 0, bgbMentionCount: 0, overallStance: 'none', filesAppeared: [] });
  });
});
