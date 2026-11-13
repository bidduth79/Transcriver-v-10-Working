import { describe, it, expect } from 'vitest';
import { withoutAds, markAdBreaks } from './adBlocks';
import { AD_START, AD_END } from '../constants/instructions';

const transcript = [
  '[15:20] **Host:** before the break',
  `[15:32] ${AD_START}`,
  '[16:01] **Woman 1:** advert words',
  `[17:10] ${AD_END}`,
  '[17:12] **Host:** welcome back',
].join('\n');

describe('adBlocks', () => {
  it('leaves a real advertisement break out and keeps the programme', () => {
    expect(withoutAds(transcript)).toBe('[15:20] **Host:** before the break\n[17:12] **Host:** welcome back');
    expect(withoutAds(`${AD_START}\nadvert\n${AD_END} back again`)).toBe('back again');
    expect(withoutAds('no adverts here')).toBe('no adverts here');
  });

  it('gives the fold line, the folded words and the time span of each break', () => {
    expect(markAdBreaks(transcript.split('\n'))).toEqual({
      entries: [
        { kind: 'text', text: '[15:20] **Host:** before the break', block: null },
        { kind: 'fold', block: 0 },
        { kind: 'text', text: '[16:01] **Woman 1:** advert words', block: 0 },
        { kind: 'text', text: '[17:12] **Host:** welcome back', block: null },
      ],
      ranges: [{ from: '[15:32]', to: '[17:10]' }],
    });
  });

  it('keeps the words of a block that is never closed in the programme', () => {
    expect(withoutAds(`a\n[24:46] ${AD_START}\n[25:56] **Host:** we are back after the break`)).toBe('a\n[25:56] **Host:** we are back after the break');
  });

  it('keeps a block longer than an advertisement break in the programme, by its times or by its length', () => {
    const tooLong = `[10:00] ${AD_START}\n[10:30] **Host:** we are back\n[17:00] ${AD_END}\n[17:05] **Host:** next`;
    expect(withoutAds(tooLong)).toBe('[10:30] **Host:** we are back\n[17:05] **Host:** next');
    const tooMuch = `${AD_START}\n${'talk '.repeat(700)}\n${AD_END}`;
    // A line without marks is kept exactly as written
    expect(withoutAds(tooMuch)).toBe('talk '.repeat(700));
  });

  it('keeps text before a start mark and after an end mark on the same line in the programme', () => {
    const line = `[05:00] **Host:** we take a short break ${AD_START} buy soap ${AD_END} [06:10] **Host:** back`;
    expect(withoutAds(line)).toBe('[05:00] **Host:** we take a short break\n[06:10] **Host:** back');
  });

  it('ends a block left open when the next one starts', () => {
    const text = `[01:00] ${AD_START}\n[01:10] **Ad 1:** soap\n[02:00] ${AD_START}\n[02:10] **Ad 2:** tea\n[03:00] ${AD_END}\n[03:05] **Host:** back`;
    expect(markAdBreaks(text.split('\n')).ranges).toEqual([{ from: '[01:00]', to: '[02:00]' }, { from: '[02:00]', to: '[03:00]' }]);
    expect(withoutAds(text)).toBe('[03:05] **Host:** back');
  });
});
