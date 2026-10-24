import React from 'react';
import type { ActiveColors } from '../../../hooks/useAppTheme';

interface Props {
  item: any;
  isActive: boolean;
  isDark: boolean;
  activeColors: ActiveColors;
  formatProcessingTime: (t: string) => string;
}

// Duration, BGB remark and processing time
export const HistoryCardStatsRow = ({ item, isActive, isDark, activeColors, formatProcessingTime }: Props) => (
        <div className={`flex items-center justify-between border-t border-dashed pt-1.5 mt-0.5 ${isActive ? (isDark ? 'border-green-500/30' : 'border-green-300') : 'border-current/20'}`}>
            <div className="flex items-center gap-1.5">
                <span className="opacity-70 group-hover:opacity-100 transition-opacity flex items-center gap-1" title="File Duration">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {item.duration}
                </span>
                {item.bgbRemark && (
                    <span className={`text-[8px] font-black uppercase tracking-wider px-1 rounded ${
                        item.bgbRemark === 'Positive' ? 'text-green-500 bg-green-500/10' :
                        item.bgbRemark === 'Negative' ? 'text-red-500 bg-red-500/10' :
                        'text-yellow-500 bg-yellow-500/10'
                    }`}>
                        {item.bgbRemark}
                    </span>
                )}
            </div>
            <span className={`${isActive ? (isDark ? 'text-green-300' : 'text-green-600') : activeColors.text} flex items-center gap-1`} title="Processing Time">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              {formatProcessingTime(item.timeTaken)}
            </span>
        </div>
);
