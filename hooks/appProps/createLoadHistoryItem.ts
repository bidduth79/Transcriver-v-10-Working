import { loadAudioFromStore } from '../../utils/audioUtils';
import { useHistoryStore } from '../useHistoryStore';
import { loadHistoryTranscript } from '../history/useHistoryTranscript';

// Opens a saved transcript: shows its text, marks it as opened, restores its audio,
// and (optionally) jumps to a keyword shortly after the transcript renders.
export const createLoadHistoryItem = (core: any, beforeLoad?: () => void) =>
  async (item: any, searchKeyword?: string) => {
    // List items are light; the saved transcript is read from IndexedDB
    core.setTranscript(item.transcript ?? await loadHistoryTranscript(item.id));
    core.setStatus('completed');
    core.setTranscriptMeta({ name: item.fileName, duration: item.duration, channelName: item.channelName, date: item.publishedDate });
    core.setActiveHistoryId(item.id);
    beforeLoad?.();

    if (!item.hasBeenOpened) {
      useHistoryStore.getState().setHistory(prev =>
        prev.map(h => h.id === item.id ? { ...h, hasBeenOpened: true } : h)
      );
    }

    await loadAudioFromStore(item, core.setFile, core.setFileMeta, core.setFileUrl, core.setTranscriptMeta, core.fileUrl || undefined);

    if (searchKeyword) {
      setTimeout(() => {
        core.setSearchTerm(searchKeyword);
      }, 100);
    }
  };
