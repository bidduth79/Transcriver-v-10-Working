import React from 'react';
import type { ActivityLogsState } from './useActivityLogs';

interface Props {
  state: ActivityLogsState;
  isDark: boolean;
}

// Group / status dropdowns, date range and record count
export const ActivityLogFilters = ({ state, isDark }: Props) => {
  const { filterCategory, setFilterCategory, filterStatus, setFilterStatus, dateFrom, setDateFrom, dateTo, setDateTo, filteredLogs } = state;
  return (
        <div className={`p-6 border-b flex flex-wrap gap-4 items-center shrink-0 ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
            <div className="flex gap-2">
                <select className={`px-4 py-2 rounded-xl text-xs font-bold border outline-none focus:ring-2 focus:ring-indigo-500 ${isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="ALL">All Groups</option>
                    <option value="TRANSCRIPTION">Transcription</option>
                    <option value="API_KEY">API Key</option>
                    <option value="REPORT">Report</option>
                    <option value="ANALYSIS">Analysis</option>
                    <option value="SYSTEM">System</option>
                </select>
                <select className={`px-4 py-2 rounded-xl text-xs font-bold border outline-none focus:ring-2 focus:ring-indigo-500 ${isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="ALL">All Status</option>
                    <option value="SUCCESS">Success</option>
                    <option value="ERROR">Error</option>
                    <option value="WARNING">Warning</option>
                </select>
            </div>
            <div className={`h-8 w-px mx-2 ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
            <div className="flex gap-2 items-center">
                <span className="text-[10px] font-black uppercase text-slate-400">Date:</span>
                <input type="date" className={`px-3 py-2 rounded-xl text-xs font-bold border ${isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <span className="text-slate-400">-</span>
                <input type="date" className={`px-3 py-2 rounded-xl text-xs font-bold border ${isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`} value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className={`ml-auto px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                {filteredLogs.length} Records
            </div>
        </div>
  );
};
