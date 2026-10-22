import React from 'react';
import type { ActivityLogsState } from './useActivityLogs';
import { getStatusColor, safeFormatDate } from './activityLogUtils';

interface Props {
  state: ActivityLogsState;
  isDark: boolean;
}

// Paged list of log cards with a "Load More" button
export const ActivityLogList = ({ state, isDark }: Props) => {
  const { filteredLogs, displayCount, loadMore } = state;
  return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="space-y-3">
                {filteredLogs.length === 0 ? (
                    <div className="text-center py-20 opacity-30">
                        <p className="text-xl font-black uppercase tracking-widest">NO LOGS FOUND</p>
                    </div>
                ) : (
                    <>
                    {filteredLogs.slice(0, displayCount).map(log => {
                        if (!log) return null;
                        return (
                        <div key={log.id || Math.random().toString()} className={`p-5 rounded-2xl border transition-all hover:bg-black/5 flex items-start gap-5 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
                            <div className="flex flex-col items-center gap-2 pt-1 shrink-0 w-24">
                                <span className="text-[10px] font-mono font-bold opacity-50">{safeFormatDate(log.timestamp).date}</span>
                                <span className="text-xs font-mono font-black">{safeFormatDate(log.timestamp).time}</span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getStatusColor(log.status)}`}>{log.status}</span>
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{log.category}</span>
                                </div>
                                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{log.message}</p>
                                {log.details && (
                                    <p className={`text-xs mt-2 font-mono p-2 rounded ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-black/5 text-slate-500'}`}>
                                        {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : log.details}
                                    </p>
                                )}
                            </div>
                        </div>
                        );
                    })}

                    {filteredLogs.length > displayCount && (
                        <div className="flex justify-center pt-4 pb-8">
                            <button
                                onClick={loadMore}
                                className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'}`}
                            >
                                Load More
                            </button>
                        </div>
                    )}
                    </>
                )}
            </div>
        </div>
  );
};
