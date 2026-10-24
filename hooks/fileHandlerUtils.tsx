import React from 'react';
import { toast } from 'sonner';
import { FileMeta, HistoryItem, TranscriptMeta } from '../types';
import { CheckCircle, XCircle, Info, FolderUp } from 'lucide-react';
import { uiText } from '../utils/uiText';

export const showFolderUploadModal = (
    appLang: string, 
    supportedFilesCount: number,
    onConfirm: () => void,
    onCancel: () => void
) => {
    setTimeout(() => {
      toast.custom((t) => (
        <div className="flex flex-col gap-3 p-4 bg-emerald-800 text-white rounded-lg shadow-xl border border-emerald-700 max-w-sm w-full">
          <div className="flex items-center gap-3 w-full">
            <div className="flex-shrink-0 w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center shadow-inner">
              <FolderUp size={20} className="text-white" />
            </div>
            <div className="flex flex-col flex-grow text-left">
              <span className="font-semibold text-white text-sm leading-tight">
                {uiText(appLang, 'folderUpload')}
              </span>
              <span className="text-emerald-100 text-xs mt-1 leading-snug">
                {uiText(appLang, 'folderUploadConfirm', { supportedFilesCount })}
              </span>
            </div>
          </div>
          <div className="flex gap-2 w-full mt-1">
            <button 
              onClick={() => { 
                setTimeout(() => toast.dismiss(t), 0); 
                onConfirm(); 
              }}
              className="flex-1 bg-white text-emerald-900 border-none py-1.5 px-3 rounded-full font-semibold text-xs cursor-pointer hover:bg-emerald-50 transition-colors"
            >
              {uiText(appLang, 'start')}
            </button>
            <button 
              onClick={() => { 
                setTimeout(() => toast.dismiss(t), 0); 
                onCancel(); 
              }}
              className="flex-1 bg-transparent text-white border border-emerald-400/50 py-1.5 px-3 rounded-full font-semibold text-xs cursor-pointer hover:bg-white/10 transition-colors"
            >
              {uiText(appLang, 'cancel')}
            </button>
          </div>
        </div>
      ), { duration: Number.POSITIVE_INFINITY });
    }, 0);
};

export const showNoFilesFoundModal = (appLang: string) => {
    setTimeout(() => {
      toast.custom((t) => (
        <div className="flex items-center gap-3 p-4 bg-red-900 text-white rounded-lg shadow-xl border border-red-800 max-w-sm w-full">
          <div className="flex-shrink-0 w-10 h-10 bg-red-700 rounded-full flex items-center justify-center shadow-inner">
            <XCircle size={20} className="text-white" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-semibold text-white text-sm leading-tight">
              {uiText(appLang, 'noAudioVideoFilesFound')}
            </span>
          </div>
        </div>
      ), { duration: 3000 });
    }, 0);
};

export const showFileAlreadyTranscribedModal = (
    appLang: string,
    onConfirm: () => void,
    onCancel: () => void
) => {
    setTimeout(() => {
      toast.custom((t) => (
        <div className="flex flex-col gap-3 p-4 bg-blue-900 text-white rounded-lg shadow-xl border border-blue-800 max-w-sm w-full">
          <div className="flex items-center gap-3 w-full">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center shadow-inner">
              <Info size={20} className="text-white" />
            </div>
            <div className="flex flex-col flex-grow text-left">
              <span className="font-semibold text-white text-sm leading-tight">
                {uiText(appLang, 'fileAlreadyTranscribed')}
              </span>
              <span className="text-blue-100 text-xs mt-1 leading-snug">
                {uiText(appLang, 'doYouWantToTranscribeIt')}
              </span>
            </div>
          </div>
          <div className="flex gap-2 w-full mt-1">
            <button 
              onClick={() => { 
                setTimeout(() => toast.dismiss(t), 0); 
                onConfirm(); 
              }}
              className="flex-1 bg-white text-blue-900 border-none py-1.5 px-3 rounded-full font-semibold text-xs cursor-pointer hover:bg-blue-50 transition-colors"
            >
              {uiText(appLang, 'transcribeAgain')}
            </button>
            <button 
              onClick={() => { 
                setTimeout(() => toast.dismiss(t), 0); 
                onCancel(); 
              }}
              className="flex-1 bg-transparent text-white border border-blue-400/50 py-1.5 px-3 rounded-full font-semibold text-xs cursor-pointer hover:bg-white/10 transition-colors"
            >
              {uiText(appLang, 'viewExisting')}
            </button>
          </div>
        </div>
      ), { duration: Number.POSITIVE_INFINITY });
    }, 0);
};
