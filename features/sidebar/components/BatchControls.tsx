import React from 'react';

interface Props {
  appLang: string;
  hasBatchStarted: boolean;
  isBatchProcessing: boolean;
  isBatchPaused: boolean;
  failedCount: number;
  retryFailedFiles: () => void;
  startBatch: () => void;
  pauseBatch: () => void;
  resumeBatch: () => void;
  skipNextBatchFile: () => void;
  cancelBatch: () => void;
}

// Start / retry-failed before the run; pause-resume / skip while running; cancel always
export const BatchControls = ({
  appLang, hasBatchStarted, isBatchProcessing, isBatchPaused, failedCount,
  retryFailedFiles, startBatch, pauseBatch, resumeBatch, skipNextBatchFile, cancelBatch
}: Props) => (
        <div className="flex flex-wrap gap-2 mt-2 pt-4 border-t border-slate-500/10">
          {!hasBatchStarted ? (
            <>
              {failedCount > 0 && !isBatchProcessing ? (
                <button onClick={retryFailedFiles} className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-blue-500/25">
                  {appLang === 'bn' ? 'ব্যর্থ ফাইল পুনরায় চেষ্টা' : 'Retry Failed'}
                </button>
              ) : (
                <button onClick={startBatch} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-emerald-500/25">
                  {appLang === 'bn' ? 'শুরু করুন' : 'Start Batch'}
                </button>
              )}
            </>
          ) : (
            <>
              {isBatchPaused ? (
                <button onClick={resumeBatch} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-emerald-500/25">
                  {appLang === 'bn' ? 'চালু' : 'Resume'}
                </button>
              ) : (
                <button onClick={pauseBatch} className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-amber-500/25">
                  {appLang === 'bn' ? 'পজ' : 'Pause'}
                </button>
              )}
              <button onClick={skipNextBatchFile} className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-indigo-500/25">
                {appLang === 'bn' ? 'স্কিপ' : 'Skip'}
              </button>
            </>
          )}
          <button onClick={cancelBatch} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-red-500/25">
            {appLang === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>
        </div>
);
