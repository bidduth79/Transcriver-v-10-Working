import { describe, it, expect, afterEach } from 'vitest';
import { useThemeStore, currentAppLang } from './useThemeStore';

afterEach(() => useThemeStore.getState().setAppLang('bn'));

describe('interface language', () => {
  it('sets the page language with it, and code outside React can read it', () => {
    expect(document.documentElement.lang).toBe('bn');
    useThemeStore.getState().setAppLang('en');
    expect(document.documentElement.lang).toBe('en');
    expect(currentAppLang()).toBe('en');
    expect(localStorage.getItem('app-lang')).toBe('en');
  });
});
