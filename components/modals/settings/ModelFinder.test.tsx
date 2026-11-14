import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({ list: vi.fn(), check: vi.fn() }));
vi.mock('../../../services/apiKeys/modelCatalog', () => ({ listGoogleModels: m.list }));
vi.mock('../../../services/apiKeys/keyCheck', () => ({ checkKey: m.check }));
vi.mock('../../../services/ApiKeyManager', () => ({ getActiveProvider: async () => ({ key: 'env:env-1:gXeQ', source: 'Office' }) }));

import { ModelFinder } from './ModelFinder';
import { readCustomModels } from '../../../services/apiKeys/customModels';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); m.list.mockReset(); m.check.mockReset(); });

describe('ModelFinder', () => {
  it('shows only the models the app lacks, tests one with the active key, adds it and removes it again', async () => {
    m.list.mockResolvedValue([
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen' },
      { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon' },
    ]);
    m.check.mockResolvedValue({ status: 'ok' });
    const addToast = vi.fn();
    const { getByText, queryByText, getAllByText } = render(<ModelFinder isDark={false} appLang="en" addToast={addToast} />);
    fireEvent.click(getByText('Find new models'));
    await waitFor(() => expect(getByText('Gemini 4 Carbon')).toBeTruthy());
    // Models the app already offers (built in, like Gemini 3.5 Flash and Gemini 4 Hydrogen) are not shown
    expect(queryByText('Gemini 3.5 Flash')).toBeNull();
    expect(queryByText('Gemini 4 Hydrogen')).toBeNull();
    expect(m.list).toHaveBeenCalledWith('env:env-1:gXeQ');

    fireEvent.click(getByText('Test'));
    await waitFor(() => expect(getByText('✓ works with your key')).toBeTruthy());
    expect(m.check).toHaveBeenCalledWith('env:env-1:gXeQ', 'gemini-4-carbon');

    fireEvent.click(getByText('Add'));
    expect(readCustomModels()).toEqual([{ id: 'gemini-4-carbon', label: 'Gemini 4 Carbon' }]);
    expect(addToast).toHaveBeenCalledWith('Gemini 4 Carbon was added: it is in the model lists now', 'success');
    await waitFor(() => expect(getByText('Models you added')).toBeTruthy());

    fireEvent.click(getAllByText('Remove')[0]);
    expect(readCustomModels()).toEqual([]);
  });

  it('says so when there is nothing new, and when the list cannot be read', async () => {
    m.list.mockResolvedValueOnce([{ id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' }]).mockRejectedValueOnce(new Error('API key not valid'));
    const addToast = vi.fn();
    const { getByText } = render(<ModelFinder isDark appLang="bn" addToast={addToast} />);
    fireEvent.click(getByText('নতুন মডেল খুঁজুন'));
    await waitFor(() => expect(getByText('অ্যাপে নেই এমন কোনো মডেল পাওয়া যায়নি')).toBeTruthy());
    fireEvent.click(getByText('নতুন মডেল খুঁজুন'));
    await waitFor(() => expect(addToast).toHaveBeenCalledWith('মডেলের তালিকা আনা যায়নি: API key not valid', 'error'));
  });
});
