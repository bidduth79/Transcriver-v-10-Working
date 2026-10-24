import { useRef, useState } from 'react';
import type React from 'react';
import { collectDroppedFiles } from '../../../hooks/fileHandler/droppedFiles';
import { isSupportedMediaFile } from '../../../hooks/fileHandler/mediaDuration';

type FileChangeHandler = (e: { target: { files: File[]; webkitdirectory?: boolean; value?: string } }) => void;

const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

// One supported file opens like a normal upload; several files or a folder go to the batch confirm
export const useFileDrop = (handleFileChange: FileChangeHandler, disabled = false) => {
  const [isDragging, setIsDragging] = useState(false);
  const depth = useRef(0);

  const onDragEnter = (e: React.DragEvent) => {
    if (disabled || !hasFiles(e)) return;
    e.preventDefault();
    depth.current += 1;
    setIsDragging(true);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (disabled || !hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    if (disabled || !hasFiles(e)) return;
    e.preventDefault();
    depth.current = 0;
    setIsDragging(false);
    const { files, hasFolder } = await collectDroppedFiles(e.dataTransfer);
    if (files.length === 0) return;
    const single = files.length === 1 && !hasFolder && isSupportedMediaFile(files[0]);
    handleFileChange({ target: { files, webkitdirectory: !single } });
  };

  return { isDragging, dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
};
