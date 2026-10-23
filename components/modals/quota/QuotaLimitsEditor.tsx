import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { getModelLimits, saveModelLimits, type QuotaLimits } from './quotaStats';

const AI_STUDIO_RATE_LIMITS_URL = 'https://aistudio.google.com/rate-limit?timeRange=last-28-days';

interface Props {
  model: string;
  appLang: 'en' | 'bn';
  isDark: boolean;
  onSaved: () => void;
}

// Lets the user enter the real limits AI Studio shows for their project, per model
export const QuotaLimitsEditor = ({ model, appLang, isDark, onSaved }: Props) => {
  const [values, setValues] = useState<QuotaLimits>(() => getModelLimits(model));
  const bn = appLang === 'bn';
  const fields: { key: keyof QuotaLimits; label: string }[] = [
    { key: 'rpm', label: 'RPM' }, { key: 'tpm', label: 'TPM' }, { key: 'rpd', label: 'RPD' },
  ];
  const isValid = fields.every(f => Number.isFinite(values[f.key]) && values[f.key] > 0);
  const inputClass = `w-full px-2 py-1.5 rounded-lg border text-xs font-mono ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`;

  const save = (limits: QuotaLimits | null) => {
    saveModelLimits(model, limits);
    onSaved();
  };

  return (
    <div className={`px-4 py-3 border-t flex flex-col gap-3 ${isDark ? 'border-slate-700/50 bg-[#252525]' : 'border-slate-200 bg-slate-50'}`}>
      <a href={AI_STUDIO_RATE_LIMITS_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:underline w-fit">
        <ExternalLink className="w-3.5 h-3.5" />
        {bn ? 'AI Studio-তে আপনার project-এর আসল সীমা দেখুন' : "See your project's real limits in AI Studio"}
      </a>
      <div className="grid grid-cols-3 gap-3">
        {fields.map(f => (
          <label key={f.key} className="flex flex-col gap-1 text-[10px] font-bold text-slate-500">
            {f.label}
            <input
              type="number" min={1} value={values[f.key] || ''} className={inputClass}
              onChange={e => setValues(v => ({ ...v, [f.key]: Number(e.target.value) }))}
            />
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button disabled={!isValid} onClick={() => save(values)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40">
          {bn ? 'সেভ করুন' : 'Save'}
        </button>
        <button onClick={() => save(null)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
          {bn ? 'আনুমানিক সীমায় ফেরান' : 'Back to estimate'}
        </button>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        {bn
          ? 'সীমা Google Cloud project ধরে, প্রতিটি model-এর জন্য আলাদা। দিনের (RPD) হিসাব Pacific সময়ের মাঝরাতে শূন্য হয় (বাংলাদেশে দুপুর ১-২টা)।'
          : 'Limits apply per Google Cloud project and per model. The daily (RPD) count resets at midnight Pacific time.'}
      </p>
    </div>
  );
};
