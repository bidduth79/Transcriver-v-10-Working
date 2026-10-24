import React from 'react';
import type { HistoryListData } from '../hooks/useHistoryListData';
import { toDateKey } from '../utils/historyListUtils';
import { fetchHistoryDaysFromCloud } from '../../../services/firebaseSync/historyRangePull';
import type { Translations } from '../../../translations';

interface Props {
  t: Translations;
  list: HistoryListData;
  isDark: boolean;
  appLang: string;
}

export const HistoryDatePicker = ({ t, list, isDark, appLang }: Props) => {
  const {
    viewDate, setViewDate, isLoadingDate, setIsLoadingDate, setIsDatePickerOpen,
    calendarDays, availableDateStrings, flatItems, rowVirtualizer, scrollToGroupWhenListed,
  } = list;
  const isTodayStr = toDateKey(new Date());

  return (
          <div className={`absolute top-[76px] right-[36px] w-[220px] overflow-hidden rounded-2xl shadow-2xl border z-[9999] flex flex-col ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} `} onClick={(e) => e.stopPropagation()}>
            <div className="p-2.5 relative">
              {isLoadingDate && (
                  <div className="absolute inset-0 bg-inherit/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3 rounded-2xl">
                    <svg className="w-5 h-5 text-[#10b981] animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
              )}

              {/* Header */}
              <div className="flex justify-between items-center mb-2">
                <span className={`text-[13px] font-bold pl-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {viewDate.toLocaleDateString(appLang === 'bn' ? 'bn-IN' : 'en-US', { month: 'long', year: 'numeric' })}
                </span>
                <div className="flex gap-0.5">
                  <button onClick={(e) => { e.stopPropagation(); setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)); }} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)); }} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>

              {/* Weekdays */}
              <div className="grid grid-cols-7 gap-1 mb-1.5 text-center border-b pb-1.5 border-slate-500/20">
                {(appLang === 'bn' ? ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map(day => (
                  <span key={day} className="text-[9px] font-medium text-slate-500">{day}</span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 gap-y-1.5 text-center">
                {calendarDays.map((calDay, i) => {
                    const calDayStr = calDay.dateStr;
                    const hasHistory = availableDateStrings.has(calDayStr);
                    const isToday = calDayStr === isTodayStr;

                    return (
                    <button
                      key={i}
                      disabled={isLoadingDate}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsLoadingDate(true);
                        // A past day with nothing saved locally is brought from the cloud (only that day is read)
                        if (!hasHistory && calDay.date <= new Date()) {
                          fetchHistoryDaysFromCloud(calDay.date).catch(() => 0).then(added => {
                            if (added > 0) scrollToGroupWhenListed(calDayStr);
                            setIsDatePickerOpen(false);
                            setIsLoadingDate(false);
                          });
                          return;
                        }
                        const index = flatItems.findIndex(i => i.type === 'header' && i.group === calDayStr);
                        setTimeout(() => {
                            if (index !== -1) {
                                rowVirtualizer.scrollToIndex(index, { align: 'start' });
                            }
                            setIsDatePickerOpen(false);
                            setIsLoadingDate(false);
                        }, 50);
                      }}
                      title={hasHistory ? t.hasHistory : ''}
                      className={`
                        w-6 h-6 mx-auto flex items-center justify-center rounded-full text-[10px] transition-all relative
                        ${!calDay.isCurrentMonth ? (isDark ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium') : (isDark ? 'text-slate-200 font-semibold' : 'text-slate-700 font-semibold')}
                        ${isToday
                            ? 'bg-[#10b981] text-white hover:bg-[#059669]'
                            : 'hover:bg-slate-200 dark:hover:bg-slate-700'
                        }
                      `}
                    >
                      {calDay.day}
                      {hasHistory && !isToday && (
                          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#10b981]"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
  );
};
