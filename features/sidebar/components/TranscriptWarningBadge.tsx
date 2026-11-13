import React from 'react';
import { TriangleAlert } from 'lucide-react';
import type { TranscriptWarning } from '../../../types';
import { uiText, type UiTextKey } from '../../../utils/uiText';

interface Props {
  warnings?: TranscriptWarning[];
  isDark: boolean;
  appLang: string;
}

const MESSAGE_KEYS: Record<TranscriptWarning, UiTextKey> = {
  loop: 'transcriptWarningLoop',
  littleText: 'transcriptWarningLittleText',
  endsEarly: 'transcriptWarningEndsEarly',
  pastEnd: 'transcriptWarningPastEnd',
  gap: 'transcriptWarningGap',
};

// A small "check this" mark on a history card whose transcript may be wrong; hovering lists the reasons
export const TranscriptWarningBadge = ({ warnings, isDark, appLang }: Props) => {
  if (!warnings?.length) return null;
  const reasons = warnings.map(warning => `• ${uiText(appLang, MESSAGE_KEYS[warning])}`).join('\n');
  return (
    <span
      data-testid="transcript-warning"
      title={`${uiText(appLang, 'transcriptWarningTitle')}\n${reasons}`}
      className={`shrink-0 flex items-center gap-0.5 px-1 rounded text-[10px] font-black ${isDark ? 'text-amber-400 bg-amber-500/15' : 'text-amber-700 bg-amber-100'}`}
    >
      <TriangleAlert className="w-3 h-3" />
      {uiText(appLang, 'transcriptWarningBadge')}
    </span>
  );
};
