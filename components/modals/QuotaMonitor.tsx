import React, { useMemo } from 'react';
import { useQuotaLogs } from './quota/useQuotaLogs';
import { getModelLimits, computeCurrentUsage, computePeakTrends, formatQuotaNumber, quotaLogsFor } from './quota/quotaStats';
import { QuotaMiniProgress } from './quota/QuotaMiniProgress';
import { PeakUsageChart } from './quota/PeakUsageChart';
import { DEFAULT_MODEL } from '../../constants/aiModels';

interface QuotaMonitorProps {
  isDark: boolean;
  appLang: 'en' | 'bn';
  activeColors: any;
}

export const QuotaMonitor: React.FC<QuotaMonitorProps> = ({ isDark, appLang }) => {
  const { logs: allLogs, activeModel, activeKeyTail, tick } = useQuotaLogs();
  // Only the active model's requests on the active key count against this quota
  const logs = useMemo(() => quotaLogsFor(allLogs, activeModel, activeKeyTail), [allLogs, activeModel, activeKeyTail]);

  const limits = getModelLimits(activeModel || DEFAULT_MODEL);
  const usage = computeCurrentUsage(logs, limits, Date.now());

  // Recompute when logs change, and on every refresh tick so the time windows move forward
  const { peakRpm, peakTpm, peakRpd, rpmHistory, tpmHistory, rpdHistory } = useMemo(() => computePeakTrends(logs, Date.now()), [logs, tick]);

  return (
    <div className="flex flex-col h-full space-y-6">

      {/* Header Section like Google AI Studio */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className={`text-xl font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
            {appLang === 'bn' ? 'এপিআই রেট লিমিট' : 'API Rate Limit'}
          </h2>
          <span className="px-2 py-0.5 text-[10px] font-bold border border-slate-300 dark:border-slate-600 rounded-full text-slate-500 dark:text-slate-400">
            Free tier
          </span>
        </div>
      </div>

      <div className={`rounded-xl border flex flex-col overflow-hidden ${isDark ? 'bg-[#1e1e1e] border-slate-700/50' : 'bg-white border-slate-200'}`}>

        {/* Table Header */}
        <div className={`px-4 py-3 border-b flex gap-4 ${isDark ? 'border-slate-700/50 bg-[#252525]' : 'border-slate-200 bg-slate-50'}`}>
          <div className="w-1/3 text-xs font-semibold text-slate-500">Model</div>
          <div className="w-1/4 text-xs font-semibold text-slate-500 hidden md:block">Category</div>
          <div className="w-[15%] text-xs font-semibold text-slate-500">RPM &darr;</div>
          <div className="w-[15%] text-xs font-semibold text-slate-500">TPM</div>
          <div className="w-[15%] text-xs font-semibold text-slate-500">RPD</div>
        </div>

        {/* Table Row */}
        <div className={`px-4 py-4 flex gap-4 items-center transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
          <div className={`w-1/3 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {activeModel || 'Gemini Model'}
          </div>
          <div className="w-1/4 text-xs text-slate-500 hidden md:block">Text-out models</div>
          <div className="w-[15%]">
            <QuotaMiniProgress percent={usage.rpmPercent} value={usage.rpmCount} limit={limits.rpm} label="RPM" isDark={isDark} />
          </div>
          <div className="w-[15%]">
            <QuotaMiniProgress percent={usage.tpmPercent} value={usage.tpmCount} limit={limits.tpm} label="TPM" isDark={isDark} />
          </div>
          <div className="w-[15%]">
            <QuotaMiniProgress percent={usage.rpdPercent} value={usage.rpdCount} limit={limits.rpd} label="RPD" isDark={isDark} />
          </div>
        </div>

        {/* AntiGravity Row (For completeness/fun based on image) */}
        <div className={`px-4 py-4 flex gap-4 items-center opacity-40 border-t ${isDark ? 'border-slate-800 hover:bg-slate-800/30' : 'border-slate-100 hover:bg-slate-50'}`}>
          <div className={`w-1/3 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            Antigravity
          </div>
          <div className="w-1/4 text-xs text-slate-500 hidden md:block">Agents</div>
          <div className="w-[15%]">
            <QuotaMiniProgress percent={0} value={0} limit={60} label="RPM" isDark={isDark} />
          </div>
          <div className="w-[15%]">
            <QuotaMiniProgress percent={0} value={0} limit={100000} label="TPM" isDark={isDark} />
          </div>
          <div className="w-[15%]">
            <QuotaMiniProgress percent={0} value={0} limit={100} label="RPD" isDark={isDark} />
          </div>
        </div>
      </div>

      {/* Peak Usage Trends */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
            <h3 className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {appLang === 'bn' ? 'পিক ইউসেজ ট্রেন্ড' : 'Peak usage trends'}
            </h3>
            {logs.length > 0 && <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full font-bold">Active</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PeakUsageChart
            title="Peak requests per minute (RPM)" peak={peakRpm} peakLabel={peakRpm} peakColor="text-indigo-500"
            barColor={{ dark: 'bg-indigo-500/80 hover:bg-indigo-400', light: 'bg-indigo-500/60 hover:bg-indigo-500' }}
            limit={limits.rpm} history={rpmHistory} unit="RPM" ageUnit="mins" barGap="gap-[2px]" isDark={isDark}
          />
          <PeakUsageChart
            title="Peak input tokens per minute (TPM)" peak={peakTpm} peakLabel={formatQuotaNumber(peakTpm)} peakColor="text-emerald-500"
            barColor={{ dark: 'bg-emerald-500/80 hover:bg-emerald-400', light: 'bg-emerald-500/60 hover:bg-emerald-500' }}
            limit={limits.tpm} history={tpmHistory} unit="TPM" ageUnit="mins" barGap="gap-[2px]" isDark={isDark}
          />
          <PeakUsageChart
            title="Peak requests per day (RPD)" peak={peakRpd} peakLabel={formatQuotaNumber(peakRpd)} peakColor="text-amber-500"
            barColor={{ dark: 'bg-amber-500/80 hover:bg-amber-400', light: 'bg-amber-500/60 hover:bg-amber-500' }}
            limit={limits.rpd} history={rpdHistory} unit="RPD" ageUnit="days" barGap="gap-1" isDark={isDark}
          />
        </div>
      </div>

    </div>
  );
};
