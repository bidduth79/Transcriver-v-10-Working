import { describe, it, expect } from 'vitest';
import { joinSpeakerParagraphs } from './speakerParagraphs';

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const line = (s: number, who: string, words: string) => `[${clock(s)}] **${who}:** ${words}`;

describe('joinSpeakerParagraphs', () => {
  it('joins one speaker\'s lines into paragraphs of about five sentences, each with the time of its first line', () => {
    const lines = Array.from({ length: 12 }, (_, i) => line(i * 10, 'ড. হক', `বাক্য ${i + 1}।`));
    expect(joinSpeakerParagraphs(lines.join('\n')).split('\n')).toEqual([
      '[00:00] **ড. হক:** বাক্য 1। বাক্য 2। বাক্য 3। বাক্য 4। বাক্য 5।',
      '[00:50] **ড. হক:** বাক্য 6। বাক্য 7। বাক্য 8। বাক্য 9। বাক্য 10।',
      '[01:40] **ড. হক:** বাক্য 11। বাক্য 12।',
    ]);
  });

  it('starts a new paragraph when the speaker changes, or after a long silence', () => {
    const text = [line(0, 'Speaker 1', 'প্রশ্ন?'), line(5, 'Speaker 2', 'উত্তর।'), line(9, 'Speaker 2', 'আরও কথা।'),
      line(200, 'Speaker 2', 'বিরতির পরে।'), line(204, 'Speaker 1', 'ধন্যবাদ।')].join('\n');
    expect(joinSpeakerParagraphs(text).split('\n')).toEqual([
      '[00:00] **Speaker 1:** প্রশ্ন?',
      '[00:05] **Speaker 2:** উত্তর। আরও কথা।',
      '[03:20] **Speaker 2:** বিরতির পরে।',
      '[03:24] **Speaker 1:** ধন্যবাদ।',
    ]);
  });

  it('joins a line without its own time to the paragraph above while it has room, and bounds lines without punctuation by length', () => {
    expect(joinSpeakerParagraphs(`${line(0, 'Speaker 1', 'শুরু।')}\nএকই কথার বাকি অংশ।`)).toBe('[00:00] **Speaker 1:** শুরু। একই কথার বাকি অংশ।');
    // The pieces of one very long speech (split for reading) become paragraphs of five sentences again
    const pieces = [line(0, 'Speaker 1', 'এক। দুই। তিন।'), 'চার। পাঁচ। ছয়।', 'সাত। আট।', 'নয়। দশ। এগারো।'].join('\n');
    expect(joinSpeakerParagraphs(pieces).split('\n')).toEqual(['[00:00] **Speaker 1:** এক। দুই। তিন। চার। পাঁচ। ছয়।', 'সাত। আট। নয়। দশ। এগারো।']);
    const verbatim = Array.from({ length: 6 }, (_, i) => line(i * 20, 'Speaker 1', 'ক'.repeat(300))).join('\n');
    const joined = joinSpeakerParagraphs(verbatim).split('\n');
    expect(joined).toHaveLength(3);
    expect(joined.every(p => p.length <= 900)).toBe(true);
  });

  it('leaves a transcript without timed speaker lines (Normal mode) as it is, and loses no word', () => {
    const plain = 'প্রথম অনুচ্ছেদ।\n\nদ্বিতীয় অনুচ্ছেদ।';
    expect(joinSpeakerParagraphs(plain)).toBe(plain);
    const talk = [line(0, 'A', 'এক।'), line(3, 'A', 'দুই।'), line(6, 'B', 'তিন।')].join('\n');
    expect(joinSpeakerParagraphs(talk).replace(/\[[^\]]*\]|\*\*[^*]*\*\*|\s/g, '')).toBe(talk.replace(/\[[^\]]*\]|\*\*[^*]*\*\*|\s/g, ''));
  });
});
