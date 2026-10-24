import React, { useRef, useMemo } from 'react';
import { useTranscriptFormatter } from './hooks/useTranscriptFormatter.tsx';

// Robust Regex Escaping
export const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const TIMESTAMP_REGEX = /^[\*\_\[\(\s]*((?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2})[\*\_\]\)\s]*\s+(.*)/;
const GENERIC_NAMES = ['speaker', 'male', 'female', 'unknown', 'host', 'guest', 'interviewer', 'interviewee', 'announcer', 'voice', 'person'];

const isProperName = (name: string) => {
  const lowerName = name.toLowerCase().replace(/[^a-z]/g, '');
  for (const generic of GENERIC_NAMES) {
    if (lowerName.includes(generic)) return false;
  }
  if (/^\d+$/.test(lowerName)) return false;
  return true;
};

export interface FormattedTranscriptProps {
  text: string;
  searchTerm: string;
  isDark: boolean;
  currentMatchIndex: number;
  sensitiveMatches?: string[];
  // A timestamp such as "[01:15]"
  onSeek?: (time: string) => void;
  onSpeakerClick?: (name: string) => void;
  onRenameSpeaker?: (name: string) => void;
  scrollElementRef?: React.RefObject<HTMLElement | null>;
}

export const FormattedTranscript = React.memo(({
  text,
  searchTerm,
  isDark,
  currentMatchIndex,
  sensitiveMatches = [],
  onSeek,
  onSpeakerClick,
  onRenameSpeaker
}: FormattedTranscriptProps) => {
  const matchIndexRef = useRef(0);
  
  // Use the hook safely inside this component
  const { formatText } = useTranscriptFormatter(searchTerm, isDark, currentMatchIndex, sensitiveMatches);

  // CRITICAL: Reset match index on every render to ensure consistent IDs (match-0, match-1, etc.)
  matchIndexRef.current = 0;

  // Pre-parse the entire transcript ONCE per text change (0ms re-render overhead)
  const parsedLines = useMemo(() => {
    if (!text) return [];
    
    // Force a newline before any timestamp like [07:41] or (1:23:45) so that inline speakers get separated properly
    const textWithNewlines = text.replace(/([\[\(](?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2}[\]\)])/g, '\n$1');
    
    return textWithNewlines
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => {
        const timestampMatch = line.match(TIMESTAMP_REGEX);
        let timestamp = '';
        let content = line;
        if (timestampMatch) {
          timestamp = `[${timestampMatch[1]}]`;
          content = timestampMatch[2];
        }
        const parts = content.split(/(\*\*.*?\*\*)/g);
        const parsedParts = parts.map((part: string) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const textInside = part.slice(2, -2);
            const hasColon = textInside.trim().endsWith(':');
            const cleanName = textInside.replace(/:$/, '').trim();
            const isGeneric = !isProperName(cleanName);
            const isSpeaker = cleanName.split(/\s+/).length <= 4 && (!isGeneric || hasColon);
            return { isSpeaker, textInside, cleanName };
          }
          return { isSpeaker: false, textInside: part, cleanName: '' };
        });
        return { timestamp, parsedParts };
      });
  }, [text]);

  if (!text) return null;

  return (
    <div className="space-y-2 selection:bg-indigo-500/30">
      {parsedLines.map(({ timestamp, parsedParts }, i) => (
        <div 
          key={i}
          style={!searchTerm ? { contentVisibility: 'auto', containIntrinsicSize: '0 36px' } : undefined}
          className="mb-1.5 min-h-[1.5em] leading-relaxed flex items-start group"
        >
          {timestamp && (
            <span 
              onClick={() => onSeek && onSeek(timestamp)}
              className={`text-[0.7em] font-mono mr-3 select-none px-2 py-0.5 rounded-md transition-colors mt-1 shrink-0 ${
                onSeek ? 'cursor-pointer hover:bg-indigo-500 hover:text-white' : ''
              } ${isDark ? 'bg-white/5 text-white/40' : 'bg-black/5 text-black/40'}`}
            >
              {timestamp}
            </span>
          )}
          <div className="flex-1">
            {parsedParts.map((item, j) => {
              if (item.isSpeaker) {
                if (onSpeakerClick) {
                  return (
                    <span key={j} className="inline-flex items-center gap-1 group/speaker">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onSpeakerClick(item.cleanName); }}
                        className={`hover:underline cursor-pointer transition-colors font-bold ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-700 hover:text-indigo-600'}`}
                        title={`View profile: ${item.cleanName}`}
                      >
                        {item.textInside}
                      </button>
                      {onRenameSpeaker && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRenameSpeaker(item.cleanName); }}
                          className="opacity-0 group-hover/speaker:opacity-100 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-opacity"
                          title="Rename Speaker Globally"
                        >
                          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      )}
                    </span>
                  );
                }
                return <strong key={j} className={isDark ? 'text-indigo-400' : 'text-indigo-700'}>{item.textInside}</strong>;
              }

              const elements = formatText(item.textInside, matchIndexRef);
              return <span key={j}>{elements}</span>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
});

export const TranscriptViewer = React.memo(({
  transcript,
  searchTerm,
  isDark,
  currentMatchIndex,
  sensitiveMatches = [],
  onSeek,
  onSpeakerClick,
  onRenameSpeaker,
  scrollElementRef
}: Omit<FormattedTranscriptProps, 'text'> & { transcript: string }) => {
  return (
    <FormattedTranscript 
      text={transcript} 
      searchTerm={searchTerm} 
      isDark={isDark} 
      currentMatchIndex={currentMatchIndex} 
      sensitiveMatches={sensitiveMatches} 
      onSeek={onSeek} 
      onSpeakerClick={onSpeakerClick} 
      onRenameSpeaker={onRenameSpeaker} 
      scrollElementRef={scrollElementRef}
    />
  );
});
