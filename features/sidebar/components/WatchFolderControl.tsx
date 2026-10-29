import React from 'react';
import { FolderSync, Pause, Play, X } from 'lucide-react';
import { isFolderWatchSupported } from '../../../services/watchFolder';
import { useFolderWatchStore, chooseWatchFolder, allowWatchFolder, pauseWatchFolder, stopWatchFolder, type FolderWatchMode } from '../../../hooks/useFolderWatch';
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

// Auto (transcribe new files at once) or Review (list them for the user to start)
const ModeSwitch = ({ isDark, appLang }: Props) => {
  const mode = useFolderWatchStore(state => state.mode);
  const setMode = useFolderWatchStore(state => state.setMode);
  const option = (value: FolderWatchMode, label: 'watchFolderModeAuto' | 'watchFolderModeReview', hint: 'watchFolderModeAutoHint' | 'watchFolderModeReviewHint') => (
    <button
      type="button"
      onClick={() => setMode(value)}
      title={uiText(appLang, hint)}
      className={`flex-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
        mode === value ? 'bg-teal-600 text-white' : (isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-200')
      }`}
    >
      {uiText(appLang, label)}
    </button>
  );
  return (
    <div className={`flex gap-1 p-1 rounded-xl border ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-100'}`}>
      {option('auto', 'watchFolderModeAuto', 'watchFolderModeAutoHint')}
      {option('review', 'watchFolderModeReview', 'watchFolderModeReviewHint')}
    </div>
  );
};

// The watched folder's name, with buttons to pause or turn it back on, to allow it again after a reload,
// and to stop watching (forgets the folder); below it the Auto / Review choice
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
    <div className="flex flex-col gap-1.5">
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
      <ModeSwitch isDark={isDark} appLang={appLang} />
    </div>
  );
};
