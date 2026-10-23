import { useEffect, useState } from 'react';
import { findHistoryIdsByTranscript } from '../../services/historyRecords';

export const escapeSearchPattern = (query: string) => new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/**
 * Ids of saved transcripts that contain the (already debounced) query, read from IndexedDB.
 * null when there is no query or until the first scan for it finishes. `rescanKey` re-runs the scan
 * when the list changes; the previous ids stay in use meanwhile.
 */
export const useTranscriptSearchIds = (query: string, rescanKey: unknown) => {
  const [result, setResult] = useState<{ query: string; ids: Set<string> } | null>(null);
  const hasQuery = query.trim() !== '';

  useEffect(() => {
    if (!hasQuery) return;
    let alive = true;
    findHistoryIdsByTranscript(escapeSearchPattern(query))
      .then(ids => { if (alive) setResult({ query, ids }); })
      .catch(err => console.warn('Transcript search failed:', err));
    return () => { alive = false; };
  }, [query, hasQuery, rescanKey]);

  return hasQuery && result?.query === query ? result.ids : null;
};
