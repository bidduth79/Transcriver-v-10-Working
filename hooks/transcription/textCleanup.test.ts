import { describe, it, expect } from 'vitest';
import { splitLongParagraphs } from './textCleanup';
import { buildSrtBlob } from '../../components/common/download/exportContent';

// A sentence of about 100 characters
const sentence = (n: number) => `এটি পরীক্ষার জন্য লেখা ${n} নম্বর বাক্য, যেখানে বক্তা একটানা অনেকক্ষণ ধরে কথা বলে যাচ্ছেন।`;

describe('splitLongParagraphs', () => {
  it('splits one huge paragraph after sentence ends, losing and changing no word', () => {
    const body = Array.from({ length: 30 }, (_, i) => sentence(i + 1)).join(' ');
    const text = `[00:00] **Speaker 1:** ${body}\n[05:10] **Speaker 2:** ছোট উত্তর।`;
    const out = splitLongParagraphs(text);
    const pieces = out.split('\n').filter(Boolean);
    expect(pieces.length).toBeGreaterThan(4);
    expect(pieces[0].startsWith('[00:00] **Speaker 1:**')).toBe(true);
    expect(pieces.slice(1, -1).every(p => !p.startsWith('['))).toBe(true);
    expect(pieces.every(p => p.length <= 900)).toBe(true);
    expect(pieces[pieces.length - 1]).toBe('[05:10] **Speaker 2:** ছোট উত্তর।');
    expect(out.replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '));
  });

  it('leaves normal paragraphs and text without sentence ends alone', () => {
    const normal = `[00:00] **Speaker 1:** ${sentence(1)}\n[00:40] **Speaker 1:** ${sentence(2)}`;
    expect(splitLongParagraphs(normal)).toBe(normal);
    const noEnds = 'ক'.repeat(2000);
    expect(splitLongParagraphs(noEnds)).toBe(noEnds);
  });
});

describe('SRT export', () => {
  it('adds a paragraph without its own time to the subtitle before it', async () => {
    const srt = await buildSrtBlob('[00:10] **Speaker 1:** প্রথম।\n\nদ্বিতীয়।\n[00:30] **Speaker 2:** তৃতীয়।').text();
    expect(srt).toBe('1\n00:00:10,000 --> 00:00:15,000\nপ্রথম। দ্বিতীয়।\n\n2\n00:00:30,000 --> 00:00:35,000\nতৃতীয়।\n\n');
  });

  it('keeps one subtitle per line when the transcript has no times at all', async () => {
    const srt = await buildSrtBlob('এক।\nদুই।').text();
    expect(srt.match(/-->/g)).toHaveLength(2);
  });
});
