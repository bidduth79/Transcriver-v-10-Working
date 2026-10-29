import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const m = vi.hoisted(() => ({
  files: [] as File[],
  saved: undefined as unknown,
  granted: true,
  paused: undefined as boolean | undefined,
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: m.toast }));
vi.mock('../services/watchFolder', () => ({
  isFolderWatchSupported: () => true,
  pickWatchFolder: async () => ({ name: 'Audio' }),
  canReadFolder: async () => m.granted,
  listFolderFiles: async () => m.files,
  saveWatchFolder: async (h: unknown) => { m.saved = h; },
  loadWatchFolder: async () => m.saved,
  forgetWatchFolder: async () => { m.saved = undefined; },
  saveWatchPaused: async (p: boolean) => { m.paused = p; },
  loadWatchPaused: async () => m.paused,
}));

import { useFolderWatch, useFolderWatchStore, chooseWatchFolder, stopWatchFolder, pauseWatchFolder, allowWatchFolder } from './useFolderWatch';
import { useHistoryStore } from './useHistoryStore';
import { useBackgroundJobStore } from './transcription/useBackgroundJobStore';
import type { HistoryItem } from '../types';

const audio = (name: string) => new File(['x'], name, { type: 'audio/ogg', lastModified: 1 });
const look = () => act(async () => { await vi.advanceTimersByTimeAsync(15_000); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  m.files = [];
  m.saved = undefined;
  m.granted = true;
  m.paused = undefined;
  useFolderWatchStore.setState({ handle: null, status: 'off', mode: 'auto' });
  useHistoryStore.setState({ history: [] });
  useBackgroundJobStore.setState({ running: null });
});
afterEach(() => vi.useRealTimers());

describe('useFolderWatch', () => {
  it('starts a batch with new audio from the chosen folder, once per file', async () => {
    const runFiles = vi.fn();
    useHistoryStore.setState({ history: [{ id: 'h', fileName: 'old.opus' } as HistoryItem] });
    m.files = [audio('new.opus'), audio('old.opus')];
    renderHook(() => useFolderWatch('en', false, runFiles, vi.fn()));
    await act(async () => { await chooseWatchFolder('en'); });
    expect(useFolderWatchStore.getState().status).toBe('watching');
    await look();
    expect(runFiles.mock.calls.map(([files]) => files.map((f: File) => f.name))).toEqual([['new.opus']]);
    expect(m.toast.info).toHaveBeenCalledTimes(1);
    await look();
    expect(runFiles).toHaveBeenCalledTimes(1);
  });

  it('waits while a batch or another transcription is running', async () => {
    const runFiles = vi.fn();
    m.files = [audio('new.opus')];
    useBackgroundJobStore.setState({ running: { name: 'x', meta: {} } });
    const { rerender } = renderHook(({ busy }) => useFolderWatch('en', busy, runFiles, vi.fn()), { initialProps: { busy: true } });
    await act(async () => { await chooseWatchFolder('en'); });
    await look();
    await look();
    expect(runFiles).not.toHaveBeenCalled();
    useBackgroundJobStore.setState({ running: null });
    rerender({ busy: false });
    await look();
    await look();
    expect(runFiles).toHaveBeenCalledTimes(1);
  });

  it('takes nothing while paused, stays paused after a reload, and goes on when turned back on', async () => {
    const runFiles = vi.fn();
    m.files = [audio('new.opus')];
    renderHook(() => useFolderWatch('en', false, runFiles, vi.fn()));
    await act(async () => { await chooseWatchFolder('en'); });
    await act(async () => { await pauseWatchFolder('en'); });
    await look();
    await look();
    expect(runFiles).not.toHaveBeenCalled();
    expect(m.paused).toBe(true);

    useFolderWatchStore.setState({ handle: null, status: 'off' });
    renderHook(() => useFolderWatch('en', false, runFiles, vi.fn()));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(useFolderWatchStore.getState().status).toBe('paused');

    await act(async () => { await allowWatchFolder('en'); });
    expect(useFolderWatchStore.getState().status).toBe('watching');
    expect(m.paused).toBe(false);
    await look();
    await look();
    expect(runFiles).toHaveBeenCalled();
  });

  it('after a reload asks for permission again, and stops when told to', async () => {
    m.saved = { name: 'Audio' };
    m.granted = false;
    renderHook(() => useFolderWatch('en', false, vi.fn(), vi.fn()));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(useFolderWatchStore.getState().status).toBe('needsPermission');
    await act(async () => { await stopWatchFolder(); });
    expect(useFolderWatchStore.getState()).toMatchObject({ handle: null, status: 'off' });
    expect(m.saved).toBeUndefined();
  });

  it('takes at most ten files at a time, oldest first; the rest come with the next batch', async () => {
    const runFiles = vi.fn();
    m.files = Array.from({ length: 13 }, (_, i) => new File(['x'], `f${String(i).padStart(2, '0')}.opus`, { type: 'audio/ogg', lastModified: i }));
    const { rerender } = renderHook(({ busy }) => useFolderWatch('en', busy, runFiles, vi.fn()), { initialProps: { busy: false } });
    await act(async () => { await chooseWatchFolder('en'); });
    await look();
    expect(runFiles.mock.calls[0][0].map((f: File) => f.name)).toEqual(['f00.opus', 'f01.opus', 'f02.opus', 'f03.opus', 'f04.opus', 'f05.opus', 'f06.opus', 'f07.opus', 'f08.opus', 'f09.opus']);
    rerender({ busy: true });
    await look();
    expect(runFiles).toHaveBeenCalledTimes(1);
    rerender({ busy: false });
    await look();
    expect(runFiles.mock.calls[1][0].map((f: File) => f.name)).toEqual(['f10.opus', 'f11.opus', 'f12.opus']);
  });

  it('in review mode lists the new files in the batch without starting it, and remembers the mode', async () => {
    const runFiles = vi.fn();
    const queueFiles = vi.fn();
    m.files = [audio('new.opus')];
    useFolderWatchStore.getState().setMode('review');
    expect(localStorage.getItem('watchFolderMode')).toBe('review');
    renderHook(() => useFolderWatch('en', false, runFiles, queueFiles));
    await act(async () => { await chooseWatchFolder('en'); });
    await look();
    expect(runFiles).not.toHaveBeenCalled();
    expect(queueFiles.mock.calls.map(([files]) => files.map((f: File) => f.name))).toEqual([['new.opus']]);
    useFolderWatchStore.getState().setMode('auto');
  });
});
