import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';

const m = vi.hoisted(() => ({
  localServer: { value: false },
  cloud: vi.fn(),
  speedOpt: { value: false },
  setActiveModel: vi.fn(),
  setSpeedOptimizationEnabled: vi.fn(),
  resetModelToClassicDefault: vi.fn(),
}));

vi.mock('../../services/api.ts', () => ({ getApiUrl: (p: string) => `http://local/${p}`, checkCloudConnection: m.cloud }));
vi.mock('../../utils/config', () => ({ isLocalServerEnabled: () => m.localServer.value }));
vi.mock('../../services/ApiKeyManager.ts', async (orig) => ({
  ...(await orig<typeof import('../../services/ApiKeyManager')>()),
  setActiveModel: m.setActiveModel,
  setSpeedOptimizationEnabled: m.setSpeedOptimizationEnabled,
  resetModelToClassicDefault: m.resetModelToClassicDefault,
  isSpeedOptimizationEnabled: () => m.speedOpt.value,
}));
vi.mock('../modals/ShortcutModal', () => ({ ShortcutModal: ({ isOpen }: any) => <div data-shortcut-modal={String(isOpen)} /> }));
vi.mock('./MemoryWidget', () => ({ MemoryWidget: () => <div data-memory-widget /> }));

import { Footer } from './Footer';

const t = { proMode: 'PRO MODE' };
const colors = { primary: 'bg-p', text: 'text-p' };

const setup = async (over: any = {}) => {
  const onKeyUpdate = vi.fn();
  let utils: ReturnType<typeof render>;
  await act(async () => {
    utils = render(<Footer t={t} activeColors={colors} appLang="bn" isDark onKeyUpdate={onKeyUpdate} {...over} />);
  });
  const u = utils!;
  const dropdownToggle = () => u.container.querySelector('.group.relative.px-3') as HTMLElement;
  const infoBtn = (label: string) => u.container.querySelector(`button[aria-label="${label} বাংলা নির্দেশনা"]`) as HTMLElement;
  return { ...u, onKeyUpdate, dropdownToggle, infoBtn };
};

beforeEach(() => {
  vi.clearAllMocks();
  m.localServer.value = false;
  m.speedOpt.value = false;
  m.cloud.mockResolvedValue({ status: 'offline', message: 'No cloud' });
});

describe('Footer markup', () => {
  it('renders default state (servers offline, classic)', async () => {
    expect((await setup()).container.innerHTML).toMatchSnapshot();
  });

  it('renders online state, speed boost, AI loading and light theme', async () => {
    m.localServer.value = true;
    m.speedOpt.value = true;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'online' }) })));
    m.cloud.mockResolvedValue({ status: 'online', message: 'Synced' });
    const { container } = await setup({ isAiLoading: true, isDark: false, activeModelName: 'gemini-3.1-pro-preview' });
    await waitFor(() => expect(container.textContent).toContain('LOCAL DB: ONLINE'));
    expect(container.innerHTML).toMatchSnapshot();
    vi.unstubAllGlobals();
  });

  it('renders auth-error cloud state', async () => {
    m.cloud.mockResolvedValue({ status: 'auth-error', message: 'Not logged in' });
    const { container } = await setup();
    await waitFor(() => expect(container.textContent).toContain('CLOUD: AUTH ERROR'));
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('renders open dropdown with info tooltip and profile popup', async () => {
    const { container, dropdownToggle, infoBtn } = await setup();
    fireEvent.click(dropdownToggle());
    fireEvent.mouseEnter(infoBtn('Gemini 3.8 Flash'));
    fireEvent.mouseEnter(container.querySelector('.relative.group.py-1')!);
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('Footer behavior', () => {
  it('selects a model and closes the dropdown', async () => {
    const { container, dropdownToggle, onKeyUpdate, getByText } = await setup();
    fireEvent.click(dropdownToggle());
    expect(container.innerHTML).toContain('opacity-100 scale-100 pointer-events-auto');
    fireEvent.click(getByText('Gemini 3.5 Flash'));
    expect(m.setActiveModel).toHaveBeenCalledWith('gemini-3.5-flash');
    expect(onKeyUpdate).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).not.toContain('opacity-100 scale-100 pointer-events-auto');
  });

  it('toggles speed boost without closing', async () => {
    const { getByText, onKeyUpdate, dropdownToggle, container } = await setup();
    fireEvent.click(dropdownToggle());
    fireEvent.click(getByText('স্পিড বুস্ট: বন্ধ'));
    expect(m.setSpeedOptimizationEnabled).toHaveBeenCalledWith(true);
    expect(onKeyUpdate).toHaveBeenCalled();
    expect(getByText('⚡ স্পিড বুস্ট: চালু')).toBeTruthy();
    expect(container.textContent).toContain('FAST OPT');
  });

  it('resets to default, shows notice, then closes', async () => {
    m.speedOpt.value = true;
    const { getByText, dropdownToggle, container } = await setup();
    fireEvent.click(dropdownToggle());
    vi.useFakeTimers();
    fireEvent.click(getByText(/রিসেট করুন/));
    expect(m.resetModelToClassicDefault).toHaveBeenCalled();
    expect(container.textContent).toMatch(/✅ পূর্বের ডিফল্ট/);
    expect(container.textContent).toContain('CLASSIC');
    act(() => { vi.advanceTimersByTime(1200); });
    vi.useRealTimers();
    expect(container.textContent).not.toContain('✅');
    expect(container.innerHTML).not.toContain('opacity-100 scale-100 pointer-events-auto');
  });

  it('closes dropdown on outside mousedown', async () => {
    const { dropdownToggle, container } = await setup();
    fireEvent.click(dropdownToggle());
    fireEvent.mouseDown(document.body);
    expect(container.innerHTML).not.toContain('opacity-100 scale-100 pointer-events-auto');
  });

  it('toggles and clears the info tooltip', async () => {
    const { infoBtn, container } = await setup();
    const btn = infoBtn('Gemini 3.1 Pro Preview');
    fireEvent.click(btn);
    expect(container.textContent).toContain('⚙️ কীভাবে কাজ করে:');
    fireEvent.click(btn);
    expect(container.textContent).not.toContain('⚙️ কীভাবে কাজ করে:');
    fireEvent.mouseEnter(btn);
    fireEvent.mouseLeave(btn);
    expect(container.textContent).not.toContain('⚙️ কীভাবে কাজ করে:');
  });

  it('opens the shortcut modal', async () => {
    const { container, getByTitle } = await setup();
    fireEvent.click(getByTitle('Keyboard Shortcuts'));
    expect(container.querySelector('[data-shortcut-modal="true"]')).toBeTruthy();
  });

  it('marks local server offline on failed fetch and re-checks every 60s', async () => {
    m.localServer.value = true;
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    vi.useFakeTimers();
    const { container } = await setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(container.textContent).toContain('LOCAL DB: OFFLINE');
    expect(m.cloud).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(m.cloud).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
