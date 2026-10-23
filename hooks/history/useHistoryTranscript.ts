import { useEffect, useState } from 'react';
import { getHistoryTranscript } from '../../services/historyRecords';

// Recently shown transcripts (history cards, previews), so scrolling back does not re-read IndexedDB
const MAX_CACHED = 200;
const cache = new Map<string, string>();

export const rememberHistoryTranscript = (id: string, transcript: string) => {
  cache.delete(id);
  cache.set(id, transcript);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
};

export const forgetHistoryTranscripts = () => cache.clear();

export const loadHistoryTranscript = async (id: string) => {
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  const transcript = await getHistoryTranscript(id);
  rememberHistoryTranscript(id, transcript);
  return transcript;
};

/**
 * Transcript text of a saved history item, read from IndexedDB on demand.
 * Uses `inline` when the item still carries its text. Returns '' until loaded or when disabled.
 */
export const useHistoryTranscript = (id: string | undefined, enabled = true, inline?: string) => {
  const [loaded, setLoaded] = useState<{ id?: string; text: string }>({ text: '' });
  const cached = id ? cache.get(id) : undefined;

  useEffect(() => {
    if (!enabled || !id || inline !== undefined || cache.has(id)) return;
    let alive = true;
    loadHistoryTranscript(id)
      .then(text => { if (alive) setLoaded({ id, text }); })
      .catch(() => { if (alive) setLoaded({ id, text: '' }); });
    return () => { alive = false; };
  }, [id, enabled, inline]);

  if (!enabled || !id) return '';
  if (inline !== undefined) return inline;
  return cached ?? (loaded.id === id ? loaded.text : '');
};
