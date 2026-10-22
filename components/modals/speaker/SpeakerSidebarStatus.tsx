import React from 'react';

interface Props {
  isLoading: boolean;
  error: string;
  isDark: boolean;
}

// Skeleton while the profile loads, and the error box
export const SpeakerSidebarStatus = ({ isLoading, error, isDark }: Props) => (
  <>
          {isLoading && (
            <div className="w-full animate-pulse p-6 space-y-6">
              <div className={`w-full aspect-[16/9] rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
              <div className="space-y-3">
                <div className={`h-4 w-28 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                <div className={`h-3 w-full rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                <div className={`h-3 w-5/6 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
              </div>
              <div className="space-y-3">
                <div className={`h-4 w-32 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                <div className={`h-16 w-full rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                <svg className="w-8 h-8 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <p className="text-red-500 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}
  </>
);
