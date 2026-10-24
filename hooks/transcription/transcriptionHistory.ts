import type { FileMeta, HistoryItem } from '../../types';
import { addToStore, STORES } from '../../services/db';

// File info shown in the sidebar; YouTube downloads add the channel
type SourceMeta = Partial<FileMeta> & { channelName?: string };

export const buildHistoryItem = (inputFile: Blob, inputMetadata: SourceMeta, transcript: string, elapsedSeconds: number) => {
  const fileName = (inputFile as File).name || inputMetadata.name || "audio_file";
  const fileExtension = fileName.includes('.') ? fileName.split('.').pop() : 'mp3';
  return {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    fileName: fileName,
    date: new Date().toISOString(),
    publishedDate: inputMetadata.date,
    duration: inputMetadata.duration || '00:00',
    transcript,
    extension: fileExtension,
    timeTaken: `${elapsedSeconds}s`,
    channelName: inputMetadata.channelName,
    size: inputMetadata.size || `${(inputFile.size / (1024 * 1024)).toFixed(2)} MB`,
    bgbRemark: undefined as string | undefined
  };
};

export type TranscriptionHistoryItem = ReturnType<typeof buildHistoryItem>;

// Update in-memory history together with the completion state, so there is no
// surprise full-app re-render wave a few seconds later while reading/scrolling.
// The list keeps a light item; the transcript is saved to IndexedDB and kept in the small transcript cache.
export const addToInMemoryHistory = async (item: TranscriptionHistoryItem) => {
  try {
    const { useHistoryStore } = await import('../useHistoryStore');
    const { toLightHistoryItem } = await import('../../services/historyRecords');
    const { rememberHistoryTranscript } = await import('../history/useHistoryTranscript');
    rememberHistoryTranscript(item.id, item.transcript);
    const currentHistory = useHistoryStore.getState().history;
    useHistoryStore.getState().setHistory([toLightHistoryItem(item) as unknown as HistoryItem, ...currentHistory]);
  } catch (e) {
    console.warn("In-memory history update notice:", e);
  }
};

// Save directly to local IndexedDB (Firebase sync is paused via setHeavyProcessingActive and only queues the tiny ID string)
export const persistHistoryItem = async (item: TranscriptionHistoryItem) => {
  try {
    await addToStore(STORES.HISTORY, item);
    try {
      const { broadcastHistoryUpdate } = await import('../useBroadcastSync');
      broadcastHistoryUpdate();
    } catch (e) {}
  } catch (e) {
    console.warn("Local history persistence notice:", e);
  }
};

// Optional BGB keyword analysis, scheduled after the UI has settled
export const scheduleBgbAnalysis = (item: TranscriptionHistoryItem, text: string) => {
  if (localStorage.getItem('bgbAnalysisEnabled') !== 'true' || !text) return;
  const itemForBgb = { ...item };

  setTimeout(async () => {
    try {
      const { getSensitiveKeywords } = await import('../../utils/sensitiveKeywords');
      const { analyzeTranscriptForBgb } = await import('../../services/bgbAnalysisService');
      const keywords = getSensitiveKeywords();
      const lower = text.toLowerCase();
      const matches = keywords.filter((kw: string) => lower.includes(kw.toLowerCase()));
      if (matches.length > 0) {
        const result = await analyzeTranscriptForBgb(text, matches);
        if (result?.remark) {
          itemForBgb.bgbRemark = result.remark;
          await addToStore(STORES.HISTORY, itemForBgb);
          // Show the remark right away instead of waiting for a full history reload
          const { useHistoryStore } = await import('../useHistoryStore');
          useHistoryStore.getState().setHistory(prev =>
            prev.map(h => (h.id === itemForBgb.id ? { ...h, bgbRemark: itemForBgb.bgbRemark } : h))
          );
        }
      }
    } catch (e) {
      console.warn("Background cleanup & analysis notice:", e);
    }
  }, 2500);
};
