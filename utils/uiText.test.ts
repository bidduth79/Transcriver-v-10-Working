import { describe, it, expect } from 'vitest';
import en from '../locales/ui/en.json';
import bn from '../locales/ui/bn.json';
import { uiText } from './uiText';

describe('uiText', () => {
  it('has every text in both languages, none empty', () => {
    expect(Object.keys(bn).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of [...Object.entries(en), ...Object.entries(bn)]) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('gives Bengali only for bn, English otherwise', () => {
    const key = Object.keys(en)[0] as keyof typeof en;
    expect(uiText('bn', key)).toBe(bn[key]);
    expect(uiText('en', key)).toBe(en[key]);
    expect(uiText('fr', key)).toBe(en[key]);
  });

  it('fills {name} placeholders the way a template literal printed them', () => {
    expect(uiText('en', 'etaMinutesSeconds', { minutes: 2, seconds: 5 })).toBe('~2m 5s');
    expect(uiText('en', 'batchCompletedWithFailures', { prevProcessed: 7, failed: 0 })).toBe('Batch completed. 7 succeeded, 0 failed.');
    expect(uiText('en', 'fileTooLargeSkipping', { name: undefined })).toBe('undefined exceeds 70MB, skipping');
    expect(uiText('en', 'fileTooLargeSkipping')).toBe('{name} exceeds 70MB, skipping');
  });

  it('uses the same placeholders in both languages', () => {
    const names = (text: string) => (text.match(/\{\w+\}/g) || []).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(names(bn[key]), key).toEqual(names(en[key]));
    }
  });
});
