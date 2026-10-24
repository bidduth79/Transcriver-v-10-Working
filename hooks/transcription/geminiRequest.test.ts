import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/ApiKeyManager', () => ({
  getModelDefinition: () => ({ category: 'fast' }),
  isSpeedOptimizationEnabled: () => false,
}));

import { buildTranscriptionRequest, buildHighSensitivityRequest, extractResponseText } from './geminiRequest';
import { TRANSCRIPTION_SYSTEM_INSTRUCTION, TRANSCRIPTION_PROMPT_TEXT } from '../../constants/instructions';

const audio = { inlineData: { mimeType: 'audio/wav', data: 'AAA' } };

describe('Gemini transcription requests', () => {
  it('sends the instructions as a system instruction to normal models', () => {
    const req = buildTranscriptionRequest('gemini-3.8-flash', 'pro', audio);
    expect(req.config.systemInstruction).toBe(TRANSCRIPTION_SYSTEM_INSTRUCTION);
    expect(req.contents[0].parts).toEqual([audio, { text: TRANSCRIPTION_PROMPT_TEXT }]);
    expect(req.config.safetySettings).toHaveLength(4);
  });

  it('sends speech-only transcribe models just the audio with diarization turned on', () => {
    for (const req of [buildTranscriptionRequest('gemini-3.5-transcribe', 'pro', audio), buildHighSensitivityRequest('gemini-3.5-transcribe', audio)]) {
      expect(req.config).not.toHaveProperty('systemInstruction');
      expect(req.contents[0].parts).toEqual([audio]);
      expect(req.config.httpOptions.extraBody.generationConfig.audioTranscriptionConfig).toEqual({ diarization: true, wordTimestamp: true });
    }
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
    expect(extractResponseText({ candidates: [{ content: { parts: [{ audioTranscription: { text: 'no labels' } }] } }] })).toBe('[00:00] **Speaker 1:** no labels');
  });
});
