import React, { useMemo, useCallback } from 'react';

export const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

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
    return new RegExp(`(${escapeRegExp(trimmedSearch)})`, 'gi');
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

  // Precompile sensitive keywords regex once per sensitiveMatches change (NOT per paragraph)
  const sensitiveRegex = useMemo(() => {
    if (sensitiveSet.size === 0) return null;
    const cleanMatches = Array.from(sensitiveSet).map(escapeRegExp);
    if (cleanMatches.length === 0) return null;
    return new RegExp(`(${cleanMatches.join('|')})`, 'gi');
  }, [sensitiveSet]);

  const formatText = useCallback((text: string, matchIndexRef: { current: number }) => {
    if (!text) return [];
    if (!searchRegex && !sensitiveRegex) {
      return [text];
    }

    let elements: (string | React.ReactNode)[] = [text];

    // 1. Process Search Term FIRST (Fast O(N) linear regex)
    if (searchRegex && trimmedSearch) {
      const lowerSearch = trimmedSearch.toLowerCase();
      elements = elements.flatMap((el, elIdx) => {
        if (typeof el !== 'string') return el;
        return el.split(searchRegex).map((sub, subIdx) => {
          if (sub.toLowerCase() === lowerSearch) {
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
          if (sensitiveSet.has(sub.toLowerCase())) {
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
  }, [searchRegex, trimmedSearch, currentMatchIndex, sensitiveRegex, sensitiveSet]);

  return { formatText };
};
