import React from 'react';
import { FolderSync, Pause, Play, X } from 'lucide-react';
import { isFolderWatchSupported } from '../../../services/watchFolder';
import { useFolderWatchStore, chooseWatchFolder, allowWatchFolder, pauseWatchFolder, stopWatchFolder } from '../../../hooks/useFolderWatch';
import { uiText } from '../../../utils/uiText';

interface Props {
  isDark: boolean;
  appLang: string;
}

// Icon in the input row (a click picks the folder, or another one); shown only where the browser can watch a folder (desktop Chrome and Edge)
export const WatchFolderButton = ({ isDark, appLang }: Props) => {
  const status = useFolderWatchStore(state => state.status);
  if (!isFolderWatchSupported()) return null;

  const isOn = status === 'watching';
  return (
    <button
      type="button"
      onClick={() => chooseWatchFolder(appLang)}
      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md group cursor-pointer ${isOn ? 'bg-teal-600 text-white ring-2 ring-offset-2 ring-teal-200' : (isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-white hover:bg-slate-50 text-slate-400')}`}
      title={uiText(appLang, 'watchFolderButton')}
    >
      <FolderSync className="w-5 h-5 transition-transform group-hover:scale-110" />
    </button>
  );
};

// The watched folder's name, with buttons to pause or turn it back on, to allow it again after a reload,
// and to stop watching (forgets the folder)
export const WatchFolderStatus = ({ isDark, appLang }: Props) => {
  const handle = useFolderWatchStore(state => state.handle);
  const status = useFolderWatchStore(state => state.status);
  if (status === 'off' || !handle) return null;

  const tone = status === 'watching'
    ? `border-teal-500/30 bg-teal-500/10 ${isDark ? 'text-teal-300' : 'text-teal-700'}`
    : status === 'paused'
      ? `border-slate-500/30 bg-slate-500/10 ${isDark ? 'text-slate-300' : 'text-slate-600'}`
      : `border-amber-500/30 bg-amber-500/10 ${isDark ? 'text-amber-300' : 'text-amber-700'}`;
  const label = status === 'watching' ? 'watchFolderWatching' : status === 'paused' ? 'watchFolderPaused' : 'watchFolderNeedsPermission';
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold ${tone}`}>
      {status === 'watching' && <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shrink-0" />}
      <span className="flex-1 min-w-0 truncate" title={handle.name}>
        {uiText(appLang, label, { name: handle.name })}
      </span>
      {status === 'needsPermission' && (
        <button type="button" onClick={() => allowWatchFolder(appLang)} className="shrink-0 px-2 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 cursor-pointer">
          {uiText(appLang, 'watchFolderAllow')}
        </button>
      )}
      {status === 'watching' && (
        <button type="button" onClick={() => pauseWatchFolder(appLang)} title={uiText(appLang, 'watchFolderPause')} className="shrink-0 p-1 rounded-lg hover:bg-black/10 cursor-pointer">
          <Pause className="w-3.5 h-3.5" />
        </button>
      )}
      {status === 'paused' && (
        <button type="button" onClick={() => allowWatchFolder(appLang)} title={uiText(appLang, 'watchFolderResume')} className="shrink-0 p-1 rounded-lg hover:bg-black/10 cursor-pointer">
          <Play className="w-3.5 h-3.5" />
        </button>
      )}
      <button type="button" onClick={stopWatchFolder} title={uiText(appLang, 'watchFolderStop')} className="shrink-0 p-1 rounded-lg hover:bg-black/10 cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
