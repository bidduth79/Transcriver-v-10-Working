import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppEventListeners } from './useAppEventListeners';
import { useAppStore } from './useAppStore';

const setup = () => {
  const fns = { loadHistory: vi.fn(), updateApiStats: vi.fn(), addToast: vi.fn() };
  const hook = renderHook(({ url }) => useAppEventListeners(fns.loadHistory, fns.updateApiStats, fns.addToast, url), { initialProps: { url: null as string | null } });
  return { ...hook, ...fns };
};

beforeEach(() => vi.clearAllMocks());

describe('useAppEventListeners', () => {
  it('loads history on mount and when the history store changes', () => {
    const { loadHistory } = setup();
    expect(loadHistory).toHaveBeenCalledTimes(1);
    act(() => useAppStore.getState().triggerStoreUpdate('studio_history'));
    expect(loadHistory).toHaveBeenCalledTimes(2);
  });

  it('refreshes API stats, but not the whole history, when the file changes', () => {
    const { rerender, loadHistory, updateApiStats } = setup();
    const statsBefore = updateApiStats.mock.calls.length;
    rerender({ url: 'blob:1' });
    rerender({ url: 'blob:2' });
    expect(loadHistory).toHaveBeenCalledTimes(1);
    expect(updateApiStats.mock.calls.length).toBe(statsBefore + 2);
  });

  it('refreshes API stats when keys change and shows app errors once', () => {
    const { updateApiStats, addToast } = setup();
    const before = updateApiStats.mock.calls.length;
    act(() => useAppStore.getState().triggerActiveApiKeyChanged());
    expect(updateApiStats.mock.calls.length).toBe(before + 1);
    act(() => useAppStore.getState().setAppError('boom'));
    expect(addToast).toHaveBeenCalledWith('boom', 'error');
    expect(useAppStore.getState().appError).toBeNull();
  });
});
