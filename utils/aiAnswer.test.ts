import { describe, it, expect } from 'vitest';
import { buildSearchContext, parseJsonAnswer } from './aiAnswer';

describe('buildSearchContext', () => {
  it('sends the parts around each match, even far into a long transcript', () => {
    const transcript = 'a'.repeat(20000) + ' border patrol ' + 'b'.repeat(3000) + ' BORDER again ' + 'c'.repeat(20000);
    const ctx = buildSearchContext(transcript, 'Border', 12000, 100);
    expect(ctx).toContain('border patrol');
    expect(ctx).toContain('BORDER again');
    expect(ctx).toContain(' … ');
    expect(ctx.length).toBeLessThan(500);
  });

  it('merges close matches, respects the size limit, and falls back to the start', () => {
    expect(buildSearchContext('x border y border z', 'border', 100, 3)).toBe('x border y border z');
    const many = Array.from({ length: 200 }, (_, i) => `${'.'.repeat(300)} term${i} `).join('');
    expect(buildSearchContext(many, 'term', 2000, 50).length).toBeLessThanOrEqual(2000);
    expect(buildSearchContext('no match here', 'absent', 5)).toBe('no ma');
  });
});

describe('parseJsonAnswer', () => {
  it('reads plain or fenced JSON objects and rejects anything else', () => {
    expect(parseJsonAnswer('{"sentiment":"Positive"}')).toEqual({ sentiment: 'Positive' });
    expect(parseJsonAnswer('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonAnswer('SENTIMENT: Positive')).toBeNull();
    expect(parseJsonAnswer('[1,2]')).toBeNull();
  });
});
