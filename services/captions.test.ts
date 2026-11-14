import { describe, it, expect } from 'vitest';
import { attachCaptions, captionOf, captionLetters } from './captions';

const caption = '﻿“যার সঙ্গে কথা হয়” । মাসুদ কামাল | অন্য মঞ্চ\nOnno Moncho\nhttps://www.youtube.com/watch?v=x\n\n[০০:০০] আসসালামু আলাইকুম\n[০০:০৩] মঞ্চের আলোচনায়';

describe('captions', () => {
  it('counts the Bengali letters of the timed lines only, not the title header', () => {
    expect(captionLetters(caption)).toBe((('আসসালামু আলাইকুম' + 'মঞ্চের আলোচনায়').match(/[ঀ-৿]/g) || []).length);
  });

  it('finds the captions of each recording in the same folder, by the same name with .txt', async () => {
    const talk = new File(['audio'], 'Talk show_2026-11-12.opus');
    const other = new File(['audio'], 'Other_2026-11-12.opus');
    const folder = [talk, other, new File([caption], 'Talk show_2026-11-12.txt'), new File(['x'], 'notes.txt')];
    await attachCaptions([talk, other], folder);
    // (reading a file drops the byte-order mark at its start)
    expect(captionOf(talk)).toBe(caption.replace('﻿', ''));
    expect(captionOf(other)).toBeNull();
  });
});
