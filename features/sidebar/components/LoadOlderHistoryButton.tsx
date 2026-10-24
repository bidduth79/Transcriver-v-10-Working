import React, { useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isFirebaseConfigured } from '../../../services/firebase';
import { fetchOlderHistoryFromCloud } from '../../../services/firebaseSync/historyRangePull';
import type { Translations } from '../../../translations';
import type { HistoryItem } from '../../../types';

interface Props {
  t: Translations;
  isDark: boolean;
  appLang: string;
  history: HistoryItem[];
}

// Brings the week before the oldest item from the cloud; older history is read only when asked for
export const LoadOlderHistoryButton = ({ t, isDark, appLang, history }: Props) => {
  const [isLoading, setIsLoading] = useState(false);
  if (!isFirebaseConfigured) return null;

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const oldest = history.reduce<string | undefined>((min, h) => (h?.date && (!min || h.date < min) ? h.date : min), undefined);
      const added = await fetchOlderHistoryFromCloud(oldest);
      if (added) {
        toast.success(appLang === 'bn' ? `${added}${t.olderItemsAdded}` : `${added} ${t.olderItemsAdded}`);
      } else if (added === 0) {
        toast.info(t.noOlderCloudData);
      } else {
        toast.error(t.olderLoadFailed);
      }
    } catch (err) {
      console.warn('Loading older history failed:', err);
      toast.error(t.olderLoadFailed);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all disabled:opacity-50 ${isDark ? 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
    >
      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <History className="w-3.5 h-3.5" />}
      {t.loadOlderFromCloud}
    </button>
  );
};
