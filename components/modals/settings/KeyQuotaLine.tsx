import React from 'react';
import { useAppStore } from '../../../hooks/useAppStore';
import { keyQuotaToday } from '../../../services/apiKeys/keyQuota';
import { AVAILABLE_MODELS } from '../../../constants/aiModelList';
import { uiText } from '../../../utils/uiText';

interface Props {
  // The key's last four characters, as the request log records them
  tail: string;
  appLang: string;
}

// "12 requests today", and for each used-up daily quota the model and when it comes back
export const KeyQuotaLine = ({ tail, appLang }: Props) => {
  // A new request is logged: count again
  useAppStore(state => state.apiCallLogged);
  const { requests, exhausted } = keyQuotaToday(tail);
  const time = (ms: number) => new Date(ms).toLocaleTimeString(appLang === 'bn' ? 'bn-BD' : 'en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-bold">
      <span className="opacity-50">{uiText(appLang, 'keyRequestsToday', { count: requests })}</span>
      {exhausted.map(q => (
        <span key={q.model} className="text-red-500">
          {uiText(appLang, 'keyQuotaUsedUp', { model: AVAILABLE_MODELS.find(m => m.id === q.model)?.label ?? q.model, time: time(q.resetAt) })}
        </span>
      ))}
    </div>
  );
};
