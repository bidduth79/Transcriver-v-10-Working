import React from 'react';
import { formatQuotaNumber } from './quotaStats';

interface Props {
  percent: number;
  value: number;
  limit: number;
  label: string;
  isDark: boolean;
}

// Small usage bar: grey normally, orange above 80%, red at 100%
export const QuotaMiniProgress = ({ percent, value, limit, label, isDark }: Props) => {
  const isDanger = percent >= 100;
  const isWarning = percent > 80;

  // Number on top, bar below at full column width, so narrow columns never wrap or cut the numbers
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-bold text-slate-400 uppercase md:hidden">{label}</span>
      <span className={`text-xs font-medium font-mono whitespace-nowrap ${isDanger ? 'text-red-500' : isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        {formatQuotaNumber(value)} / {formatQuotaNumber(limit)}
      </span>
      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
        <div
          className={`h-full transition-all duration-500 absolute left-0 ${isDanger ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-slate-500 dark:bg-slate-400'}`}
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
};
