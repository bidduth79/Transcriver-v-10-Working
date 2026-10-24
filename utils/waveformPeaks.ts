// Loudest sample in each of `bars` equal slices, scaled so the loudest bar is 1
export const peaksFromChannels = (channels: Float32Array[], bars: number): number[] => {
  const length = channels[0]?.length ?? 0;
  if (length === 0 || bars <= 0) return [];
  const step = length / bars;
  const peaks = Array.from({ length: bars }, (_, bar) => {
    const start = Math.floor(bar * step);
    const end = Math.max(start + 1, Math.floor((bar + 1) * step));
    let peak = 0;
    for (const data of channels) {
      for (let i = start; i < end && i < length; i++) {
        const value = Math.abs(data[i]);
        if (value > peak) peak = value;
      }
    }
    return peak;
  });
  const loudest = Math.max(...peaks);
  return loudest > 0 ? peaks.map(peak => peak / loudest) : peaks;
};
