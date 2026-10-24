import { describe, it, expect } from 'vitest';
import { pullFailureOf, PULL_FAILURE_TEXT } from './pullFailure';
import { uiText } from '../../utils/uiText';

describe('pullFailureOf', () => {
  it('recognises a used-up daily quota by code or by message', () => {
    expect(pullFailureOf({ code: 'resource-exhausted', message: 'x' })).toBe('quota');
    expect(pullFailureOf(new Error('Request failed with error: Quota exceeded.'))).toBe('quota');
  });

  it('treats anything else as a plain failure', () => {
    expect(pullFailureOf({ code: 'permission-denied', message: 'Missing permissions' })).toBe('failed');
    expect(pullFailureOf(undefined)).toBe('failed');
  });

  it('has a message in both languages for each failure', () => {
    for (const key of Object.values(PULL_FAILURE_TEXT)) {
      expect(uiText('en', key)).not.toBe('');
      expect(uiText('bn', key)).not.toBe('');
    }
  });
});
