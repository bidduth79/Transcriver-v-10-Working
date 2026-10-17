import { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { getSensitiveKeywords } from '../../../utils/sensitiveKeywords';

export const useTranscriptScroll = (
  matchCount: number,
  searchTerm: string,
  currentMatchIndex: number
) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [localScrollPercent, setLocalScrollPercent] = useState(0);
  const rafScrollRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    if (rafScrollRef.current !== null) return;
    rafScrollRef.current = requestAnimationFrame(() => {
      rafScrollRef.current = null;
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const maxScroll = scrollHeight - clientHeight;
        const percent = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * 100) : 0;
        setLocalScrollPercent(prev => (Math.abs(prev - percent) >= 4 || percent === 0 || percent === 100) ? percent : prev);
      }
    });
  }, []);

  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    return () => {
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
        const container = scrollContainerRef.current;
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const offset = elementRect.top - containerRect.top + container.scrollTop - (container.clientHeight / 2) + (element.clientHeight / 2);
        container.scrollTo({ top: offset, behavior: 'smooth' });
      }
    }
  }, [currentMatchIndex, matchCount, searchTerm]);

  return {
    scrollContainerRef,
    transcriptEndRef,
    localScrollPercent,
    handleScroll,
    scrollToTop,
    scrollToBottom
  };
};

const EMPTY_ARRAY: any[] = [];

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
