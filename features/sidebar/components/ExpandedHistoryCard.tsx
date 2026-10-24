import React from 'react';
import { HistoryPreviewOverlay } from './HistoryPreviewOverlay';
import type { Translations } from '../../../translations';
import type { ActiveColors } from '../../../hooks/useAppTheme';
import type { HistoryItem } from '../../../types';
import type { LoadHistoryItem } from '../historyCardTypes';

interface Props {
  item: HistoryItem;
  t: Translations;
  isDark: boolean;
  activeColors: ActiveColors;
  sensitiveMatches: string[];
  hoveredCardId: string | null;
  setHoveredCardId: (id: string | null) => void;
  loadHistoryItem: LoadHistoryItem;
  formatProcessingTime: (t?: string) => string | undefined;
}

// One history card in the fullscreen grid (red tint + keyword pills when sensitive words were found)
export const ExpandedHistoryCard = ({
  item, t, isDark, activeColors, sensitiveMatches, hoveredCardId, setHoveredCardId, loadHistoryItem, formatProcessingTime
}: Props) => {
                  const isSensitive = sensitiveMatches && sensitiveMatches.length > 0;
                
                const cardBgClass = isSensitive 
                    ? (isDark ? 'bg-red-900/10 border-red-500/30' : 'bg-red-50 border-red-100')
                    : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200');
                
                const innerBorderClass = isSensitive
                    ? (isDark ? 'border-red-500/30 hover:border-red-400' : 'border-red-100 hover:border-red-300')
                    : (isDark ? 'border-slate-700 hover:border-indigo-400/50' : 'border-slate-200 hover:border-indigo-300');

                return (
                <div 
                  className={`relative rounded-[3rem] transition-all duration-500 group overflow-hidden ${cardBgClass}`}
                  onMouseEnter={() => setHoveredCardId(item.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                >
                  <div 
                    onClick={() => loadHistoryItem(item)} 
                    className={`p-8 border h-full flex flex-col cursor-pointer ${innerBorderClass}`}
                  >
                    <div className={`absolute top-0 right-0 w-32 h-32 ${activeColors.soft.replace('bg-', 'bg-opacity-10 bg-')} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                    <div className="mb-6 flex items-start justify-between relative z-10">
                       <div className="flex gap-2 items-center">
                           <div className={`px-3 py-1 ${activeColors.soft} ${activeColors.text} rounded-lg text-[10px] font-black uppercase tracking-widest bn:tracking-normal ring-1 ${activeColors.border.replace('border-', 'border-opacity-20 border-')} transition-transform group-hover:scale-110 group-hover:-rotate-3`}>
                               {item.extension || 'FILE'}
                           </div>
                           {/* Sensitive Match Pill */}
                           {isSensitive && (
                               <div className="flex flex-wrap gap-1">
                                 {sensitiveMatches.slice(0, 2).map((match: string, idx: number) => (
                                   <div 
                                     key={idx} 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       loadHistoryItem(item, match);
                                     }}
                                     className="px-3 py-1 bg-red-600 hover:bg-red-500 cursor-pointer transition-colors text-white rounded-lg text-[10px] font-black uppercase tracking-widest bn:tracking-normal ring-1 ring-red-500 shadow-lg shadow-red-500/20 animate-pulse"
                                   >
                                       {match}
                                   </div>
                                 ))}
                                 {sensitiveMatches.length > 2 && (
                                   <div className="px-3 py-1 bg-red-600/80 text-white rounded-lg text-[10px] font-black uppercase tracking-widest bn:tracking-normal">
                                       +{sensitiveMatches.length - 2}
                                   </div>
                                 )}
                               </div>
                           )}
                       </div>
                       
                       <div className={`text-slate-400 group-hover:${activeColors.text} transition-all duration-500 group-hover:scale-150 group-hover:rotate-12`}>
                          <svg className={`w-6 h-6 ${isSensitive ? 'text-red-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                       </div>
                    </div>
                    <h4 className={`text-sm font-black line-clamp-2 mb-8 uppercase tracking-tight leading-relaxed transition-colors font-stylish-bn group-hover:text-indigo-500 relative z-10 ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.fileName}</h4>
                    <div className="mt-auto pt-6 border-t border-slate-100/50 flex items-center justify-between relative z-10">
                       <div className="flex flex-col group/info-date"><span className="text-[10px] font-black opacity-40 uppercase tracking-widest bn:tracking-normal mb-1.5 group-hover/info-date:opacity-100 transition-opacity">{t.historyLabelDate}</span><span className={`text-[11px] font-black ${isDark ? 'text-white/80' : 'text-slate-600'}`}>{new Date(item.date).toLocaleDateString()}</span></div>
                       <div className="flex flex-col items-end group/info-dur">
                          <span className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1.5 group-hover/info-dur:opacity-100 transition-opacity">DURATION / TIME</span>
                          <div className="flex items-center gap-1.5">
                              <span className={`text-[11px] font-black ${activeColors.text}`}>{item.duration}</span>
                              {item.bgbRemark && (
                                  <span className={`text-[10px] font-black uppercase tracking-wider bn:tracking-normal px-1 rounded ${
                                      item.bgbRemark === 'Positive' ? 'text-green-500 bg-green-500/10' :
                                      item.bgbRemark === 'Negative' ? 'text-red-500 bg-red-500/10' :
                                      'text-yellow-500 bg-yellow-500/10'
                                  }`}>
                                      {item.bgbRemark}
                                  </span>
                              )}
                              <span className={`text-[10px] font-bold opacity-40 ${isDark ? 'text-white' : 'text-slate-600'}`}>({formatProcessingTime(item.timeTaken)})</span>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Scrollable Popup Overlay on Hover */}
                  {hoveredCardId === item.id && (
                    <HistoryPreviewOverlay
                      item={item}
                      isSensitive={isSensitive}
                      sensitiveMatches={sensitiveMatches}
                      isDark={isDark}
                      activeColors={activeColors}
                      loadHistoryItem={loadHistoryItem}
                    />
                  )}
                </div>
              );
};
