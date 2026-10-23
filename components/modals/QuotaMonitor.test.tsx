import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const m = vi.hoisted(() => ({ logs: [] as any[], model: 'gemini-3.8-flash', getLogs: vi.fn() }));
vi.mock('../../services/ApiKeyManager', () => ({
  getApiCallLogs: m.getLogs,
  getActiveModel: () => m.model,
  getActiveProvider: async () => ({ key: 'KEY-ABCD' }),
}));

import { QuotaMonitor } from './QuotaMonitor';
import { useAppStore } from '@/hooks/useAppStore';

const NOW = new Date('2026-10-22T12:00:30Z').getTime();
const at = (msAgo: number, tokens?: number, id = String(msAgo)) => ({ id, timestamp: new Date(NOW - msAgo).toISOString(), model: m.model, status: 'success', tokens });
const MIN = 60000, DAY = 86400000;

const busyLogs = [
  at(5000, 1200), at(20000), at(40000, 300),          // current minute window
  at(2 * MIN + 1000, 900000), at(2 * MIN + 2000, 400000), // a heavy minute (TPM peak 1.3M)
  at(3 * 3600000), at(DAY + 1000), at(DAY + 2000), at(3 * DAY), at(9 * DAY),
];

const renderAt = async (props: any = {}) => {
  let utils: any;
  await act(async () => { utils = render(<QuotaMonitor isDark appLang="bn" activeColors={{}} {...props} />); });
  return utils as ReturnType<typeof render>;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(NOW);
  m.model = 'gemini-3.8-flash';
  m.logs = [];
  m.getLogs.mockImplementation(async () => m.logs);
});
afterEach(() => vi.useRealTimers());

describe('QuotaMonitor markup', () => {
  it('renders empty state (dark, bn)', async () => {
    expect((await renderAt()).container.innerHTML).toMatchSnapshot();
  });

  it('renders busy flash usage (light, en)', async () => {
    m.logs = busyLogs;
    expect((await renderAt({ isDark: false, appLang: 'en' })).container.innerHTML).toMatchSnapshot();
  });

  it('renders pro model at/over limits (dark)', async () => {
    m.model = 'gemini-3.1-pro-preview';
    m.logs = [at(1000, 20000), at(2000, 20000), at(3000), ...Array.from({ length: 60 }, (_, i) => at(3600000 + i * 1000, 10))];
    expect((await renderAt()).container.innerHTML).toMatchSnapshot();
  });

  it('shows "Gemini Model" before a model is known', async () => {
    m.model = '';
    const { container } = await renderAt();
    expect(container.textContent).toContain('Gemini Model');
  });
});

describe('QuotaMonitor refresh', () => {
  it('polls every 5s, skips while hidden and refreshes on visibility/store events', async () => {
    m.logs = [at(1000)];
    const { container } = await renderAt();
    const base = m.getLogs.mock.calls.length;
    m.logs = [at(1000), at(500, 10, 'new')];
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(m.getLogs.mock.calls.length).toBe(base + 1);
    expect(container.textContent).toContain('2 / 15');

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(m.getLogs.mock.calls.length).toBe(base + 1);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(m.getLogs.mock.calls.length).toBe(base + 2);

    m.model = 'gemini-3.1-pro-preview';
    await act(async () => { useAppStore.getState().triggerActiveApiKeyChanged(); });
    expect(container.textContent).toContain('gemini-3.1-pro-preview');
    // Requests are counted per model, so the other model's requests do not use this quota
    expect(container.textContent).toContain('0 / 2');
    await act(async () => { useAppStore.getState().triggerApiCallLogged(); });
    expect(m.getLogs.mock.calls.length).toBe(base + 4);
  });
});
