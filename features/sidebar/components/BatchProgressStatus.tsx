import React from 'react';
import { uiText } from '../../../utils/uiText';

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
                {uiText(appLang, 'progress')}
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
                    {uiText(appLang, 'estimatedTimeRemaining')}
                    <span className="font-medium text-slate-300">
                      {etaSeconds < 60 
                        ? (uiText(appLang, 'etaSeconds', { etaSeconds })) 
                        : (uiText(appLang, 'etaMinutesSeconds', { minutes: Math.floor(etaSeconds / 60), seconds: etaSeconds % 60 }))}
                    </span>
                  </>
                ) : (
                  uiText(appLang, 'calculatingTime')
                )}
              </span>
            </div>
          </div>
        )}

        {/* Countdown Timer */}
        {batchCountdown > 0 && (
          <div className="mb-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center animate-pulse">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
              {uiText(appLang, 'nextFileStartingIn')}
            </span>
            <span className="text-3xl font-black text-indigo-500 tabular-nums">
              {batchCountdown}s
            </span>
          </div>
        )}
  </>
);
