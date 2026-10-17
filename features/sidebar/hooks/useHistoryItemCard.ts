import { useState, useRef, useEffect, useCallback } from 'react';

// Global timestamp of the last long-press deletion so that if a card unmounts
// under an active cursor/finger and the next card shifts into its place,
// releasing the pointer does not accidentally click/load the next card.
let lastLongPressDeleteTimestamp = 0;

export const useHistoryItemCard = (item: any, onDeleteHistoryItem: any, loadHistoryItem: any) => {
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef<number | null>(null);
  const visualTimerRef = useRef<number | null>(null);
  const isLongPressTriggered = useRef(false);
  const startCoordsRef = useRef<{ x: number; y: number } | null>(null);

  const itemRef = useRef(item);
  itemRef.current = item;
  const onDeleteRef = useRef(onDeleteHistoryItem);
  onDeleteRef.current = onDeleteHistoryItem;
  const loadItemRef = useRef(loadHistoryItem);
  loadItemRef.current = loadHistoryItem;

  const clearLongPressTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (visualTimerRef.current !== null) {
      clearTimeout(visualTimerRef.current);
      visualTimerRef.current = null;
    }
    startCoordsRef.current = null;
    setIsPressing(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      if (visualTimerRef.current !== null) clearTimeout(visualTimerRef.current);
    };
  }, []);

  const handleStart = useCallback((e?: any) => {
    // Only trigger on primary mouse button (left-click) or touch
    if (e && e.type === 'mousedown' && e.button !== 0) return;

    // Record starting pointer coordinates to ignore tiny finger/mouse jitter
    if (e?.touches && e.touches.length > 0) {
      startCoordsRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e && typeof e.clientX === 'number') {
      startCoordsRef.current = { x: e.clientX, y: e.clientY };
    }

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (visualTimerRef.current !== null) clearTimeout(visualTimerRef.current);
    isLongPressTriggered.current = false;

    // Start visual hold feedback after 120ms so quick clicks don't flash
    visualTimerRef.current = window.setTimeout(() => {
      visualTimerRef.current = null;
      setIsPressing(true);
    }, 120);

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      isLongPressTriggered.current = true;
      lastLongPressDeleteTimestamp = Date.now();
      setIsPressing(false);

      const currentItem = itemRef.current;
      const deleteFn = onDeleteRef.current;
      if (deleteFn && currentItem?.id) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(150); } catch {}
        }
        deleteFn(currentItem.id);
      }
    }, 3000);
  }, []);

  const handleMove = useCallback((e: any) => {
    if (!startCoordsRef.current || timerRef.current === null) return;
    let clientX: number | undefined;
    let clientY: number | undefined;

    if (e?.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e && typeof e.clientX === 'number') {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    if (clientX !== undefined && clientY !== undefined) {
      const dx = clientX - startCoordsRef.current.x;
      const dy = clientY - startCoordsRef.current.y;
      // Only cancel long press if pointer moved more than 12px (scrolling/dragging)
      if (dx * dx + dy * dy > 144) {
        clearLongPressTimer();
      }
    }
  }, [clearLongPressTimer]);

  const handleEnd = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleClick = useCallback((e: any) => {
    if (isLongPressTriggered.current || Date.now() - lastLongPressDeleteTimestamp < 600) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      isLongPressTriggered.current = false;
      return;
    }
    if (loadItemRef.current && itemRef.current) {
      loadItemRef.current(itemRef.current);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const formatProcessingTime = (timeStr: string) => {
    if (!timeStr) return timeStr;
    
    if (timeStr.endsWith('s') && !timeStr.includes('m') && !timeStr.includes(':')) {
      const totalSecs = parseInt(timeStr.replace('s', ''), 10);
      if (!isNaN(totalSecs)) {
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        if (mins > 0) {
          return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        } else {
          return `${secs}s`;
        }
      }
    }

    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      if (parts.length === 2) {
        const mins = parseInt(parts[0], 10);
        const secs = parseInt(parts[1], 10);
        if (!isNaN(mins) && !isNaN(secs)) {
          if (mins > 0) {
            return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
          } else {
            return `${secs}s`;
          }
        }
      }
    }
    
    return timeStr;
  };

  return {
    isPressing,
    handleStart,
    handleMove,
    handleEnd,
    handleClick,
    handleTouchEnd,
    formatProcessingTime
  };
};

