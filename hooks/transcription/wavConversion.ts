/**
 * Calculates the Root Mean Square (RMS) volume level of an AudioBuffer to detect if audible speech is present.
 */
const calculateAudioRMS = (audioBuffer: AudioBuffer): number => {
  let totalSquare = 0;
  let totalSamples = 0;
  const step = Math.max(1, Math.floor(audioBuffer.length / 80000));
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < data.length; i += step) {
      totalSquare += data[i] * data[i];
      totalSamples++;
    }
  }
  return totalSamples > 0 ? Math.sqrt(totalSquare / totalSamples) : 0;
};

/**
 * Encodes an AudioBuffer into standard 16kHz mono 16-bit PCM WAV with dynamic speech normalization/gain.
 * This format is universally decoded by Google Speech & Gemini AI models without demuxing issues.
 */
const audioBufferToWavBlob = (audioBuffer: AudioBuffer, targetSampleRate: number = 16000): Blob => {
  const sampleRate = targetSampleRate;
  const numChannels = 1;
  const sourceSampleRate = audioBuffer.sampleRate;
  const sourceData = audioBuffer.getChannelData(0);

  // Downmix stereo/multichannel to mono for speech transcription
  let monoData: Float32Array;
  if (audioBuffer.numberOfChannels > 1) {
    monoData = new Float32Array(audioBuffer.length);
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      const channel = audioBuffer.getChannelData(c);
      for (let i = 0; i < audioBuffer.length; i++) {
        monoData[i] += channel[i] / audioBuffer.numberOfChannels;
      }
    }
  } else {
    monoData = sourceData;
  }

  // Resample if sourceSampleRate differs from target sampleRate
  let samples: Float32Array;
  if (sourceSampleRate === sampleRate) {
    samples = new Float32Array(monoData);
  } else {
    const ratio = sourceSampleRate / sampleRate;
    const newLength = Math.max(1, Math.round(monoData.length / ratio));
    samples = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const pos = i * ratio;
      const index = Math.floor(pos);
      const frac = pos - index;
      const nextIndex = Math.min(index + 1, monoData.length - 1);
      samples[i] = monoData[index] * (1 - frac) + monoData[nextIndex] * frac;
    }
  }

  // Speech peak normalization: boost quiet recordings, WhatsApp voice notes, and phone audio
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxAbs) maxAbs = abs;
  }

  // If the audio is quiet, apply intelligent gain up to 10x (targeting ~0.85 peak) without clipping
  let gain = 1.0;
  if (maxAbs > 0.0001 && maxAbs < 0.75) {
    gain = Math.min(10.0, 0.85 / maxAbs);
  }

  // 16-bit PCM WAV file header (44 bytes)
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (v: DataView, offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      v.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // Mono (1)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples with gain applied
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] * gain));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

/**
 * Safely decodes audio format and resamples to 16kHz mono 16-bit PCM WAV.
 * Strictly guarded against browser memory overflow and renderer crashes.
 */
export const convertAudioToWav = async (
  file: Blob,
  targetSampleRate: number = 16000
): Promise<{ wavBlob: Blob; rms: number; duration: number } | null> => {
  // Prevent in-browser decode on large files (>1MB) to protect against Chrome "Aw, Snap!" OOM crashes
  // A 54-minute Opus file is only 7MB, but decoding it allocates 1.25GB of uncompressed PCM in RAM!
  if (file.size > 1 * 1024 * 1024) {
    console.warn("File too large for client-side WAV conversion (>1MB), sending in native format");
    return null;
  }

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  let ctx: AudioContext | null = null;
  try {
    ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;

    // Prevent rendering audio longer than 3 minutes in browser memory
    if (duration > 180) {
      console.warn("Audio duration too long for client-side conversion (>3m), sending in native format");
      return null;
    }

    const rms = calculateAudioRMS(audioBuffer);
    // Direct, lightweight software resampling without native OfflineAudioContext crashes
    const wavBlob = audioBufferToWavBlob(audioBuffer, targetSampleRate);
    return { wavBlob, rms, duration };
  } catch (err) {
    console.warn("In-browser audio decoding to WAV was not possible:", err);
    return null;
  } finally {
    if (ctx && ctx.state !== 'closed') {
      try {
        await ctx.close();
      } catch (e) {
        // Ignore context close error
      }
    }
  }
};
