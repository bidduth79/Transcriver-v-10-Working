import React from 'react';
import { useAppStore } from '../../../hooks/useAppStore';
import { keyQuotaToday } from '../../../services/apiKeys/keyQuota';
import { keyRejection } from '../../../services/apiKeys/keyRejection';
import { lastKeyCheck, type KeyCheckStatus } from '../../../services/apiKeys/keyCheck';
import { allModels } from '../../../services/apiKeys/customModels';
import { uiText, type UiTextKey } from '../../../utils/uiText';

interface Props {
  // The key's last four characters, as the request log records them
  tail: string;
  appLang: string;
}

// "12 requests today", the last test of the key, why Gemini refuses it (if it does), and for each used-up daily
// quota the model and when it comes back
export const KeyQuotaLine = ({ tail, appLang }: Props) => {
  // A new request is logged: count again
  useAppStore(state => state.apiCallLogged);
  const { requests, exhausted } = keyQuotaToday(tail);
  const rejection = keyRejection(tail);
  const check = lastKeyCheck(tail);
  const time = (ms: number) => new Date(ms).toLocaleTimeString(appLang === 'bn' ? 'bn-BD' : 'en-US', { hour: 'numeric', minute: '2-digit' });
  const modelLabel = (id: string) => allModels().find(m => m.id === id)?.label ?? id;
  // A refused key and a used-up quota have their own lines below; the test shows the other outcomes
  const checkKeys: Partial<Record<KeyCheckStatus, UiTextKey>> = { ok: 'keyCheckOk', rateLimited: 'keyCheckRateLimited', busy: 'keyCheckBusy', error: 'keyCheckError' };
  const checkKey = check && checkKeys[check.status];

  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-bold">
      <span className="opacity-50">{uiText(appLang, 'keyRequestsToday', { count: requests })}</span>
      {check && checkKey && (
        <span className={check.status === 'ok' ? 'text-green-600' : 'text-amber-500'} title={check.message}>
          {uiText(appLang, checkKey, { time: time(check.at), model: modelLabel(check.model) })}
        </span>
      )}
      {rejection && (
        <span className="text-red-500">{uiText(appLang, rejection === 'invalid' ? 'keyRejectedInvalid' : 'keyRejectedNoAccess')}</span>
      )}
      {exhausted.map(q => (
        <span key={q.model} className="text-red-500">
          {uiText(appLang, 'keyQuotaUsedUp', { model: modelLabel(q.model), time: time(q.resetAt) })}
        </span>
      ))}
    </div>
  );
};
