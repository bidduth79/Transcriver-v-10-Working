import { describe, it, expect } from 'vitest';
import { peaksFromChannels } from './waveformPeaks';

describe('peaksFromChannels', () => {
  it('takes the loudest sample per slice across channels and scales to 1', () => {
    const left = new Float32Array([0.1, -0.2, 0, 0, 0.5, 0.1, 0, 0]);
    const right = new Float32Array([0, 0, 0.4, 0, 0, 0, 0, -1]);
    expect(peaksFromChannels([left, right], 4)).toEqual([0.2, 0.4, 0.5, 1].map(v => expect.closeTo(v, 5)));
  });

  it('handles silence, empty audio and more bars than samples', () => {
    expect(peaksFromChannels([new Float32Array(6)], 3)).toEqual([0, 0, 0]);
    expect(peaksFromChannels([], 3)).toEqual([]);
    expect(peaksFromChannels([new Float32Array([0.5, 1])], 4)).toEqual([0.5, 0.5, 1, 1]);
  });
});
