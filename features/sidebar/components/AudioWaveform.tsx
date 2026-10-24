import React, { useEffect, useRef } from 'react';

interface Props {
  peaks: number[];
  audioRef: React.RefObject<HTMLMediaElement | null>;
  isDark: boolean;
  title: string;
}

const WIDTH = 600;
const HEIGHT = 64;

// Draws the waveform with the played part highlighted; clicking it jumps the player to that point
export const AudioWaveform = ({ peaks, audioRef, isDark, title }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const media = audioRef.current;

    // Redrawn on the player's own events, so playback never re-renders React
    const draw = () => {
      const progress = media && media.duration > 0 ? media.currentTime / media.duration : 0;
      const barWidth = WIDTH / peaks.length;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      peaks.forEach((peak, i) => {
        const height = Math.max(2, peak * (HEIGHT - 4));
        ctx.fillStyle = (i + 0.5) / peaks.length <= progress ? '#6366f1' : (isDark ? '#475569' : '#cbd5e1');
        ctx.fillRect(i * barWidth + 1, (HEIGHT - height) / 2, Math.max(1, barWidth - 2), height);
      });
    };

    draw();
    const events = ['timeupdate', 'seeked', 'loadedmetadata'];
    events.forEach(name => media?.addEventListener(name, draw));
    return () => events.forEach(name => media?.removeEventListener(name, draw));
  }, [peaks, audioRef, isDark]);

  const seek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const media = audioRef.current;
    if (!media || !(media.duration > 0)) return;
    const box = e.currentTarget.getBoundingClientRect();
    media.currentTime = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * media.duration;
  };

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      onClick={seek}
      title={title}
      className={`w-full h-12 rounded-lg cursor-pointer ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
    />
  );
};
