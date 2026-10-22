import React from 'react';
import { formatQuotaNumber } from './quotaStats';

interface Props {
  title: string;
  peak: number;
  peakLabel: React.ReactNode;
  peakColor: string;
  barColor: { dark: string; light: string };
  limit: number;
  history: number[];
  unit: string;
  ageUnit: 'mins' | 'days';
  barGap: string;
  isDark: boolean;
}

// One "peak usage" card: dashed limit line plus a bar per minute/day (oldest first)
export const PeakUsageChart = ({ title, peak, peakLabel, peakColor, barColor, limit, history, unit, ageUnit, barGap, isDark }: Props) => (
          <div className={`p-4 rounded-xl border flex flex-col justify-between h-32 relative group overflow-hidden ${isDark ? 'border-slate-700/50 bg-[#1e1e1e]' : 'border-slate-200 bg-white'}`}>
            <div className="flex justify-between items-start relative z-10">
                <span className="text-xs font-medium text-slate-500">{title}</span>
                {peak > 0 && <span className={`text-lg font-black ${peakColor} opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 bg-inherit pl-2`}>{peakLabel}</span>}
            </div>
            <div className="flex-1 relative mt-2">
              <div className="absolute top-2 w-full border-t border-dashed border-red-500/50"></div>
              <span className="absolute top-0 left-0 bg-red-500 text-white text-[8px] font-bold px-1 rounded-sm">Limit</span>
              <span className="absolute top-0 right-0 text-slate-400 text-[10px]">{formatQuotaNumber(limit)}</span>

              <div className={`absolute bottom-0 w-full h-12 flex items-end justify-between ${barGap}`}>
                {history.map((val, i) => (
                    <div key={i} className={`flex-1 rounded-t-sm transition-all ${val > 0 ? (isDark ? barColor.dark : barColor.light) : (isDark ? 'bg-slate-800' : 'bg-slate-100')}`} style={{ height: val > 0 ? `${Math.max(10, Math.min(100, (val / limit) * 100))}%` : '2px' }} title={`${history.length - 1 - i} ${ageUnit} ago: ${val} ${unit}`}></div>
                ))}
              </div>
              <div className="absolute bottom-0 w-full border-t border-slate-300 dark:border-slate-700"></div>
              <span className="absolute bottom-[-16px] right-0 text-slate-400 text-[10px]">0</span>
            </div>
          </div>
);
