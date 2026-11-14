import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('../../services/apiKeys/geminiClient', () => ({ createGeminiClient: async () => ({ models: { generateContent: m.generate } }) }));
vi.mock('../../services/ApiKeyManager', () => ({ getModelDefinition: () => ({ category: 'balanced' }), isSpeedOptimizationEnabled: () => false }));

import { fixPunctuation, bengaliDigits, acceptedLine } from './punctuationFix';
import { PUNCTUATION_SYSTEM_INSTRUCTION } from '../../constants/instructions';

const answer = (lines: string[]) => ({ candidates: [{ content: { parts: [{ text: lines.join('\n') }] } }] });

beforeEach(() => m.generate.mockReset());

describe('fixPunctuation', () => {
  it('takes only punctuation from Gemini, keeping each line\'s time and speaker byte for byte', async () => {
    const transcript = '[00:00] **ড. হক:** আমি বলছি এটা ঠিক না তাই না\n\n[00:20] **Speaker 2:** জি';
    m.generate.mockResolvedValue(answer(['[00:00] **ড. হক:**  আমি বলছি, এটা ঠিক না, তাই না?', '[00:20] **Speaker 2:** জি।']));
    const result = await fixPunctuation(transcript, 'KEY', 'gemini-3.5-flash');
    expect(result).toEqual({
      text: '[00:00] **ড. হক:** আমি বলছি, এটা ঠিক না, তাই না?\n\n[00:20] **Speaker 2:** জি।',
      changedLines: 2, keptLines: 0, requests: 1,
    });
    const [request] = m.generate.mock.calls[0];
    expect(request.model).toBe('gemini-3.5-flash');
    expect(request.config.systemInstruction).toBe(PUNCTUATION_SYSTEM_INSTRUCTION);
    expect(request.contents).toBe('[00:00] **ড. হক:** আমি বলছি এটা ঠিক না তাই না\n[00:20] **Speaker 2:** জি');
  });

  it('keeps a line whose words, time or speaker Gemini changed, and a whole chunk whose lines do not pair up', async () => {
    const transcript = '[00:00] **A:** এক দুই\n[00:05] **B:** তিন চার\n[00:09] **A:** পাঁচ';
    m.generate.mockResolvedValueOnce(answer(['[00:00] **A:** এক, দুই।', '[00:05] **B:** তিন চার পাঁচ।', '[00:10] **A:** পাঁচ।']));
    expect(await fixPunctuation(transcript, 'KEY', 'm')).toMatchObject({
      text: '[00:00] **A:** এক, দুই।\n[00:05] **B:** তিন চার\n[00:09] **A:** পাঁচ', changedLines: 1, keptLines: 2,
    });
    m.generate.mockResolvedValueOnce(answer(['[00:00] **A:** এক, দুই।']));
    expect(await fixPunctuation(transcript, 'KEY', 'm')).toMatchObject({ text: transcript, changedLines: 0, keptLines: 3 });
  });

  it('sends a long transcript in several requests', async () => {
    const lines = Array.from({ length: 40 }, (_, i) => `[${String(i).padStart(2, '0')}:00] **A:** ${'কথা '.repeat(150).trim()}`);
    m.generate.mockImplementation(async (request?: { contents?: string }) => answer((request?.contents ?? '').split('\n')));
    const result = await fixPunctuation(lines.join('\n'), 'KEY', 'm');
    expect(m.generate.mock.calls.map(call => typeof call[0])).toEqual(['object', 'object']);
    expect(result.requests).toBe(2);
    expect(result.text).toBe(lines.join('\n'));
  });
});

describe('bengaliDigits and acceptedLine', () => {
  it('turns digits in the words Bengali, never the times or bracketed marks', () => {
    expect(bengaliDigits('[12:30] **A:** 19 বছরের 5% [অস্পষ্ট] ২০২৪')).toBe('[12:30] **A:** ১৯ বছরের ৫% [অস্পষ্ট] ২০২৪');
  });

  it('accepts a line only when its letters and digits are the same, in order', () => {
    expect(acceptedLine('[01:00] **A:** ১৯ বছর', '[01:00] **A:** 19 বছর।')).toBe('[01:00] **A:** 19 বছর।');
    expect(acceptedLine('[01:00] **A:** বছর তিন', '[01:00] **A:** তিন বছর।')).toBeNull();
    expect(acceptedLine('কোনো সময় নেই', 'কোনো সময় নেই।')).toBe('কোনো সময় নেই।');
    expect(acceptedLine('এক', undefined)).toBeNull();
  });
});
