import React from 'react';
import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react';
import { useBackgroundJobStore } from '../../../hooks/transcription/useBackgroundJobStore';
import { useTranscriptionStore } from '../../../hooks/transcription/useTranscriptionStore';
import { useHistoryStore } from '../../../hooks/useHistoryStore';
import { MODAL_LAYER } from '../../../constants/modalLayers';
import { uiText } from '../../../utils/uiText';
import type { HistoryItem, TranscriptMeta } from '../../../types';

interface Props {
  appLang: 'bn' | 'en';
  openHistoryItem: (item: HistoryItem) => void;
  setTranscriptMeta: (meta: TranscriptMeta | null) => void;
}

// A transcription that goes on while a saved transcript is open: its progress, then its result
export const BackgroundJobPill = ({ appLang, openHistoryItem, setTranscriptMeta }: Props) => {
  const { running, inBackground, finished, setInBackground, setFinished } = useBackgroundJobStore();
  const progress = useTranscriptionStore(state => state.progress);
  const showRunning = inBackground && running;
  if (!showRunning && !finished) return null;

  // Back to the processing screen of the running job
  const showJob = () => {
    if (!running) return;
    const screen = useTranscriptionStore.getState();
    if (running.file) {
      screen.setFile(running.file);
      screen.setFileUrl(URL.createObjectURL(running.file));
    }
    screen.setFileMeta(running.meta);
    screen.setTranscript('');
    screen.setStatus('processing');
    useHistoryStore.getState().setActiveHistoryId(null);
    setTranscriptMeta(null);
    setInBackground(false);
  };

  const openFinished = () => {
    const item = useHistoryStore.getState().history.find(h => h.id === finished?.historyId);
    setFinished(null);
    if (item) openHistoryItem(item);
  };

  const dismiss = () => {
    setFinished(null);
    if (!running) setInBackground(false);
  };

  const row = 'flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold bg-slate-900 border-white/20 text-white max-w-sm';
  const button = 'px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shrink-0';

  return (
    <div className={`fixed bottom-24 right-6 ${MODAL_LAYER.minimized} flex flex-col gap-2 items-end`} role="status">
      {showRunning && (
        <div className={row}>
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
          <span className="truncate">{uiText(appLang, 'backgroundRunning')}: {running.name}</span>
          <span className="tabular-nums text-indigo-300 shrink-0">{Math.round(progress)}%</span>
          <button type="button" onClick={showJob} className={button}>{uiText(appLang, 'backgroundShow')}</button>
        </div>
      )}
      {finished && (
        <div className={row} title={finished.error}>
          {finished.error
            ? <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          <span className="truncate">
            {uiText(appLang, finished.error ? 'backgroundFailed' : 'backgroundDone')}: {finished.name}
          </span>
          {finished.historyId && (
            <button type="button" onClick={openFinished} className={button}>{uiText(appLang, 'backgroundOpen')}</button>
          )}
          <button type="button" onClick={dismiss} aria-label={uiText(appLang, 'close')} className="p-1 rounded-lg hover:bg-white/10 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
