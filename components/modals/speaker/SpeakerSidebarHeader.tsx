import React from 'react';
import { SpeakerProfile } from '../../../types/speaker';
import { uiText } from '../../../utils/uiText';

interface Props {
  profile: SpeakerProfile | null;
  speakerName: string;
  isLoading: boolean;
  isDark: boolean;
  appLang: string;
  onRefresh?: () => void;
  onClose: () => void;
}

// Name/role, copy-summary, refresh and close buttons
export const SpeakerSidebarHeader = ({ profile, speakerName, isLoading, isDark, appLang, onRefresh, onClose }: Props) => {
  const dbStats = profile?.databaseStats;
  return (
        <div className={`p-4 flex justify-between items-center border-b shrink-0 ${isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-white/90'} backdrop-blur-md`}>
          <div className="flex items-center gap-2.5 truncate pr-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <div className="truncate">
              <h2 className="text-base font-bold tracking-wide truncate">
                {isLoading ? (uiText(appLang, 'fetchingProfile')) : profile?.name || speakerName}
              </h2>
              {profile?.customNote?.roleOrDesignation && (
                <p className="text-xs text-indigo-400 font-medium truncate">{profile.customNote.roleOrDesignation}</p>
              )}
            </div>
          </div>

          <div className="flex gap-1.5 items-center">
            {profile && (
              <button 
                onClick={() => {
                  const summaryText = `${profile.name}\n\nপরিচয়:\n${profile.description}\n\nবিজিবি ও সীমান্ত সংক্রান্ত সার্বিক দৃষ্টিভঙ্গি:\n${profile.bgbViews}\n\nডাটাবেজে উল্লেখ: ${dbStats?.bgbMentionCount || 0} বার`;
                  navigator.clipboard.writeText(summaryText);
                  const btn = document.getElementById('copy-profile-btn');
                  if (btn) {
                    const original = btn.innerHTML;
                    btn.innerHTML = `<svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
                    setTimeout(() => { btn.innerHTML = original; }, 2000);
                  }
                }}
                id="copy-profile-btn"
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
                title={uiText(appLang, 'copy')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
            )}
            {onRefresh && (
              <button 
                onClick={onRefresh}
                disabled={isLoading}
                className={`p-2 rounded-lg transition-colors ${isLoading ? 'opacity-50' : ''} ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
                title={uiText(appLang, 'refresh')}
              >
                <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            )}
            <button 
              onClick={onClose}
              aria-label={uiText(appLang, 'close')}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
  );
};
