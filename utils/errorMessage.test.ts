import { describe, it, expect } from 'vitest';
import { messageOf, codeOf } from './errorMessage';

describe('messageOf / codeOf', () => {
  it('reads message and code like optional chaining would', () => {
    expect(messageOf(new Error('boom'))).toBe('boom');
    expect(messageOf({ message: 'sdk' })).toBe('sdk');
    expect(messageOf('text')).toBeUndefined();
    expect(messageOf(null)).toBeUndefined();
    expect(messageOf(undefined)).toBeUndefined();
    expect(codeOf({ code: 'permission-denied' })).toBe('permission-denied');
    expect(codeOf(new Error('x'))).toBeUndefined();
  });
});
