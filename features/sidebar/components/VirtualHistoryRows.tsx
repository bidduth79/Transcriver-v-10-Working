import React from 'react';
import { HistoryItemCard } from '../HistoryItemCard';
import type { HistoryListData } from '../hooks/useHistoryListData';
import type { ActiveColors } from '../../../hooks/useAppTheme';
import type { LoadHistoryItem } from '../historyCardTypes';
import type { DeleteHistoryItem } from '../historyCardTypes';
import type { ToggleFavorite } from '../historyCardTypes';
import type { GetSensitiveMatches } from '../historyCardTypes';

interface Props {
  list: HistoryListData;
  activeColors: ActiveColors;
  cardProps: {
    activeHistoryId: string | null;
    loadHistoryItem: LoadHistoryItem;
    onDeleteHistoryItem: DeleteHistoryItem;
    toggleFavorite?: ToggleFavorite;
    isDark: boolean;
    activeColors: ActiveColors;
    appLang: string;
    getSensitiveMatches?: GetSensitiveMatches;
  };
}

// Absolutely-positioned rows (date headers + history cards) driven by the virtualizer
export const VirtualHistoryRows = ({ list, activeColors, cardProps }: Props) => {
  const { flatItems, rowVirtualizer } = list;
  return (
             <div
               style={{
                 height: `${rowVirtualizer.getTotalSize()}px`,
                 width: '100%',
                 position: 'relative'
               }}
             >
               {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                 const flatItem = flatItems[virtualRow.index];
                 if (!flatItem) return null;
                 if (flatItem.type === 'header') {
                   return (
                     <div
                       key={virtualRow.key}
                       id={`history-group-${flatItem.group.replace(/[\s\/,]+/g, '-')}`}
                       className="w-full flex justify-center py-2 z-30 pointer-events-none"
                       style={{
                         position: 'absolute',
                         top: 0,
                         left: 0,
                         height: '44px',
                         transform: `translateY(${virtualRow.start}px)`
                       }}
                     >
                       <div className="flex items-center gap-2">
                         <span className="bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-black px-4 py-1.5 rounded-full border border-white/10 shadow-lg uppercase tracking-widest relative z-30">
                           {flatItem.group}
                         </span>
                         <span className={`${activeColors?.primary || 'bg-indigo-600'} backdrop-blur-md text-white text-[10px] font-black px-2 py-1.5 rounded-full border border-white/20 shadow-lg shadow-black/10 relative z-30`}>
                           {flatItem.count}
                         </span>
                       </div>
                     </div>
                   );
                 }
                 const { item, isDuplicate } = flatItem;
                 return (
                     <div
                       key={virtualRow.key}
                       style={{
                         position: 'absolute',
                         top: 0,
                         left: 0,
                         width: '100%',
                         transform: `translateY(${virtualRow.start}px)`
                       }}
                     >
                       <div className="pb-3">
                         <HistoryItemCard item={item} isDuplicate={isDuplicate} {...cardProps} />
                       </div>
                     </div>
                 );
               })}
              </div>
  );
};
