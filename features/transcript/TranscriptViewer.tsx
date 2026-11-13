import React, { useRef, useMemo } from 'react';
import { useTranscriptFormatter } from './hooks/useTranscriptFormatter.tsx';
import { parseTranscriptLines } from './utils/parseTranscriptLines';
import { UNCLEAR_MARK } from '../../constants/instructions';
import { useThemeStore } from '../../hooks/useThemeStore';
import { uiText } from '../../utils/uiText';

// Robust Regex Escaping
export const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const appLang = useThemeStore(state => state.appLang);

  // CRITICAL: Reset match index on every render to ensure consistent IDs (match-0, match-1, etc.)
  matchIndexRef.current = 0;

  // Pre-parse the entire transcript ONCE per text change (0ms re-render overhead)
  const parsedLines = useMemo(() => parseTranscriptLines(text), [text]);

  if (!text) return null;

  return (
    <div className="space-y-2 selection:bg-indigo-500/30">
      {parsedLines.map(({ timestamp, seekTime, parsedParts }, i) => (
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
          {/* Both edges of a paragraph line up (justified) */}
          <div className="flex-1 text-justify">
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

              // Words Gemini could not make out: highlighted, and a click plays that part of the audio
              if (item.textInside.includes(UNCLEAR_MARK)) {
                return (
                  <span key={j}>
                    {item.textInside.split(UNCLEAR_MARK).map((piece, k) => (
                      <React.Fragment key={k}>
                        {k > 0 && (
                          <button type="button" onClick={() => seekTime && onSeek?.(seekTime)} title={uiText(appLang, 'unclearListenHint')}
                            className={`mx-0.5 px-1.5 rounded font-bold ${isDark ? 'bg-amber-400/20 text-amber-300' : 'bg-amber-200 text-amber-800'}`}>
                            {UNCLEAR_MARK}
                          </button>
                        )}
                        {formatText(piece, matchIndexRef)}
                      </React.Fragment>
                    ))}
                  </span>
                );
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
