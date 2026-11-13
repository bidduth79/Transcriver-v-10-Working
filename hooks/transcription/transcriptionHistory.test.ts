import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({ addToStore: vi.fn(async () => {}), analyze: vi.fn(), keywords: ['মাদক'] }));
vi.mock('../../services/db', () => ({ STORES: { HISTORY: 'studio_history' }, addToStore: m.addToStore }));
vi.mock('../../utils/sensitiveKeywords', () => ({ getSensitiveKeywords: () => m.keywords }));
vi.mock('../../services/bgbAnalysisService', () => ({ analyzeTranscriptForBgb: m.analyze }));

import { scheduleBgbAnalysis, buildHistoryItem } from './transcriptionHistory';
import { useHistoryStore } from '../useHistoryStore';

const item: any = { id: 'h1', fileName: 'a.mp3', transcript: 'সীমান্তে মাদক', bgbRemark: undefined };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('bgbAnalysisEnabled', 'true');
  useHistoryStore.setState({ history: [{ ...item }, { id: 'h2', fileName: 'b.mp3' } as any] });
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

describe('scheduleBgbAnalysis', () => {
  it('saves the remark and updates the in-memory history after 2.5s', async () => {
    m.analyze.mockResolvedValue({ remark: 'Negative' });
    scheduleBgbAnalysis(item, item.transcript);
    await vi.advanceTimersByTimeAsync(2499);
    expect(m.analyze).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.runAllTimersAsync();
    expect(m.analyze).toHaveBeenCalledWith(item.transcript, ['মাদক']);
    expect(m.addToStore).toHaveBeenCalledWith('studio_history', expect.objectContaining({ id: 'h1', bgbRemark: 'Negative' }));
    const hist = useHistoryStore.getState().history as any[];
    expect(hist.map(h => [h.id, h.bgbRemark])).toEqual([['h1', 'Negative'], ['h2', undefined]]);
  });

  it('does nothing when disabled, without text, without matches or without a remark', async () => {
    localStorage.setItem('bgbAnalysisEnabled', 'false');
    scheduleBgbAnalysis(item, item.transcript);
    localStorage.setItem('bgbAnalysisEnabled', 'true');
    scheduleBgbAnalysis(item, '');
    scheduleBgbAnalysis(item, 'no keywords here');
    m.analyze.mockResolvedValue({});
    scheduleBgbAnalysis(item, item.transcript);
    await vi.runAllTimersAsync();
    expect(m.analyze).toHaveBeenCalledTimes(1);
    expect(m.addToStore).not.toHaveBeenCalled();
    expect((useHistoryStore.getState().history as any[])[0].bgbRemark).toBeUndefined();
  });
});

describe('buildHistoryItem', () => {
  const file = new File(['x'], 'show.opus');
  const meta = { duration: '20:00' };
  const looping = Array.from({ length: 30 }, (_, i) => `[${String(i).padStart(2, '0')}:00] **Speaker 1:** আজকের আলোচনায় আমরা কথা বলব দেশের অর্থনীতি নিয়ে।`).join('\n');

  it("keeps the warnings found in Gemini's answer, and leaves the field out when there are none", () => {
    expect(buildHistoryItem(file, meta, '[00:00] **Speaker 1:** কথা', 30, 'gemini-3.5-flash', looping).warnings).toEqual(expect.arrayContaining(['loop', 'littleText']));
    expect(buildHistoryItem(file, meta, 'text', 30, 'gemini-3.5-flash')).not.toHaveProperty('warnings');
    expect(buildHistoryItem(file, { duration: '01:00' }, 'text', 30, 'gemini-3.5-flash', 'text')).not.toHaveProperty('warnings');
  });
});
