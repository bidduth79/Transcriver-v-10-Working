import React from 'react';
import type { HistoryItem } from '../../../types';
import type { LoadHistoryItem } from '../historyCardTypes';

interface Props {
  item: HistoryItem;
  sensitiveMatches: string[];
  loadHistoryItem: LoadHistoryItem;
}

// First matched keyword (+N); hovering expands the full list. Clicking a word opens the item at it.
export const SensitiveMatchBadge = ({ item, sensitiveMatches, loadHistoryItem }: Props) => (
                    <div className="relative group/badge flex flex-col items-end z-10">
                      {/* Default View: Shows only the first match or a summary */}
                      <div className="flex gap-1 justify-end transition-opacity duration-300 group-hover/badge:opacity-0 group-hover/badge:invisible">
                        <span 
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            loadHistoryItem(item, sensitiveMatches[0]);
                          }}
                          className="shrink-0 px-1.5 py-0.5 bg-red-600 hover:bg-red-500 cursor-pointer transition-colors text-white text-[8px] font-black rounded uppercase tracking-wider animate-pulse"
                        >
                            {sensitiveMatches[0]}
                        </span>
                        {sensitiveMatches.length > 1 && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-red-600/80 text-white text-[8px] font-black rounded uppercase tracking-wider">
                              +{sensitiveMatches.length - 1}
                          </span>
                        )}
                      </div>

                      {/* Expanded View: Shows all matches vertically on hover */}
                      <div className="flex flex-col gap-1 items-end opacity-0 invisible translate-y-[10px] transition-all duration-300 group-hover/badge:opacity-100 group-hover/badge:visible group-hover/badge:translate-y-0 bg-slate-900/90 p-1.5 rounded-lg shadow-xl border border-red-500/30 absolute bottom-full right-0 mb-1 min-w-max">
                        {sensitiveMatches.map((match: string, idx: number) => (
                          <span 
                            key={idx} 
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                loadHistoryItem(item, match);
                            }}
                            className="shrink-0 px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[8px] font-black rounded uppercase tracking-wider cursor-pointer transition-colors"
                          >
                              {match}
                          </span>
                        ))}
                      </div>
                    </div>
);
