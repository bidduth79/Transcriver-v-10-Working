import { useEffect, useState } from 'react';
import { peaksFromChannels } from '../../../utils/waveformPeaks';
import { isHeavyProcessingActive } from '../../../services/firebaseSync/syncState';

export const WAVEFORM_BARS = 120;
// Decoding needs the whole file plus its samples in memory, so big files get no waveform
export const MAX_WAVEFORM_BYTES = 30 * 1024 * 1024;
// The lowest rate browsers decode to: plenty for drawing, ~10 MB of samples per hour of stereo audio
const DECODE_SAMPLE_RATE = 3000;

const decodePeaks = async (fileUrl: string) => {
  const blob = await (await fetch(fileUrl)).blob();
  if (blob.size > MAX_WAVEFORM_BYTES) return null;
  const context = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE);
  const audio = await context.decodeAudioData(await blob.arrayBuffer());
  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
  return peaksFromChannels(channels, WAVEFORM_BARS);
};

// Bar heights (0–1) for an audio file, or null while loading, for big files, during a transcription, or on error
export const useWaveform = (fileUrl: string | null, enabled: boolean) => {
  const [result, setResult] = useState<{ url: string; peaks: number[] } | null>(null);

  useEffect(() => {
    if (!fileUrl || !enabled || isHeavyProcessingActive() || typeof OfflineAudioContext === 'undefined') return;
    let alive = true;
    decodePeaks(fileUrl)
      .then(peaks => { if (alive && peaks) setResult({ url: fileUrl, peaks }); })
      .catch(err => console.warn('Waveform not available:', err));
    return () => { alive = false; };
  }, [fileUrl, enabled]);

  return result?.url === fileUrl ? result.peaks : null;
};
