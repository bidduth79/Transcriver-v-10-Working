import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock('../../../services/apiKeys/keyCheck', () => ({ checkKey: m.check }));
vi.mock('../../../services/apiKeys/envKeys', () => ({ listEnvKeys: async () => [{ id: 'env-1', label: 'Office', token: 'env:env-1:gXeQ' }] }));

import { KeyCheckButton } from './KeyCheckButton';

afterEach(() => { cleanup(); m.check.mockReset(); });

const keys = [{ id: 'a', key: 'AIza-Dva0', label: 'রাকিব', addedAt: '' }, { id: 'b', key: 'AIza-AHeQ', label: 'old', addedAt: '' }];

describe('KeyCheckButton', () => {
  it('tests every saved and .env key one after another, and says how many work', async () => {
    m.check.mockImplementation(async (key: string) => ({ status: key.endsWith('AHeQ') ? 'invalid' : 'ok' }));
    const addToast = vi.fn();
    const { getByText } = render(<KeyCheckButton keyList={keys} selectedModel="gemini-3.5-flash" isDark={false} appLang="en" addToast={addToast} />);
    expect(getByText(/one tiny question on Gemini 3.5 Flash/)).toBeTruthy();
    fireEvent.click(getByText('Test all keys'));
    await waitFor(() => expect(addToast).toHaveBeenCalledWith('2 of 3 key(s) work', 'warning'));
    expect(m.check.mock.calls).toEqual([['AIza-Dva0', 'gemini-3.5-flash'], ['AIza-AHeQ', 'gemini-3.5-flash'], ['env:env-1:gXeQ', 'gemini-3.5-flash']]);
  });

  it('asks the default model when the transcribe model (audio only) is chosen', async () => {
    m.check.mockResolvedValue({ status: 'ok' });
    const addToast = vi.fn();
    const { getByText } = render(<KeyCheckButton keyList={[]} selectedModel="gemini-3.5-transcribe" isDark appLang="bn" addToast={addToast} />);
    fireEvent.click(getByText('সব key পরীক্ষা করুন'));
    await waitFor(() => expect(addToast).toHaveBeenCalledWith('1টি key-এর মধ্যে 1টি কাজ করছে', 'success'));
    expect(m.check).toHaveBeenCalledWith('env:env-1:gXeQ', 'gemini-3.8-flash');
  });
});
