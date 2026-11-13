import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/ApiKeyManager', () => ({
  getModelDefinition: () => ({ category: 'fast' }),
  isSpeedOptimizationEnabled: () => false,
}));

import { buildTranscriptionRequest, extractResponseText, transcriptionTimeoutMs } from './geminiRequest';
import {
  TRANSCRIPTION_SYSTEM_INSTRUCTION, TRANSCRIPTION_PROMPT_TEXT, CONTINUATION_SYSTEM_INSTRUCTION, TRANSCRIPTION_SYSTEM_INSTRUCTION_NORMAL,
  TRANSCRIPTION_PROMPT_TEXT_NORMAL, continuationPrompt, UNCLEAR_MARK, NO_MORE_SPEECH,
} from '../../constants/instructions';

const audio = { inlineData: { mimeType: 'audio/wav', data: 'AAA' } };

// The fields these tests look at, read without the SDK's wide union types
interface RequestView {
  config: { systemInstruction?: unknown; safetySettings: unknown[]; temperature?: number; httpOptions: { extraBody: { generationConfig: { audioTranscriptionConfig: unknown } } } };
  contents: { parts: unknown[] }[];
}
const view = (request: unknown) => request as RequestView;

describe('Gemini transcription requests', () => {
  it('sends the instructions as a system instruction to normal models', () => {
    const req = view(buildTranscriptionRequest('gemini-3.8-flash', 'pro', audio));
    expect(req.config.systemInstruction).toBe(TRANSCRIPTION_SYSTEM_INSTRUCTION);
    expect(req.contents[0].parts).toEqual([audio, { text: TRANSCRIPTION_PROMPT_TEXT }]);
    expect(req.config.safetySettings).toHaveLength(4);
    // Gemini 3's own default (1.0): a lowered temperature makes these models loop
    expect(req.config.temperature).toBeUndefined();
  });

  it('asks for the rest of a transcript with instructions for that part only, and normal mode with its own', () => {
    const rest = view(buildTranscriptionRequest('gemini-3.8-flash', 'pro', audio, false, '26:35'));
    expect(rest.config.systemInstruction).toBe(CONTINUATION_SYSTEM_INSTRUCTION);
    expect(rest.contents[0].parts).toEqual([audio, { text: continuationPrompt('26:35') }]);
    const normal = view(buildTranscriptionRequest('gemini-3.8-flash', 'normal', audio));
    expect(normal.config.systemInstruction).toBe(TRANSCRIPTION_SYSTEM_INSTRUCTION_NORMAL);
    expect(normal.contents[0].parts).toEqual([audio, { text: TRANSCRIPTION_PROMPT_TEXT_NORMAL }]);
  });

  it('gives the model no orders that pull against each other', () => {
    // The rest is never also told to transcribe the whole recording
    expect(CONTINUATION_SYSTEM_INSTRUCTION).not.toMatch(/whole recording and transcribe/);
    expect(continuationPrompt('26:35')).toContain(NO_MORE_SPEECH);
    // Normal mode asks for no times or speaker names; the timed modes ask for both, in the format the app reads
    expect(TRANSCRIPTION_SYSTEM_INSTRUCTION_NORMAL).not.toContain('[MM:SS]');
    for (const instruction of [TRANSCRIPTION_SYSTEM_INSTRUCTION, CONTINUATION_SYSTEM_INSTRUCTION]) {
      expect(instruction).toContain('[00:00] **Speaker 1:**');
      expect(instruction).toContain(UNCLEAR_MARK);
      // Which rule wins is stated: never invent before never leave out
      expect(instruction.indexOf('Never write a word that was not spoken')).toBeLessThan(instruction.indexOf('Never leave out a word that was spoken'));
    }
    // Adverts are transcribed like any other talk, with no marks to fold them
    expect(TRANSCRIPTION_SYSTEM_INSTRUCTION).not.toMatch(/বিজ্ঞাপন শুরু|বিজ্ঞাপন শেষ/);
  });

  it('sends speech-only transcribe models just the audio: speakers and times in Pro, smart (punctuated) text in Normal', () => {
    const pro = view(buildTranscriptionRequest('gemini-3.5-transcribe', 'pro', audio));
    const normal = view(buildTranscriptionRequest('gemini-3.5-transcribe', 'normal', audio));
    for (const req of [pro, normal]) {
      expect(req.config).not.toHaveProperty('systemInstruction');
      expect(req.contents[0].parts).toEqual([audio]);
    }
    expect(pro.config.httpOptions.extraBody.generationConfig.audioTranscriptionConfig).toEqual({ diarization: true, wordTimestamp: true });
    expect(normal.config.httpOptions.extraBody.generationConfig.audioTranscriptionConfig).toEqual({ mode: 'smart' });
  });

  it('turns a transcribe answer into speaker lines, and leaves normal answers alone', () => {
    const resp = { candidates: [{ content: { parts: [
      { text: 'Hello there.', audioTranscription: { text: 'Hello there.', speakerLabel: 'spk:3', words: [{ startOffset: '15.100s' }] } },
      { text: 'Hi.', audioTranscription: { text: 'Hi.', speakerLabel: 'spk:0', words: [{ startOffset: '75.9s' }] } },
      { audioTranscription: { text: '  ' } },
      { text: 'Back to you.', audioTranscription: { text: 'Back to you.', speakerLabel: 'spk:3', words: [{ startOffset: '3725s' }] } },
    ] } }] };
    expect(extractResponseText(resp)).toBe('[00:15] **Speaker 1:** Hello there.\n[01:15] **Speaker 2:** Hi.\n[1:02:05] **Speaker 1:** Back to you.');
    expect(extractResponseText({ candidates: [{ content: { parts: [{ text: '[00:01] **Speaker 1:** ok' }] } }] })).toBe('[00:01] **Speaker 1:** ok');
    // A smart answer has no speakers or times: plain paragraphs, never a made-up [00:00] Speaker 1
    const smart = { candidates: [{ content: { parts: [{ audioTranscription: { text: 'প্রথম কথা। দ্বিতীয় কথা।' } }, { audioTranscription: { text: 'পরের অংশ।' } }] } }] };
    expect(extractResponseText(smart)).toBe('প্রথম কথা। দ্বিতীয় কথা।\n\nপরের অংশ।');
  });

  it('waits longer for longer audio: a quarter of its length plus two minutes, 5 to 20 minutes', () => {
    expect(transcriptionTimeoutMs(0)).toBeUndefined();
    expect(transcriptionTimeoutMs(60)).toBe(300000);
    expect(transcriptionTimeoutMs(66 * 60)).toBe((120 + 990) * 1000);
    expect(transcriptionTimeoutMs(3 * 3600)).toBe(1200000);
  });
});
