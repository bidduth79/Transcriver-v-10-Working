import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({
  keys: [{ id: 'env-1', label: 'Office', token: 'env:env-1:AB12' }],
  reload: vi.fn(),
  test: vi.fn(),
}));
vi.mock('../../../services/apiKeys/envKeys', () => ({
  listEnvKeys: async () => m.keys,
  reloadEnvKeys: m.reload,
  testEnvKey: m.test,
}));

import { EnvKeyList } from './EnvKeyList';

afterEach(cleanup);

const setup = () => {
  const props = { activeKeyId: 'env-1', isDark: false, appLang: 'en', addToast: vi.fn(), onSelect: vi.fn() };
  return { ...render(<EnvKeyList {...props} />), props };
};

describe('EnvKeyList', () => {
  it('shows the .env keys by name and last four characters only, and selects one', async () => {
    const { findByText, container, props } = setup();
    expect(await findByText('Office')).toBeTruthy();
    expect(container.textContent).toContain('****AB12');
    expect(container.textContent).toContain('0 request(s) today');
    fireEvent.click(container.querySelector('button.rounded-full')!);
    expect(props.onSelect).toHaveBeenCalledWith('env-1');
  });

  it('reads .env again and tests a key, telling the result', async () => {
    m.reload.mockResolvedValue([...m.keys, { id: 'env-2', label: 'Home', token: 'env:env-2:CD34' }]);
    m.test.mockResolvedValue({ ok: false, message: 'API key not valid' });
    const { findByText, getByText, getAllByText, props } = setup();
    await findByText('Office');
    fireEvent.click(getByText('Reload .env'));
    expect(await findByText('Home')).toBeTruthy();
    expect(props.addToast).toHaveBeenCalledWith('2 key(s) found in .env', 'success');
    fireEvent.click(getAllByText('Test')[0]);
    await waitFor(() => expect(props.addToast).toHaveBeenCalledWith('Office: the key does not work. API key not valid', 'error'));
    expect(m.test).toHaveBeenCalledWith('env:env-1:AB12');
  });
});
