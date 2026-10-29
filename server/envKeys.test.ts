import { describe, it, expect } from 'vitest';
import { collectEnvKeys } from './envKeys';

describe('collectEnvKeys', () => {
  it('reads numbered keys in order with their labels, then the older names, each key once', () => {
    const keys = collectEnvKeys({
      GEMINI_API_KEY_10: 'K10',
      GEMINI_API_KEY_2: ' K2 ',
      GEMINI_API_KEY_2_LABEL: 'Office',
      GEMINI_API_KEY_3: '',
      VITE_API_KEY_1: 'OLD',
      GEMINI_API_KEY: 'K2',
    });
    expect(keys).toEqual([
      { id: 'env-2', label: 'Office', key: 'K2' },
      { id: 'env-10', label: '.env 10', key: 'K10' },
      { id: 'env-vite_api_key_1', label: 'VITE_API_KEY_1', key: 'OLD' },
    ]);
  });
});
