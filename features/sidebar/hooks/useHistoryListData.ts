import React, { useState, useMemo, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { buildDuplicateCounts, searchAndGroupHistory, flattenGroups, collectHistoryDates, buildCalendarDays } from '../utils/historyListUtils';
import { useTranscriptSearchIds } from '../../../hooks/history/useTranscriptSearchIds';
import type { HistoryItem } from '../../../types';
import type { HistoryGroups } from '../utils/historyListUtils';

interface Options {
  history: HistoryItem[];
  fullHistory: HistoryItem[];
  initialGroupedHistory: HistoryGroups;
  scrollContainerEl: HTMLElement | null;
  activeHistoryId: string | null;
}

// Search, grouping, virtualization and calendar data for the sidebar history list
export const useHistoryListData = ({ history, fullHistory, initialGroupedHistory, scrollContainerEl }: Options) => {
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
  const searchSource = useMemo(
    () => (fullHistory && fullHistory.length > 0 ? fullHistory : (history || [])),
    [fullHistory, history]
  );
  const transcriptMatchIds = useTranscriptSearchIds(debouncedSearchQuery, searchSource.length);

  const processedGroupedHistory = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return initialGroupedHistory;
    }
    // Perform search on the entire history array, including saved transcript content
    return searchAndGroupHistory(searchSource, debouncedSearchQuery, transcriptMatchIds);
  }, [searchSource, initialGroupedHistory, debouncedSearchQuery, transcriptMatchIds]);

  const flatItems = useMemo(
    () => flattenGroups(processedGroupedHistory, duplicateFileCounts),
    [processedGroupedHistory, duplicateFileCounts]
  );

  const flatItemsRef = React.useRef(flatItems);
  flatItemsRef.current = flatItems;

  const getScrollElement = React.useCallback(() => scrollContainerEl, [scrollContainerEl]);
  const estimateSize = React.useCallback(
    // A first guess only; rows are measured once shown
    (index: number) => (flatItemsRef.current[index]?.type === 'header' ? 44 : 125),
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

  // After a day is brought from the cloud, scroll to it once the reloaded list contains it
  const pendingScrollGroupRef = React.useRef<string | null>(null);
  const scrollToGroupWhenListed = React.useCallback((group: string) => { pendingScrollGroupRef.current = group; }, []);
  useEffect(() => {
    const group = pendingScrollGroupRef.current;
    if (!group) return;
    const index = flatItems.findIndex(i => i.type === 'header' && i.group === group);
    if (index === -1) return;
    pendingScrollGroupRef.current = null;
    rowVirtualizer.scrollToIndex(index, { align: 'start' });
  }, [flatItems, rowVirtualizer]);
  // Loading an item does not scroll the list: the sidebar stays where the user left it

  return {
    isSearchOpen, setIsSearchOpen,
    isDatePickerOpen, setIsDatePickerOpen,
    isSentimentPickerOpen, setIsSentimentPickerOpen,
    searchQuery, setSearchQuery,
    isLoadingDate, setIsLoadingDate,
    viewDate, setViewDate,
    processedGroupedHistory, flatItems, rowVirtualizer,
    availableDateStrings, calendarDays, scrollToGroupWhenListed,
  };
};

export type HistoryListData = ReturnType<typeof useHistoryListData>;
