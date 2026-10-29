import { describe, it, expect } from 'vitest';
import { withoutAds, readAdMarker } from './adBlocks';
import { AD_START, AD_END } from '../constants/instructions';

const transcript = [
  '[15:20] **Host:** before the break',
  `[15:32] ${AD_START}`,
  '[16:01] **Woman 1:** advert words',
  `[17:10] ${AD_END}`,
  '[17:12] **Host:** welcome back',
].join('\n');

describe('adBlocks', () => {
  it('reads a marker line', () => {
    expect(readAdMarker(`[15:32] ${AD_START}`)).toEqual({ marker: 'start', rest: '' });
    expect(readAdMarker(`[17:10] ${AD_END} [17:12] **Host:** back`)).toEqual({ marker: 'end', rest: '[17:12] **Host:** back' });
    expect(readAdMarker('[17:12] **Host:** back')).toEqual({ marker: null, rest: '[17:12] **Host:** back' });
  });

  it('leaves the advertisement out and keeps the programme', () => {
    expect(withoutAds(transcript)).toBe('[15:20] **Host:** before the break\n[17:12] **Host:** welcome back');
    expect(withoutAds(`${AD_START}\nadvert\n${AD_END} back again`)).toBe('back again');
    expect(withoutAds(`a\n${AD_START}\nadvert never closed`)).toBe('a');
    expect(withoutAds('no adverts here')).toBe('no adverts here');
  });
});
