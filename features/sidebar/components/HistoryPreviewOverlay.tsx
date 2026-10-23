import React from 'react';
import { useHistoryTranscript } from '../../../hooks/history/useHistoryTranscript';

interface Props {
  item: any;
  isSensitive: boolean;
  sensitiveMatches: string[];
  isDark: boolean;
  activeColors: any;
  loadHistoryItem: (item: any, searchKeyword?: string) => void;
}

// Hover popup with a scrollable transcript preview; sensitive words are clickable highlights
export const HistoryPreviewOverlay = ({ item, isSensitive, sensitiveMatches, isDark, activeColors, loadHistoryItem }: Props) => {
  // The saved transcript is read from IndexedDB when the preview opens
  const transcript = useHistoryTranscript(item.id, true, item.transcript);
  return (
                    <div 
                      className={`absolute inset-0 z-20 p-6 backdrop-blur-xl transition-all animate-in fade-in duration-300 overflow-hidden flex flex-col ${isDark ? 'bg-slate-900/95' : 'bg-white/95'}`}
                      onClick={(e) => e.stopPropagation()} // Prevent triggering load when interacting with popup text
                    >
                      <div className="flex items-center justify-between mb-3 shrink-0 border-b border-white/10 pb-2">
                        <span className={`text-[9px] font-black uppercase tracking-widest ${activeColors.text}`}>TRANSCRIPT PREVIEW</span>
                        <div onClick={() => loadHistoryItem(item)} className="cursor-pointer p-1.5 bg-white/10 rounded-full hover:bg-indigo-600 hover:text-white transition-all group" title="Open File">
                           <svg className="w-3 h-3 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </div>
                      </div>
                      <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                        <p className={`text-[11px] font-mono leading-relaxed whitespace-pre-wrap ${isDark ? 'text-white/80' : 'text-slate-700'}`}>
                          {(() => {
                             const textContent = transcript || "No transcript content...";
                             if (!isSensitive) return textContent;

                             const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                             const regex = new RegExp(`(${sensitiveMatches.map(escapeRegExp).join('|')})`, 'gi');
                             return textContent.split(regex).map((part: string, i: number) => 
                               sensitiveMatches.some((match: string) => part.toLowerCase() === match.toLowerCase()) ? (
                                 <mark 
                                    key={i} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      loadHistoryItem(item, part);
                                    }}
                                    className="bg-red-500 hover:bg-red-400 cursor-pointer transition-colors text-white px-1 rounded-sm font-bold mx-0.5 animate-pulse"
                                 >
                                   {part}
                                 </mark>
                               ) : part
                             );
                          })()}
                        </p>
                      </div>
                    </div>
);
};
