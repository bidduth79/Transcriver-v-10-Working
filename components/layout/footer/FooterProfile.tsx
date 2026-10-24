import React, { useState } from 'react';
import type { ActiveColors } from '../../../hooks/useAppTheme';

interface Props {
  activeColors: ActiveColors;
}

// Developer credit link with hover contact card
export const FooterProfile = ({ activeColors }: Props) => {
  const [showProfile, setShowProfile] = useState(false);

  return (
        <div
          className="relative group py-1"
          onMouseEnter={() => setShowProfile(true)}
          onMouseLeave={() => setShowProfile(false)}
        >
          {/* Profile Popup */}
          <div
            className={`absolute bottom-full right-0 w-80 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] pb-6 ${showProfile ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}`}
          >
            <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden">
              <div className={`absolute -top-20 -right-20 w-40 h-40 ${activeColors.primary} opacity-20 blur-[80px] rounded-full`}></div>

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-14 h-14 rounded-2xl ${activeColors.primary} flex items-center justify-center text-white shadow-2xl transition-transform duration-500 group-hover:rotate-6`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-[13px] font-black text-white leading-tight font-stylish-bn">ল্যাঃ নাঃ সিটি রাকিব</h4>
                    <p className={`text-[10px] font-black tracking-widest ${activeColors.text} mt-1`}>LNK CT R@KIB</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <a href="tel:01829300000" className="flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/5 transition-all group/item no-underline">
                    <div className="w-8 h-8 bg-green-500/20 text-green-400 rounded-lg flex items-center justify-center group-hover/item:scale-110 transition-transform group-hover/item:bg-green-500 group-hover/item:text-white">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79a15.1 15.1 0 006.59 6.59l2.2-2.2a1 1 0 011.11-.27 11.72 11.72 0 003.7.59 1 1 0 011 1V20a1 1 0 01-1 1A19 19 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.72 11.72 0 00.59 3.7 1 1 0 01-.27 1.11l-2.2 2.2z"/></svg>
                    </div>
                    <div>
                      <span className="block text-[8px] text-white/40 font-black tracking-tighter uppercase mb-0.5">Mobile Number</span>
                      <span className="text-white text-[11px] font-bold tracking-widest tabular-nums group-hover/item:text-green-400 transition-colors">01829300000</span>
                    </div>
                  </a>

                  <a href="mailto:biduth79@gmail.com" className="flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/5 transition-all group/item no-underline">
                    <div className="w-8 h-8 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center group-hover/item:scale-110 transition-transform group-hover/item:bg-blue-500 group-hover/item:text-white">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    </div>
                    <div>
                      <span className="block text-[8px] text-white/40 font-black tracking-tighter uppercase mb-0.5">Email Address</span>
                      <span className="text-white text-[10px] font-bold tracking-tight lowercase group-hover/item:text-blue-400 transition-colors">biduth79@gmail.com</span>
                    </div>
                  </a>
                </div>

                <div className="absolute top-full right-8 -mt-2 w-4 h-4 bg-slate-900/95 rotate-45 border-r border-b border-white/10 z-0"></div>
              </div>
            </div>
          </div>

          <a
              href="https://wa.me/8801829300000"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-indigo-400 cursor-pointer transition-all group active:scale-95 no-underline"
          >
              <span className="mr-3 group-hover:text-white transition-all text-[9px] text-white/60 font-black">PROJECT BY R@KIB</span>
              <div className={`w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center group-hover:${activeColors.primary} group-hover:text-white group-hover:rotate-12 transition-all border border-white/10 shadow-inner ring-offset-slate-950 group-hover:ring-2 group-hover:ring-white/20`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.407 3.481 2.242 2.242 3.48 5.23 3.481 8.411-.003 6.557-5.338 11.892-11.893 11.892-1.997 0-3.951-.5-5.688-1.448l-6.3 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.438 9.889-9.886.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884 0 2.225.569 3.967 1.751 5.634l-.999 3.648 3.737-.981z"/></svg>
              </div>
          </a>
        </div>
  );
};
