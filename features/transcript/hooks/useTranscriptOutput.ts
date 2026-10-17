import { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { getSensitiveKeywords } from '../../../utils/sensitiveKeywords';

export const useTranscriptScroll = (
  matchCount: number,
  searchTerm: string,
  currentMatchIndex: number,
  isSynced: boolean,
  isKaraokeEnabled: boolean,
  status: string,
  transcript: string,
  audioCurrentTime: number
) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [localScrollPercent, setLocalScrollPercent] = useState(0);
  
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const programmaticScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rafScrollRef = useRef<number | null>(null);

  const handleUserInteraction = useCallback(() => {
    if (!isKaraokeEnabled) return;
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 3000);
  }, [isKaraokeEnabled]);

  const setProgrammaticScroll = useCallback(() => {
    if (programmaticScrollTimeoutRef.current) {
      clearTimeout(programmaticScrollTimeoutRef.current);
    }
    programmaticScrollTimeoutRef.current = setTimeout(() => {
      programmaticScrollTimeoutRef.current = null;
    }, 1000);
  }, []);

  const handleScroll = useCallback(() => {
    if (rafScrollRef.current !== null) return;
    rafScrollRef.current = requestAnimationFrame(() => {
      rafScrollRef.current = null;
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const maxScroll = scrollHeight - clientHeight;
        const percent = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * 100) : 0;
        setLocalScrollPercent(prev => (Math.abs(prev - percent) >= 4 || percent === 0 || percent === 100) ? percent : prev);
        
        if (isKaraokeEnabled && !programmaticScrollTimeoutRef.current) {
          handleUserInteraction();
        }
      }
    });
  }, [isKaraokeEnabled, handleUserInteraction]);

  const scrollToTop = useCallback(() => {
    setProgrammaticScroll();
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setProgrammaticScroll]);

  const scrollToBottom = useCallback(() => {
    setProgrammaticScroll();
    scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, [setProgrammaticScroll]);

  // Sync scroll with active segment
  const flooredAudioTime = Math.floor(audioCurrentTime);
  
  useEffect(() => {
    if (!isUserScrollingRef.current && isSynced && isKaraokeEnabled && (status === 'completed' || status === 'processing')) {
      const activeEl = document.getElementById('active-transcript-segment');
      if (activeEl && scrollContainerRef.current) {
        setProgrammaticScroll();
        const container = scrollContainerRef.current;
        const elementRect = activeEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const offset = elementRect.top - containerRect.top + container.scrollTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
        container.scrollTo({ top: offset, behavior: 'smooth' });
      }
    }
  }, [flooredAudioTime, isSynced, status, isKaraokeEnabled, transcript, setProgrammaticScroll]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
      if (rafScrollRef.current !== null) {
        cancelAnimationFrame(rafScrollRef.current);
      }
    };
  }, []);

  // Sync scroll to Search Match
  useEffect(() => {
    if (matchCount > 0 && searchTerm) {
      const activeId = `match-${currentMatchIndex}`;
      const element = document.getElementById(activeId);
      if (element && scrollContainerRef.current) {
        setProgrammaticScroll();
        const container = scrollContainerRef.current;
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const offset = elementRect.top - containerRect.top + container.scrollTop - (container.clientHeight / 2) + (element.clientHeight / 2);
        container.scrollTo({ top: offset, behavior: 'smooth' });
      }
    }
  }, [currentMatchIndex, matchCount, searchTerm, setProgrammaticScroll]);

  return {
    scrollContainerRef,
    transcriptEndRef,
    localScrollPercent,
    handleScroll,
    handleUserInteraction,
    scrollToTop,
    scrollToBottom
  };
};

const EMPTY_ARRAY: any[] = [];
const KARAOKE_AVAILABLE_MARKER = [{ start: 0, end: 0, text: '' }];

export const useTranscriptSync = (
  fileUrl: string | null,
  transcript: string,
  activeTranscriptSourceMeta: any,
  fileMeta: any,
  status: string
) => {
  const isSynced = useMemo(() => {
    if (!fileUrl || !transcript || !activeTranscriptSourceMeta) return false;
    return fileMeta?.name === activeTranscriptSourceMeta?.name;
  }, [fileUrl, transcript, activeTranscriptSourceMeta, fileMeta]);

  const [isKaraokeEnabled, setIsKaraokeEnabled] = useState(false);

  useEffect(() => {
    if (status === 'processing') {
      setIsKaraokeEnabled(false);
    }
  }, [isSynced, status]);

  const hasTimestamps = useMemo(() => {
    if (!transcript || !isSynced) return false;
    return /(?:\[|\b)(?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2}(?:\]|\b)/.test(transcript.slice(0, 2000));
  }, [transcript, isSynced]);

  const transcriptSegments = useMemo(() => {
    if (!transcript || !isSynced) return EMPTY_ARRAY;
    // Do not split and parse the entire transcript unless Karaoke Mode is actually enabled!
    if (!isKaraokeEnabled) {
      return hasTimestamps ? KARAOKE_AVAILABLE_MARKER : EMPTY_ARRAY;
    }

    const toSeconds = (h: string | undefined, m: string, s: string) => {
      const parseBengali = (str: string) => str ? parseInt(str.replace(/[০-৯]/g, match => '0123456789'['০১২৩৪৫৬৭৮৯'.indexOf(match)]), 10) : 0;
      const hours = h ? parseBengali(h) : 0;
      const minutes = parseBengali(m);
      const seconds = parseBengali(s);
      return hours * 3600 + minutes * 60 + seconds;
    };

    const parts = transcript.split(/(?:\[|\b)((?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2})(?:\]|\b)/);
    const finalSegments: any[] = [];
    let lastTime = 0;

    if (parts[0] && parts[0].trim()) {
      finalSegments.push({
         start: 0,
         end: Infinity,
         text: parts[0].trim(),
         originalText: parts[0]
      });
    }

    for (let i = 1; i < parts.length; i += 2) {
      const timeStr = parts[i];
      const textStr = parts[i + 1] || "";

      let time = lastTime;
      if (timeStr) {
        const timeMatch = timeStr.match(/(?:([0-9০-৯]{1,2}):)?([0-9০-৯]{1,2}):([0-9০-৯]{2})/);
        if (timeMatch) {
          time = toSeconds(timeMatch[1], timeMatch[2], timeMatch[3]);
          lastTime = time;
        }
      }

      if (textStr.trim()) {
        finalSegments.push({
           start: time,
           end: Infinity,
           text: textStr.trim(),
           originalText: textStr
        });
      }
    }

    for (let i = 0; i < finalSegments.length; i++) {
        const next = finalSegments[i + 1];
        finalSegments[i].end = (next && next.start > finalSegments[i].start) ? next.start : Infinity;
    }
    
    return finalSegments.length > 0 ? finalSegments : EMPTY_ARRAY;
  }, [transcript, isSynced, isKaraokeEnabled, hasTimestamps]);

  return { isSynced, isKaraokeEnabled, setIsKaraokeEnabled, transcriptSegments };
};

export const useLogoAnimation = () => {
  const [logoOffset, setLogoOffset] = useState({ x: 0, y: 0 });
  const logoContainerRef = useRef<HTMLDivElement>(null);

  const handleLogoMouseMove = (e: any) => {
    if (!logoContainerRef.current) return;
    const rect = logoContainerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const distX = e.clientX - centerX;
    const distY = e.clientY - centerY;
    const distance = Math.sqrt(distX * distX + distY * distY);
    
    const maxDistance = 180;
    const maxPush = 80;

    if (distance < maxDistance && distance > 0) {
      const force = Math.pow((maxDistance - distance) / maxDistance, 0.8); 
      const pushX = (distX / distance) * -maxPush * force;
      const pushY = (distY / distance) * -maxPush * force;
      setLogoOffset({ x: pushX, y: pushY });
    } else {
      setLogoOffset({ x: 0, y: 0 });
    }
  };

  const handleLogoMouseLeave = () => {
    setLogoOffset({ x: 0, y: 0 });
  };

  return { logoOffset, logoContainerRef, handleLogoMouseMove, handleLogoMouseLeave };
};

export const useSensitiveKeywords = (transcript: string) => {
  const [sensitiveKeywords, setSensitiveKeywordsList] = useState<string[]>(EMPTY_ARRAY);
  const deferredTranscript = useDeferredValue(transcript);
  const prevMatchesRef = useRef<string[]>(EMPTY_ARRAY);

  const sensitiveKeywordsUpdated = useAppStore(state => state.sensitiveKeywordsUpdated);

  useEffect(() => {
    setSensitiveKeywordsList(getSensitiveKeywords());
  }, [sensitiveKeywordsUpdated]);

  const sensitiveMatches = useMemo(() => {
    if (!deferredTranscript || sensitiveKeywords.length === 0) {
      prevMatchesRef.current = EMPTY_ARRAY;
      return EMPTY_ARRAY;
    }
    const lower = deferredTranscript.toLowerCase();
    const matched = sensitiveKeywords
      .filter(kw => typeof kw === 'string' && kw.trim().length >= 2 && lower.includes(kw.trim().toLowerCase()))
      .sort((a, b) => b.length - a.length);

    if (matched.length === 0) {
      prevMatchesRef.current = EMPTY_ARRAY;
      return EMPTY_ARRAY;
    }

    const prev = prevMatchesRef.current;
    if (prev.length === matched.length && prev.every((val, idx) => val === matched[idx])) {
      return prev;
    }
    prevMatchesRef.current = matched;
    return matched;
  }, [deferredTranscript, sensitiveKeywords]);

  const sensitiveWordCounts = useMemo(() => {
    if (!deferredTranscript || sensitiveMatches.length === 0) return EMPTY_ARRAY;
    
    const counts: Record<string, number> = {};
    const lowerToOriginal: Record<string, string> = {};
    sensitiveMatches.forEach(kw => {
      counts[kw] = 0;
      lowerToOriginal[kw.toLowerCase()] = kw;
    });

    const cleanMatches = sensitiveMatches
      .filter(kw => typeof kw === 'string' && kw.trim().length >= 2)
      .map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (cleanMatches.length === 0) return EMPTY_ARRAY;

    try {
      const combinedRegex = new RegExp(cleanMatches.join('|'), 'gi');
      const allMatches = deferredTranscript.match(combinedRegex) || [];
      for (let i = 0; i < allMatches.length; i++) {
        const origKey = lowerToOriginal[allMatches[i].toLowerCase()];
        if (origKey !== undefined) {
          counts[origKey] = (counts[origKey] || 0) + 1;
        }
      }
    } catch (e) {
      console.warn("Sensitive word count notice:", e);
    }
    
    return sensitiveMatches.map(kw => ({ word: kw, count: counts[kw] || 0 }));
  }, [deferredTranscript, sensitiveMatches]);

  const isSensitive = sensitiveMatches.length > 0;

  return { sensitiveMatches, sensitiveWordCounts, isSensitive };
};
