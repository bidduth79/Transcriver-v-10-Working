import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const m = vi.hoisted(() => ({ texts: new Map<string, string>(), get: vi.fn(), find: vi.fn() }));
vi.mock('../../services/historyRecords', () => ({ getHistoryTranscript: m.get, findHistoryIdsByTranscript: m.find }));

import { useHistoryTranscript, loadHistoryTranscript, rememberHistoryTranscript, forgetHistoryTranscripts } from './useHistoryTranscript';
import { useTranscriptSearchIds } from './useTranscriptSearchIds';

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  vi.clearAllMocks();
  forgetHistoryTranscripts();
  m.texts = new Map([['a', 'alpha'], ['b', 'beta']]);
  m.get.mockImplementation(async (id: string) => m.texts.get(id) ?? '');
});

describe('useHistoryTranscript', () => {
  it('reads a saved transcript once, then serves it from the cache', async () => {
    const { result, rerender } = renderHook(({ id }) => useHistoryTranscript(id), { initialProps: { id: 'a' } });
    expect(result.current).toBe('');
    await flush();
    expect(result.current).toBe('alpha');
    rerender({ id: 'b' });
    await flush();
    rerender({ id: 'a' });
    expect(result.current).toBe('alpha');
    expect(m.get.mock.calls.map(c => c[0])).toEqual(['a', 'b']);
  });

  it('uses inline text, stays empty when disabled, and follows remembered edits', async () => {
    expect(renderHook(() => useHistoryTranscript('a', true, 'inline')).result.current).toBe('inline');
    expect(renderHook(() => useHistoryTranscript('a', false)).result.current).toBe('');
    rememberHistoryTranscript('a', 'edited');
    expect(await loadHistoryTranscript('a')).toBe('edited');
    expect(m.get).not.toHaveBeenCalled();
  });

  it('keeps at most 200 transcripts in the cache', async () => {
    for (let i = 0; i < 201; i++) rememberHistoryTranscript(`id${i}`, 't');
    await loadHistoryTranscript('id0');
    await loadHistoryTranscript('id200');
    expect(m.get.mock.calls.map(c => c[0])).toEqual(['id0']);
  });
});

describe('useTranscriptSearchIds', () => {
  it('returns matching ids for the query, keeps them while rescanning, and null without a query', async () => {
    m.find.mockResolvedValue(new Set(['a']));
    const { result, rerender } = renderHook(({ q, key }) => useTranscriptSearchIds(q, key), { initialProps: { q: 'al(', key: 1 } });
    expect(result.current).toBeNull();
    await flush();
    expect([...result.current!]).toEqual(['a']);
    expect(m.find.mock.calls[0][0].test('xAL(y')).toBe(true);
    m.find.mockResolvedValue(new Set(['a', 'b']));
    rerender({ q: 'al(', key: 2 });
    expect([...result.current!]).toEqual(['a']);
    await flush();
    expect([...result.current!]).toEqual(['a', 'b']);
    rerender({ q: '  ', key: 2 });
    expect(result.current).toBeNull();
  });
});
