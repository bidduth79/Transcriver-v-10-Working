import { useState, useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { STORES, getAllFromStore } from '../../../services/db';
import type { SystemLogItem } from '../../../services/SystemLogger';
import { sortLogsNewestFirst, filterLogs } from './activityLogUtils';

const PAGE_SIZE = 50;

// Loads activity logs while the modal is open (and on store updates), with filters and "load more" paging
export const useActivityLogs = (isOpen: boolean) => {
  const [logs, setLogs] = useState<SystemLogItem[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLogItem[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  const loadLogs = async () => {
    try {
      const data = (await getAllFromStore(STORES.SYSTEM_ACTIVITY_LOGS)) as SystemLogItem[];
      if (!Array.isArray(data)) return;
      const validData = sortLogsNewestFirst(data);
      setLogs(validData);
      setFilteredLogs(validData);
    } catch (error) {
      console.error("Failed to load activity logs:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const activityLogUpdates = useAppStore(state => state.storeUpdates['activity_logs']);
  useEffect(() => {
    if (isOpen) loadLogs();
  }, [activityLogUpdates, isOpen]);

  useEffect(() => {
    setFilteredLogs(filterLogs(logs, { category: filterCategory, status: filterStatus, dateFrom, dateTo }));
    setDisplayCount(PAGE_SIZE); // Reset pagination on filter change
  }, [filterCategory, filterStatus, dateFrom, dateTo, logs]);

  return {
    filteredLogs,
    filterCategory, setFilterCategory,
    filterStatus, setFilterStatus,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    displayCount,
    loadMore: () => setDisplayCount(prev => prev + PAGE_SIZE),
  };
};

export type ActivityLogsState = ReturnType<typeof useActivityLogs>;
