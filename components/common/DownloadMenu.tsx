import React, { useState, useRef, useEffect } from 'react';
import { baseFileName, buildKeywordRegex, buildTxtBlob, buildWordBlob, buildSrtBlob } from './download/exportContent';
import { printTranscriptAsPdf } from './download/pdfExport';
import { DownloadMenuPanel } from './download/DownloadMenuPanel';

export const DownloadMenu = ({ transcript, fileName, t, searchTerm, sensitiveMatches = [], addToast, customTrigger }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [includeKeywords, setIncludeKeywords] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const keywordRegex = () => (includeKeywords ? buildKeywordRegex(sensitiveMatches) : null);

  const downloadFile = (content: Blob, ext: string) => {
    try {
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseFileName(fileName)}_transcript.${ext}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsOpen(false);
      addToast(`${ext.toUpperCase()} ফাইল ডাউনলোড শুরু হয়েছে`, 'success');
    } catch (error: any) {
      console.error('Download error:', error);
      addToast(`ডাউনলোড ত্রুটি: ${error.message || 'Unknown error'}`, 'error');
    }
  };

  // Wraps a builder so a failure shows "<LABEL> এরর" instead of breaking the menu
  const exportAs = (label: string, ext: string, build: () => Blob) => () => {
    try {
      downloadFile(build(), ext);
    } catch (error: any) {
      console.error(`${label} Export Error:`, error);
      addToast(`${label} এরর: ${error.message}`, 'error');
    }
  };

  const exportPDF = () => {
    setIsOpen(false);
    printTranscriptAsPdf(
      { transcript, fileName: baseFileName(fileName), searchTerm, keywordRegex: keywordRegex() },
      addToast
    );
  };

  return (
    <div className="relative" ref={menuRef}>
      {customTrigger ? (
        <div onClick={() => setIsOpen(!isOpen)}>
          {customTrigger}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center px-8 py-3.5 bg-white text-slate-900 rounded-full text-sm font-black uppercase tracking-widest hover:brightness-95 transition-all shadow-xl active:scale-95 shrink-0 group ${isOpen ? 'ring-4 ring-indigo-500/20' : ''}`}
        >
          <svg className={`w-5 h-5 mr-3 transition-transform duration-500 ${isOpen ? 'rotate-180' : 'group-hover:scale-125'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {t.download}
          <svg className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {isOpen && (
        <DownloadMenuPanel
          onTxt={exportAs('TXT', 'txt', () => buildTxtBlob(transcript))}
          onWord={exportAs('Word', 'doc', () => buildWordBlob(transcript, keywordRegex()))}
          onSrt={exportAs('SRT', 'srt', () => buildSrtBlob(transcript))}
          onPdf={exportPDF}
          showKeywordToggle={!!(sensitiveMatches && sensitiveMatches.length > 0)}
          includeKeywords={includeKeywords}
          setIncludeKeywords={setIncludeKeywords}
        />
      )}
    </div>
  );
};
