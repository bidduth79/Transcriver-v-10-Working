import React from 'react';
import { TranscriptMeta, FileMeta, HistoryItem } from '../types';
import {
    showFolderUploadModal,
    showNoFilesFoundModal,
    showFileAlreadyTranscribedModal
} from './fileHandlerUtils';
import { isSupportedMediaFile } from './fileHandler/mediaDuration';
import { loadNewFileMetadata, loadHistoryFileMetadata } from './fileHandler/loadFileMetadata';
import { loadHistoryTranscript } from './history/useHistoryTranscript';

const MAX_FILE_SIZE = 70 * 1024 * 1024;

interface UseFileHandlerProps {
  appLang: string;
  addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  setFile: (file: File) => void;
  setFileUrl: (url: string) => void;
  fileUrl: string | null;
  setActiveHistoryId: (id: string | null) => void;
  setTranscriptMeta: (meta: TranscriptMeta | null) => void;
  setTranscript: (t: string) => void;
  setStatus: (s: 'idle' | 'processing' | 'completed' | 'error') => void;
  setFileMeta: (m: FileMeta) => void;
  processTranscription: (file: File, meta?: FileMeta) => void;
  history: HistoryItem[];
  setBatchQueue: (q: File[]) => void;
  setCurrentBatchIndex: (i: number) => void;
  setIsBatchProcessing: (b: boolean) => void;
  setHasBatchStarted: (b: boolean) => void;
  setIsBatchPaused: (b: boolean) => void;
  setBatchCountdown: (c: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export const useFileHandler = ({
  appLang, addToast, setFile, setFileUrl, fileUrl,
  setActiveHistoryId, setTranscriptMeta, setTranscript, setStatus,
  setFileMeta, processTranscription, history, setBatchQueue,
  setCurrentBatchIndex, setIsBatchProcessing, setHasBatchStarted,
  setIsBatchPaused, setBatchCountdown, fileInputRef
}: UseFileHandlerProps) => {

  // Multiple files or a folder: confirm, then hand supported files to the batch queue
  const handleMultipleFiles = (files: FileList) => {
    const supportedFiles = (Array.from(files) as File[]).filter(isSupportedMediaFile);

    if (supportedFiles.length === 0) {
      showNoFilesFoundModal(appLang);
      return;
    }

    showFolderUploadModal(
        appLang,
        supportedFiles.length,
        () => {
          setBatchQueue(supportedFiles);
          setCurrentBatchIndex(0);
          setIsBatchProcessing(true);
          setHasBatchStarted(false);
          setIsBatchPaused(false);
          setBatchCountdown(0);
        },
        () => {
          if (fileInputRef.current) fileInputRef.current.value = '';
          const folderInput = document.getElementById('folderInput') as HTMLInputElement;
          if (folderInput) folderInput.value = '';
        }
    );
  };

  const replaceFileUrl = (file: File) => {
    setFile(file);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return url;
  };

  const loadAndProcessFile = (selectedFile: File, autoStart: boolean) => {
    const url = replaceFileUrl(selectedFile);
    setActiveHistoryId(null);
    setTranscriptMeta(null);
    setTranscript('');
    setStatus('idle');

    loadNewFileMetadata(selectedFile, url, (metadata) => {
      setFileMeta(metadata);
      if (autoStart) {
        processTranscription(selectedFile, metadata);
      }
    });
  };

  const loadFromHistory = (selectedFile: File, existingHistoryItem: HistoryItem) => {
    const url = replaceFileUrl(selectedFile);
    loadHistoryFileMetadata(selectedFile, url, existingHistoryItem, setFileMeta);

    // List items are light; the saved transcript is read from IndexedDB
    Promise.resolve(existingHistoryItem.transcript ?? loadHistoryTranscript(existingHistoryItem.id))
      .then(setTranscript)
      .catch(() => setTranscript(''));
    setStatus('completed');
    setTranscriptMeta({
      name: existingHistoryItem.fileName,
      duration: existingHistoryItem.duration,
      channelName: existingHistoryItem.channelName,
      date: existingHistoryItem.publishedDate
    });
    setActiveHistoryId(existingHistoryItem.id);
    addToast(appLang === 'bn' ? "হিস্টোরি লোড হয়েছে" : "History loaded", 'info');
  };

  const handleFileChange = (e: any, autoStart: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 1 || (e.target as HTMLInputElement).webkitdirectory) {
      handleMultipleFiles(files);
      return;
    }

    const selectedFile = files[0];
    if (selectedFile.size > MAX_FILE_SIZE) {
      addToast(appLang === 'bn' ? 'ফাইল সাইজ ৭০ এমবি এর বেশি হতে পারবে না' : 'File size cannot exceed 70MB', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const existingHistoryItem = history.find(h => h.fileName === selectedFile.name);

    if (existingHistoryItem) {
      showFileAlreadyTranscribedModal(
          appLang,
          () => loadAndProcessFile(selectedFile, true),
          () => loadFromHistory(selectedFile, existingHistoryItem)
      );
    } else {
      loadAndProcessFile(selectedFile, autoStart);
    }

    e.target.value = '';
  };

  return { handleFileChange };
};
