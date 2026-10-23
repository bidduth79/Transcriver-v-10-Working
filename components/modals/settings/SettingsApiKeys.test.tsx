import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const m = vi.hoisted(() => ({
  keys: [] as any[], active: { value: null as string | null }, model: { value: 'gemini-3.8-flash' },
  add: vi.fn(), del: vi.fn(), setActive: vi.fn(), setModel: vi.fn(),
}));
vi.mock('../../../services/ApiKeyManager', async (orig) => ({
  ...(await orig<typeof import('../../../services/ApiKeyManager')>()),
  getAllApiKeys: vi.fn(async () => m.keys),
  getActiveKeyId: () => m.active.value,
  getActiveModel: () => m.model.value,
  addUserApiKey: m.add,
  deleteApiKey: m.del,
  setActiveApiKey: m.setActive,
  setActiveModel: m.setModel,
}));

import { SettingsApiKeys } from './SettingsApiKeys';
import { useAppStore } from '@/hooks/useAppStore';

const sample = [
  { id: 'k1', key: 'AIzaSyAAAAAAAA11111111', label: 'Office', addedAt: '2026-01-01' },
  { id: 'k2', key: 'AIzaSyBBBBBBBB22222222', label: 'Home', addedAt: '2026-01-02' },
  null,
];
const renderIt = async (over: any = {}) => {
  const props = { isDark: true, activeColors: { primary: 'bg-p' }, appLang: 'bn' as const, addToast: vi.fn(), ...over };
  let u: any;
  await act(async () => { u = render(<SettingsApiKeys {...props} />); });
  return { ...(u as ReturnType<typeof render>), props };
};
const nfc = (s: string) => s.normalize('NFC');
const toasts = (p: any) => p.addToast.mock.calls.map((c: any[]) => `${c[1]}:${nfc(c[0])}`);
const inputs = (c: HTMLElement) => c.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

beforeEach(() => {
  vi.clearAllMocks();
  m.keys = sample; m.active.value = 'k2'; m.model.value = 'gemini-3.8-flash';
  m.add.mockImplementation(async (key: string, label: string) => { m.keys = [...m.keys, { id: 'k3', key, label, addedAt: 'x' }]; m.active.value = 'k3'; });
  m.del.mockImplementation(async (id: string) => { m.keys = m.keys.filter(k => k?.id !== id); });
  m.setModel.mockImplementation((id: string) => { m.model.value = id; });
});

describe('SettingsApiKeys markup', () => {
  it('renders keys with the active one (dark, bn)', async () => {
    expect((await renderIt()).container.innerHTML).toMatchSnapshot();
  });
  it('renders the empty state (light, en)', async () => {
    m.keys = [];
    expect((await renderIt({ isDark: false, appLang: 'en' })).container.innerHTML).toMatchSnapshot();
  });
});

describe('SettingsApiKeys behavior', () => {
  it('validates, adds a key with a default label and refreshes', async () => {
    const { container, props, getByText } = await renderIt();
    const addBtn = getByText(nfc('যুক্ত করুন')) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
    fireEvent.change(inputs(container)[0], { target: { value: '   ' } });
    await act(async () => { fireEvent.click(addBtn); });
    expect(toasts(props)).toEqual([nfc('error:দয়া করে এপিআই কি দিন')]);
    fireEvent.change(inputs(container)[0], { target: { value: 'AIzaNEWKEY0000999' } });
    await act(async () => { fireEvent.click(addBtn); });
    expect(m.add).toHaveBeenCalledWith('AIzaNEWKEY0000999', 'Key 3');
    expect(inputs(container)[0].value).toBe('');
    expect(container.textContent).toContain('****Y0000999');
    expect(toasts(props).at(-1)).toBe(nfc('success:নতুন কি যুক্ত এবং সক্রিয় (Active) করা হয়েছে'));
  });

  it('uses the given label and reports add failures', async () => {
    m.add.mockRejectedValueOnce(new Error('x'));
    const { container, props, getByText } = await renderIt({ appLang: 'en' });
    fireEvent.change(inputs(container)[0], { target: { value: 'AIzaX' } });
    fireEvent.change(inputs(container)[1], { target: { value: 'Mine' } });
    await act(async () => { fireEvent.click(getByText('ADD')); });
    expect(m.add).toHaveBeenCalledWith('AIzaX', 'Mine');
    expect(toasts(props)).toEqual(['error:Failed to add key']);
  });

  it('selects a key, deletes after confirmation and changes model', async () => {
    const { container, props, getByText } = await renderIt();
    await act(async () => { fireEvent.click(container.querySelector('.space-y-3 > div .rounded-full.cursor-pointer')!); });
    expect(m.setActive).toHaveBeenCalledWith('k1');
    expect(container.querySelectorAll('.space-y-3 > div')[0].textContent).toContain('Active');
    fireEvent.click(container.querySelectorAll('button[title="Delete Key"]')[1]);
    await act(async () => { fireEvent.click(getByText(nfc('ডিলিট করুন'))); });
    expect(m.del).toHaveBeenCalledWith('k2');
    expect(container.textContent).not.toContain('Home');
    const select = container.querySelector('select') as HTMLSelectElement;
    const trigger = vi.spyOn(useAppStore.getState(), 'triggerActiveApiKeyChanged');
    await act(async () => { fireEvent.change(select, { target: { value: 'gemini-3.1-pro-preview' } }); });
    expect(m.setModel).toHaveBeenCalledWith('gemini-3.1-pro-preview');
    expect(select.value).toBe('gemini-3.1-pro-preview');
    expect(toasts(props).slice(-1)[0]).toBe(nfc('success:মডেল পরিবর্তন হয়েছে: gemini-3.1-pro-preview'));
    expect(toasts(props)).toContain(nfc('success:এপিআই কি সিলেক্ট করা হয়েছে'));
    expect(toasts(props)).toContain(nfc('warning:কি ডিলিট করা হয়েছে'));
    trigger.mockRestore();
  });

  it('refreshes keys and model on store events', async () => {
    const { container } = await renderIt();
    m.keys = [{ id: 'z', key: 'K', label: 'Zed', addedAt: '' }];
    m.model.value = 'gemini-3.5-flash';
    await act(async () => { useAppStore.getState().triggerStoreUpdate('user_api_keys'); });
    expect(container.textContent).toContain('Zed');
    expect((container.querySelector('select') as HTMLSelectElement).value).toBe('gemini-3.5-flash');
  });
});
