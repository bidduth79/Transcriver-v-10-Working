import { useState, useRef, useEffect, useCallback } from 'react';

export const useModalResize = (
  initialWidth = 1000,
  initialHeight = 800,
  containerId = 'summary-modal-container',
  minWidth = 600,
  minHeight = 400
) => {
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const isResizing = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const modalElement = document.getElementById(containerId);
    if (modalElement) {
      const rect = modalElement.getBoundingClientRect();
      setSize({
        width: Math.max(minWidth, e.clientX - rect.left),
        height: Math.max(minHeight, e.clientY - rect.top)
      });
    }
  }, [containerId, minWidth, minHeight]);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', stopResizing);
  }, [handleMouseMove]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResizing);
  }, [handleMouseMove, stopResizing]);

  useEffect(() => {
    return () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [handleMouseMove, stopResizing]);

  return {
    size,
    setSize,
    isMinimized,
    setIsMinimized,
    isMaximized,
    setIsMaximized,
    startResizing
  };
};

