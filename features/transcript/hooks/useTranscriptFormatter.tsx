import React, { useMemo, useCallback } from 'react';

export const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Bengali vowel signs and joined letters right after a match belong to its last letter; leaving them
// outside the highlight cuts them off from that letter and they show up broken
const BENGALI_TAIL = '(?:\u09CD[\u0995-\u09B9\u09DC-\u09DF]|[\u0981-\u0983\u09BC\u09BE-\u09CD\u09D7\u09E2\u09E3\u200C\u200D])*';

export const useTranscriptFormatter = (
  searchTerm: string,
  isDark: boolean,
  currentMatchIndex: number,
  sensitiveMatches: string[] = []
) => {
  const trimmedSearch = searchTerm ? searchTerm.trim() : '';

  // Precompile search regex once per searchTerm change (NOT per paragraph)
  const searchRegex = useMemo(() => {
    if (!trimmedSearch) return null;
    return new RegExp(`(${escapeRegExp(trimmedSearch)}${BENGALI_TAIL})`, 'gi');
  }, [trimmedSearch]);

  // Precompute O(1) Set of lowercase sensitive matches
  const sensitiveSet = useMemo(() => {
    if (!sensitiveMatches || sensitiveMatches.length === 0) return new Set<string>();
    return new Set(
      sensitiveMatches
        .filter(kw => typeof kw === 'string' && kw.trim().length >= 2)
        .map(kw => kw.trim().toLowerCase())
    );
  }, [sensitiveMatches]);

  // Precompile sensitive keywords regex once per sensitiveMatches change (NOT per paragraph), with a
  // bounded cache for sensitive-only highlighting that starts empty with each new regex
  const { sensitiveRegex, sensitiveHighlightCache } = useMemo(() => {
    const cleanMatches = Array.from(sensitiveSet).map(escapeRegExp);
    return {
      sensitiveRegex: cleanMatches.length === 0 ? null : new RegExp(`((?:${cleanMatches.join('|')})${BENGALI_TAIL})`, 'gi'),
      sensitiveHighlightCache: new Map<string, (string | React.ReactNode)[]>(),
    };
  }, [sensitiveSet]);

  const formatText = useCallback((text: string, matchIndexRef: { current: number }) => {
    if (!text) return [];
    if (!searchRegex && !sensitiveRegex) {
      return [text];
    }

    // Fast path: when only sensitiveRegex is active (no active search term), use bounded cache
    if (!searchRegex && sensitiveRegex && sensitiveSet.size > 0) {
      const cached = sensitiveHighlightCache.get(text);
      if (cached) return cached;

      // split() puts each match (with its tail) at an odd index
      const result = text.split(sensitiveRegex).map((sub, subIdx) => {
        if (subIdx % 2 === 1) {
          return (
            <mark
              key={`sens-0-${subIdx}`}
              className="bg-red-500/20 text-red-700 dark:text-red-400 font-bold decoration-red-500/30 underline decoration-2 underline-offset-4"
            >
              {sub}
            </mark>
          );
        }
        return sub;
      });

      if (sensitiveHighlightCache.size >= 500) {
        const firstKey = sensitiveHighlightCache.keys().next().value;
        if (firstKey !== undefined) sensitiveHighlightCache.delete(firstKey);
      }
      sensitiveHighlightCache.set(text, result);
      return result;
    }

    let elements: (string | React.ReactNode)[] = [text];

    // 1. Process Search Term FIRST (Fast O(N) linear regex)
    if (searchRegex && trimmedSearch) {
      elements = elements.flatMap((el, elIdx) => {
        if (typeof el !== 'string') return el;
        return el.split(searchRegex).map((sub, subIdx) => {
          if (subIdx % 2 === 1) {
            const currentId = `match-${matchIndexRef.current}`;
            const isCurrent = matchIndexRef.current === currentMatchIndex;
            matchIndexRef.current++;
            return (
              <mark
                key={`search-${elIdx}-${subIdx}`}
                id={currentId}
                className={`${isCurrent ? 'bg-orange-500 text-white' : 'bg-yellow-400 text-black'} font-bold decoration-yellow-600/30 underline decoration-2 underline-offset-4 transition-all duration-300`}
              >
                {sub}
              </mark>
            );
          }
          return sub;
        });
      });
    }

    // 2. Process Sensitive Matches with O(1) Set lookup
    if (sensitiveRegex && sensitiveSet.size > 0) {
      elements = elements.flatMap((el, elIdx) => {
        if (typeof el !== 'string') return el;
        return el.split(sensitiveRegex).map((sub, subIdx) => {
          if (subIdx % 2 === 1) {
            return (
              <mark
                key={`sens-${elIdx}-${subIdx}`}
                className="bg-red-500/20 text-red-700 dark:text-red-400 font-bold decoration-red-500/30 underline decoration-2 underline-offset-4"
              >
                {sub}
              </mark>
            );
          }
          return sub;
        });
      });
    }

    return elements;
  }, [searchRegex, trimmedSearch, currentMatchIndex, sensitiveRegex, sensitiveSet, sensitiveHighlightCache]);

  return { formatText };
};
