import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { getSensitiveKeywords } from '../../../utils/sensitiveKeywords';
import type { Translations } from '../../../translations';
import type { FileChangeEvent } from '../../../hooks/useFileHandler';

const EMPTY_MATCHES: string[] = [];

export const useSidebar = (
  appLang: string,
  handleFileChange: (e: FileChangeEvent, autoStart?: boolean) => void,
  audioRef: React.RefObject<HTMLAudioElement | null>
) => {
  const [activeTab, setActiveTab] = useState('upload');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [sensitiveKeywords, setSensitiveKeywordsList] = useState<string[]>(EMPTY_MATCHES);
  const matchCacheRef = useRef<Map<string, string[]>>(new Map());

  const sensitiveKeywordsUpdated = useAppStore(state => state.sensitiveKeywordsUpdated);

  useEffect(() => {
    matchCacheRef.current.clear();
    setSensitiveKeywordsList(getSensitiveKeywords());
  }, [sensitiveKeywordsUpdated]);

  const preparedKeywords = useMemo(() => {
    return sensitiveKeywords
      .filter(kw => kw && kw.trim().length > 0)
      .sort((a, b) => b.length - a.length)
      .map(kw => ({ original: kw, lower: kw.toLowerCase() }));
  }, [sensitiveKeywords]);

  const getSensitiveMatches = useCallback((text: string) => {
    if (!text || preparedKeywords.length === 0) return EMPTY_MATCHES;
    const cached = matchCacheRef.current.get(text);
    if (cached) return cached;

    const lower = text.toLowerCase();
    const matches: string[] = [];
    for (let i = 0; i < preparedKeywords.length; i++) {
      const kw = preparedKeywords[i];
      if (lower.includes(kw.lower)) {
        matches.push(kw.original);
      }
    }
    const result = matches.length > 0 ? matches : EMPTY_MATCHES;
    // Keys are transcript texts read from IndexedDB, so keep only a few in memory
    if (matchCacheRef.current.size > 200) {
      matchCacheRef.current.clear();
    }
    matchCacheRef.current.set(text, result);
    return result;
  }, [preparedKeywords]);


  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleYouTubeSuccess = (blob: Blob, fileName: string, mode: string) => {
      if (mode === 'transcribe') {
          const file = new File([blob], fileName, { type: blob.type || 'audio/mp3' });
          handleFileChange({ target: { files: [file] } }, true);
      }
  };

  const changePlaybackRate = (rate: number) => {
    if (audioRef.current) {
        audioRef.current.playbackRate = rate;
    }
    setPlaybackRate(rate);
  };

  const skipTime = (seconds: number) => {
    if (audioRef.current) {
        audioRef.current.currentTime += seconds;
    }
  };

  const getHeaderTitle = (isRecording: boolean, t: Translations) => {
      if (isRecording) return appLang === 'bn' ? "রেকর্ডিং চলছে..." : "Recording...";
      if (activeTab === 'youtube') return 'YOUTUBE LINK';
      if (activeTab === 'facebook') return 'FACEBOOK LINK';
      return t.audioVideoFile;
  };

  return {
    activeTab,
    setActiveTab,
    playbackRate,
    getSensitiveMatches,
    formatTime,
    handleYouTubeSuccess,
    changePlaybackRate,
    skipTime,
    getHeaderTitle
  };
};
