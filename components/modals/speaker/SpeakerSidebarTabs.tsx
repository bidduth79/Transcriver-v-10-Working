import React from 'react';
import { SpeakerProfile } from '../../../types/speaker';

export type SpeakerTab = 'profile' | 'archive' | 'notes' | 'research';

interface Props {
  activeTab: SpeakerTab;
  setActiveTab: (tab: SpeakerTab) => void;
  profile: SpeakerProfile | null;
  isDark: boolean;
}

// Profile / BGB history (with mention count) / notes / research tabs
export const SpeakerSidebarTabs = ({ activeTab, setActiveTab, profile, isDark }: Props) => {
  const dbStats = profile?.databaseStats;
  return (
        <div className={`px-4 pt-2 border-b flex gap-1 shrink-0 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50/80'}`}>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-1.5 ${activeTab === 'profile' ? 'border-indigo-500 text-indigo-500 bg-indigo-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            মূল পরিচিতি
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-1.5 relative ${activeTab === 'archive' ? 'border-indigo-500 text-indigo-500 bg-indigo-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            বিজিবি হিস্টোরি
            {dbStats && dbStats.bgbMentionCount > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-bold animate-pulse">
                {dbStats.bgbMentionCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-1.5 ${activeTab === 'notes' ? 'border-indigo-500 text-indigo-500 bg-indigo-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            কাস্টম নোট
            {profile?.customNote?.notes && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('research')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-1.5 ${activeTab === 'research' ? 'border-indigo-500 text-indigo-500 bg-indigo-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            ওপেন রিসার্চ
          </button>
        </div>
  );
};
