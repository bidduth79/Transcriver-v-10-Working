import React from 'react';
import { uiText } from '../../../utils/uiText';

export const getSentimentLabel = (s: string, appLang: 'bn' | 'en') => {
  if (s === 'positive') return uiText(appLang, 'positive');
  if (s === 'negative') return uiText(appLang, 'negative');
  if (s === 'pending') return uiText(appLang, 'notAnalyzed');
  return uiText(appLang, 'neutral');
};

export const highlightText = (text: string, term: string) => {
  if (!term) return text;
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedTerm})`, 'gi'));
  return parts.map((part, i) => 
    part.toLowerCase() === term.toLowerCase() ? 
      <span key={i} className="bg-amber-500/40 text-amber-200 font-black px-1.5 py-0.5 rounded-md border border-amber-500/30">{part}</span> : 
      part
  );
};
