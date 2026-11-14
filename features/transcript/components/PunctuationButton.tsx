import React from 'react';
import { PenLine, Undo2 } from 'lucide-react';
import { usePunctuationFix } from '../hooks/usePunctuationFix';
import type { ToastType } from '../../../hooks/useToast';
import { uiText } from '../../../utils/uiText';

interface Props {
  transcript: string;
  setTranscript: (text: string) => void;
  activeHistoryId: string | null;
  appLang: string;
  addToast: (message: string, type: ToastType) => void;
}

// "Fix punctuation" in the transcript toolbar, and "Undo" right after it
export const PunctuationButton = (props: Props) => {
  const { running, canUndo, run, undo } = usePunctuationFix(props);
  const button = 'flex items-center gap-1 px-2.5 py-1 min-h-6 rounded-xl text-[10px] font-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait';
  return (
    <div className="flex items-center bg-white/5 rounded-2xl p-0.5 border border-white/10">
      <button type="button" onClick={run} disabled={running} title={uiText(props.appLang, 'punctuationHint')} className={`${button} text-white/70 hover:text-white`}>
        <PenLine className={`w-3 h-3 ${running ? 'animate-pulse' : ''}`} />
        {uiText(props.appLang, running ? 'punctuationRunning' : 'punctuationFix')}
      </button>
      {canUndo && !running && (
        <button type="button" onClick={undo} title={uiText(props.appLang, 'punctuationUndoHint')} className={`${button} text-amber-300 hover:text-amber-200`}>
          <Undo2 className="w-3 h-3" />
          {uiText(props.appLang, 'punctuationUndo')}
        </button>
      )}
    </div>
  );
};
