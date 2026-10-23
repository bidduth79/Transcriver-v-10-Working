import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const m = vi.hoisted(() => ({
  provider: { value: { key: 'K', model: 'gemini-3.8-flash', source: 'Primary' } as any },
  generate: vi.fn(), increment: vi.fn(), scan: vi.fn(async () => ({ bgbMentionCount: 2 })),
  note: { value: null as any }, saveNote: vi.fn(),
  wikiImg: vi.fn(async () => null as any), searchImg: vi.fn(async () => null as any), wikiSummary: vi.fn(async (..._a: any[]) => null as any),
}));
vi.mock('../services/ApiKeyManager', () => ({ getActiveProvider: async () => m.provider.value, incrementTotalCalls: m.increment }));
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent: m.generate }; } }));
vi.mock('../services/speakerArchiveService', () => ({ scanDatabaseForSpeaker: m.scan, getCustomNote: () => m.note.value, saveCustomNote: m.saveNote }));
vi.mock('./speakerProfileUtils', async (orig) => ({
  ...(await orig<typeof import('./speakerProfileUtils')>()),
  fetchWikiImageByTitle: m.wikiImg, searchWikiImage: m.searchImg, fetchWikiSummary: m.wikiSummary,
}));

import { useSpeakerProfile } from './useSpeakerProfile';
import { getCachedProfile } from './speakerProfileUtils';

const aiProfile = { name: 'রহিম', imageUrl: '', wikipediaLang: 'bn', wikipediaTitle: 'রহিম_উদ্দিন', description: 'd', career: 'c', bgbViews: 'b' };
const fetchMock = vi.fn();
const setup = (ctx = 'বক্তা "রহিম" বললেন') => renderHook(({ c }) => useSpeakerProfile(c), { initialProps: { c: ctx } });
const open = async (r: any, name = 'রহিম', ignore = false) => { await act(async () => { await r.current.openProfile(name, ignore); }); };
const bn = (s: string) => s.normalize('NFC');

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  m.provider.value = { key: 'K', model: 'gemini-3.8-flash', source: 'Primary' };
  m.note.value = null;
  m.generate.mockResolvedValue({ text: '```json\n' + JSON.stringify(aiProfile) + '\n```' });
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ json: async () => ({ query: { pages: { 7: { imageinfo: [{ url: 'commons.jpg' }] } } } }) });
});
afterEach(() => vi.unstubAllGlobals());

describe('useSpeakerProfile', () => {
  it('builds a profile with grounding, image fallbacks, wiki summaries, stats and cache', async () => {
    m.wikiSummary.mockImplementation(async (_t: string, lang: string) => (lang === 'bn' ? 'BN' : 'EN'));
    const { result } = setup('x'.repeat(2100) + '"q"');
    await open(result);
    const [req] = m.generate.mock.calls[0];
    expect(req.model).toBe('gemini-3.8-flash');
    expect(req.config).toEqual({ tools: [{ googleSearch: {} }] });
    expect(req.contents).toContain('public figure: "রহিম"');
    expect(req.contents).toContain('x'.repeat(2000) + '"\n');
    expect(req.contents).toMatchSnapshot();
    expect(m.wikiImg).toHaveBeenCalledWith('রহিম_উদ্দিন', 'bn');
    expect(m.searchImg.mock.calls).toEqual([['রহিম', 'en'], ['রহিম', 'bn']]);
    expect(fetchMock.mock.calls[0][0]).toContain('gsrsearch=' + encodeURIComponent('রহিম'));
    expect(m.wikiSummary.mock.calls).toEqual([['রহিম_উদ্দিন', 'bn'], ['রহিম', 'en']]);
    expect(result.current).toMatchObject({ isOpen: true, speakerName: 'রহিম', isLoading: false, error: '' });
    expect(result.current.profile).toMatchObject({ imageUrl: 'commons.jpg', wikiSummaryBn: 'BN', wikiSummaryEn: 'EN', databaseStats: { bgbMentionCount: 2 }, customNote: undefined });
    expect(m.increment).toHaveBeenCalledWith('Speaker Profile', 'gemini-3.8-flash', 'Primary');
    expect(getCachedProfile('রহিম')?.imageUrl).toBe('commons.jpg');
  });

  it('serves cached profiles with fresh stats and notes, unless refreshing', async () => {
    const { result } = setup();
    await open(result);
    m.note.value = { speakerName: 'রহিম', notes: 'new' };
    m.scan.mockResolvedValueOnce({ bgbMentionCount: 9 });
    await open(result);
    expect(m.generate).toHaveBeenCalledTimes(1);
    expect(result.current.profile).toMatchObject({ databaseStats: { bgbMentionCount: 9 }, customNote: { notes: 'new' } });
    await act(async () => { await result.current.refreshProfile(); });
    expect(m.generate).toHaveBeenCalledTimes(2);
  });

  it('falls back to plain generation, then the lite model', async () => {
    m.provider.value = { key: 'K', model: 'gemini-3.5-flash', source: 'S' };
    m.generate.mockRejectedValueOnce(new Error('no search')).mockRejectedValueOnce(new Error('busy')).mockResolvedValueOnce({ text: 'noise ' + JSON.stringify({ ...aiProfile, imageUrl: 'given.jpg', wikipediaTitle: '' }) + ' tail' });
    const { result } = setup();
    await open(result);
    expect(m.generate.mock.calls.map(c => [c[0].model, !!c[0].config])).toEqual([['gemini-3.5-flash', true], ['gemini-3.5-flash', false], ['gemini-3.5-flash-lite', false]]);
    expect(m.increment).toHaveBeenCalledWith('Speaker Profile', 'gemini-3.5-flash-lite', 'S');
    expect(result.current.profile?.imageUrl).toBe('given.jpg');
    expect(m.wikiImg).not.toHaveBeenCalled();
    expect(m.wikiSummary.mock.calls).toEqual([['রহিম', 'bn'], ['রহিম', 'en']]);
  });

  it.each([
    ['no key', null, null, 'এপিআই কি (API Key) কনফিগার করা নেই। Settings থেকে ঠিক করুন।'],
    ['403', undefined, 'PERMISSION_DENIED 403', 'API Key-তে অনুসন্ধান চালানোর অনুমতি নেই। অনুগ্রহ করে Settings থেকে একটি সক্রিয় API Key প্রদান করুন।'],
    ['429', undefined, 'RESOURCE_EXHAUSTED', 'API কোটা সাময়িকভাবে শেষ হয়ে গেছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'],
    ['400', undefined, 'API_KEY_INVALID', 'প্রদত্ত API Key টি সঠিক নয়। Settings থেকে সঠিক কি কনফিগার করুন।'],
    ['other', undefined, 'weird failure', 'weird failure'],
    ['empty', undefined, '', 'স্পীকারের প্রোফাইল লোড করা সম্ভব হয়নি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'],
  ])('maps errors: %s', async (_n, provider, msg, expected) => {
    if (provider === null) m.provider.value = null;
    if (msg !== null) m.generate.mockRejectedValue(new Error(msg));
    const { result } = setup();
    await open(result);
    expect(bn(result.current.error)).toBe(bn(expected));
    expect(result.current.isLoading).toBe(false);
  });

  it('reports unparseable AI output', async () => {
    m.generate.mockResolvedValue({ text: 'not json' });
    const { result } = setup();
    await open(result);
    expect(result.current.error).toBe('Failed to parse profile data from AI');
  });

  it('updates custom notes in state and cache, and closes', async () => {
    const { result } = setup();
    await open(result);
    const note = { speakerName: 'রহিম', roleOrDesignation: 'R', notes: 'N', tags: [] } as any;
    act(() => result.current.updateCustomNote(note));
    expect(m.saveNote).toHaveBeenCalledWith(note);
    expect(result.current.profile?.customNote).toEqual(note);
    expect(getCachedProfile('রহিম')?.customNote).toEqual(note);
    act(() => result.current.closeProfile());
    expect(result.current.isOpen).toBe(false);
  });
});
