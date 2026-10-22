import React from 'react';

interface Props {
  appLang: string;
  hasBatchStarted: boolean;
  progress: number;
  etaSeconds: number | null;
  batchCountdown: number;
}

// Progress bar with ETA, plus the countdown shown between files
export const BatchProgressStatus = ({ appLang, hasBatchStarted, progress, etaSeconds, batchCountdown }: Props) => (
  <>
        {/* Progress Bar and ETA */}
        {hasBatchStarted && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {appLang === 'bn' ? 'অগ্রগতি' : 'Progress'}
              </span>
              <span className="text-[10px] font-bold text-indigo-400">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500">
                {etaSeconds !== null ? (
                  <>
                    {appLang === 'bn' ? 'আনুমানিক সময় বাকি: ' : 'Estimated time remaining: '}
                    <span className="font-medium text-slate-300">
                      {etaSeconds < 60 
                        ? (appLang === 'bn' ? `~${etaSeconds} সেকেন্ড` : `~${etaSeconds}s`) 
                        : (appLang === 'bn' ? `~${Math.floor(etaSeconds / 60)} মি ${etaSeconds % 60} সে` : `~${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s`)}
                    </span>
                  </>
                ) : (
                  appLang === 'bn' ? 'সময় হিসাব করা হচ্ছে...' : 'Calculating time...'
                )}
              </span>
            </div>
          </div>
        )}

        {/* Countdown Timer */}
        {batchCountdown > 0 && (
          <div className="mb-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center animate-pulse">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
              {appLang === 'bn' ? 'পরবর্তী ফাইল শুরু হচ্ছে' : 'Next file starting in'}
            </span>
            <span className="text-3xl font-black text-indigo-500 tabular-nums">
              {batchCountdown}s
            </span>
          </div>
        )}
  </>
);
