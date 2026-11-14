import { useEffect, useState } from 'react';
import { fixPunctuation } from '../../../hooks/transcription/punctuationFix';
import { isTranscribeModel } from '../../../hooks/transcription/transcribeModel';
import { saveHistoryTranscript } from '../../../hooks/history/saveHistoryTranscript';
import { getActiveProvider, getActiveModel } from '../../../services/ApiKeyManager';
import { DEFAULT_MODEL } from '../../../constants/aiModels';
import { messageOf } from '../../../utils/errorMessage';
import { uiText } from '../../../utils/uiText';
import type { ToastType } from '../../../hooks/useToast';

interface Options {
  transcript: string;
  setTranscript: (text: string) => void;
  activeHistoryId: string | null;
  appLang: string;
  addToast: (message: string, type: ToastType) => void;
}

// "Fix punctuation" on the open transcript, saved to its history item, with one step back for this session.
// The chosen model is asked; a transcribe model (audio only) gives way to the default model for this text task.
export const usePunctuationFix = ({ transcript, setTranscript, activeHistoryId, appLang, addToast }: Options) => {
  const [running, setRunning] = useState(false);
  const [before, setBefore] = useState<string | null>(null);

  // Another transcript was opened: the step back belongs to the one before
  useEffect(() => setBefore(null), [activeHistoryId]);

  const run = async () => {
    if (!transcript || running) return;
    setRunning(true);
    try {
      const provider = await getActiveProvider();
      if (!provider) throw new Error(uiText(appLang, 'modelFinderNoKey'));
      const chosen = provider.model || getActiveModel();
      const result = await fixPunctuation(transcript, provider.key, isTranscribeModel(chosen) ? DEFAULT_MODEL : chosen);
      if (result.text !== transcript) {
        setBefore(transcript);
        setTranscript(result.text);
        await saveHistoryTranscript(activeHistoryId, result.text);
      }
      addToast(uiText(appLang, 'punctuationDone', { changed: result.changedLines, kept: result.keptLines }), result.keptLines > 0 ? 'warning' : 'success');
    } catch (err) {
      addToast(uiText(appLang, 'punctuationFailed', { message: (messageOf(err) ?? '').slice(0, 160) }), 'error');
    } finally {
      setRunning(false);
    }
  };

  const undo = async () => {
    if (before === null) return;
    setTranscript(before);
    await saveHistoryTranscript(activeHistoryId, before);
    setBefore(null);
    addToast(uiText(appLang, 'punctuationUndone'), 'info');
  };

  return { running, canUndo: before !== null, run, undo };
};
