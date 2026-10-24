import { useState, useRef, useEffect, useCallback } from 'react';

export const useAudioPlayback = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioCurrentTime] = useState(0);

  const handleTimeUpdate = useCallback(() => {
    // No-op: native <audio controls> manages its own playhead UI without full-app React re-renders
  }, []);

  // A transcript timestamp such as "[01:15]", or seconds (the speaker archive sends numbers)
  const handleSeek = useCallback((time: string | number) => {
    if (!audioRef.current) return;
    if (typeof time === 'number') {
      if (!Number.isFinite(time)) return;
      audioRef.current.currentTime = time;
      audioRef.current.play().catch(() => {});
      return;
    }
    // Timestamps may be written with Bengali digits
    const cleanTime = time.replace(/[\[\]]/g, '').replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
    const parts = cleanTime.split(/[-:]/).map(s => s.trim()).filter(s => s);
    const target = parts.length > 0 ? parts.slice(0, 3).join(':') : "00:00"; 
    
    const tParts = target.split(':').map(Number);
    let seconds = 0;
    if (tParts.length === 1) seconds = tParts[0];
    else if (tParts.length === 2) seconds = tParts[0] * 60 + tParts[1];
    else if (tParts.length === 3) seconds = tParts[0] * 3600 + tParts[1] * 60 + tParts[2];
    
    if (!Number.isFinite(seconds)) return;
    audioRef.current.currentTime = seconds;
    audioRef.current.play().catch(() => {});
  }, []);

  return { audioRef, audioCurrentTime, handleSeek, handleTimeUpdate };
};
