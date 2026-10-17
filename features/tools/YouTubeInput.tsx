import React, { useState } from 'react';

interface YouTubeInputProps {
  onSuccess: (blob: Blob, fileName: string, mode: string) => void;
  isDark: boolean;
  activeColors: any;
  appLang: 'bn' | 'en';
  onFolderOpen?: () => void;
  showFormats?: boolean;
}

export const YouTubeInput: React.FC<YouTubeInputProps> = ({
  onSuccess,
  isDark,
  activeColors,
  appLang,
  onFolderOpen,
  showFormats = true
}) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/licell_api/youtube.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), quality: 'audio' })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.base64) {
        const mimeType = data.format === 'wav' ? 'audio/wav' : 'audio/mp3';
        let dataUrl: string | null = `data:${mimeType};base64,${data.base64}`;
        data.base64 = null; // Release large base64 string reference immediately
        const res = await fetch(dataUrl);
        dataUrl = null;
        const blob = await res.blob();
        onSuccess(blob, data.filename || 'youtube_audio.mp3', 'transcribe');
        setUrl('');
      } else {
        throw new Error(appLang === 'bn' ? 'অডিও ডাউনলোড করা যায়নি' : 'Failed to download audio');
      }
    } catch (err: any) {
      console.error('YouTube link error:', err);
      setError(err.message || (appLang === 'bn' ? 'লিংক প্রসেস করতে ব্যর্থ হয়েছে' : 'Failed to process link'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={appLang === 'bn' ? 'ইউটিউব বা ফেসবুক লিংক পেস্ট করুন...' : 'Paste YouTube or Facebook link...'}
          disabled={loading}
          className={`w-full px-3 py-2.5 text-xs rounded-xl border transition-all outline-none ${
            isDark 
              ? 'bg-slate-900 border-white/10 text-white placeholder-white/30 focus:border-indigo-500' 
              : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-500'
          }`}
        />
        {url && (
          <button
            type="button"
            onClick={() => setUrl('')}
            className="absolute right-2 text-white/40 hover:text-white transition-colors text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <p className="text-[10px] text-red-400 font-medium px-1">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !url.trim()}
        className={`w-full py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
          loading || !url.trim()
            ? 'opacity-50 cursor-not-allowed bg-slate-700'
            : `${activeColors?.primary || 'bg-indigo-600'} hover:brightness-110 active:scale-95`
        }`}
      >
        {loading ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>{appLang === 'bn' ? 'ডাউনলোড হচ্ছে...' : 'Processing...'}</span>
          </>
        ) : (
          <span>{appLang === 'bn' ? 'লোড করুন' : 'Load Audio'}</span>
        )}
      </button>
    </form>
  );
};
