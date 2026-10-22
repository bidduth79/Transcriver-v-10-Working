import React, { useState, useMemo, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { buildDuplicateCounts, searchAndGroupHistory, flattenGroups, collectHistoryDates, buildCalendarDays } from '../utils/historyListUtils';

interface Options {
  history: any[];
  fullHistory: any[];
  initialGroupedHistory: any;
  scrollContainerEl: HTMLElement | null;
  activeHistoryId: string | null;
}

// Search, grouping, virtualization and calendar data for the sidebar history list
export const useHistoryListData = ({ history, fullHistory, initialGroupedHistory, scrollContainerEl, activeHistoryId }: Options) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isSentimentPickerOpen, setIsSentimentPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());

  // Close Pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setIsDatePickerOpen(false);
      setIsSentimentPickerOpen(false);
    };
    if (isDatePickerOpen || isSentimentPickerOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isDatePickerOpen, isSentimentPickerOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const duplicateFileCounts = useMemo(() => buildDuplicateCounts(history), [history]);

  const processedGroupedHistory = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return initialGroupedHistory;
    }
    // Perform search on the entire history array, including transcript content
    const sourceArray = fullHistory && fullHistory.length > 0 ? fullHistory : (history || []);
    return searchAndGroupHistory(sourceArray, debouncedSearchQuery);
  }, [history, fullHistory, initialGroupedHistory, debouncedSearchQuery]);

  const flatItems = useMemo(
    () => flattenGroups(processedGroupedHistory, duplicateFileCounts),
    [processedGroupedHistory, duplicateFileCounts]
  );

  const flatItemsRef = React.useRef(flatItems);
  flatItemsRef.current = flatItems;

  const getScrollElement = React.useCallback(() => scrollContainerEl, [scrollContainerEl]);
  const estimateSize = React.useCallback(
    (index: number) => (flatItemsRef.current[index]?.type === 'header' ? 44 : 126),
    []
  );
  const getItemKey = React.useCallback((index: number) => {
    const flatItem = flatItemsRef.current[index];
    if (!flatItem) return index;
    return flatItem.type === 'header' ? `header-${flatItem.group}` : `item-${flatItem.item?.id ?? index}`;
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement,
    estimateSize,
    getItemKey,
    overscan: 8,
    useFlushSync: false,
  });

  const availableDateStrings = useMemo(
    () => (isDatePickerOpen ? collectHistoryDates(fullHistory || history || []) : new Set<string>()),
    [fullHistory, history, isDatePickerOpen]
  );

  const calendarDays = useMemo(
    () => (isDatePickerOpen ? buildCalendarDays(viewDate) : []),
    [viewDate, isDatePickerOpen]
  );

  // Smoothly scroll to active item to prevent layout jump when FileInfoSection mounts
  const prevActiveIdRef = React.useRef(activeHistoryId);
  useEffect(() => {
    if (!activeHistoryId) {
      prevActiveIdRef.current = null;
      return;
    }
    if (activeHistoryId !== prevActiveIdRef.current) {
      prevActiveIdRef.current = activeHistoryId;
      const index = flatItems.findIndex((i: any) => i.type === 'item' && i.item?.id === activeHistoryId);
      if (index !== -1) {
        const timer = setTimeout(() => {
          try {
            rowVirtualizer.scrollToIndex(index, { align: 'auto', behavior: 'smooth' });
          } catch (e) {
            // ignore
          }
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [activeHistoryId]);

  return {
    isSearchOpen, setIsSearchOpen,
    isDatePickerOpen, setIsDatePickerOpen,
    isSentimentPickerOpen, setIsSentimentPickerOpen,
    searchQuery, setSearchQuery,
    isLoadingDate, setIsLoadingDate,
    viewDate, setViewDate,
    processedGroupedHistory, flatItems, rowVirtualizer,
    availableDateStrings, calendarDays,
  };
};

export type HistoryListData = ReturnType<typeof useHistoryListData>;
