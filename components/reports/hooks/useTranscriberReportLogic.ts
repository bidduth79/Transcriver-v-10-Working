import { useState, useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { loadLightHistory } from '../../../services/historyRecords';
import { toLocalIsoDate } from '../../../utils/timeUtils';
import {
  formatSecondsToHrsMin, buildReportRows, paginateReportRows, printReportElement, buildReportCsv,
  ROWS_FIRST_PAGE, ROWS_OTHER_PAGES,
} from './transcriberReportUtils';
import type { HistoryItem } from '../../../types';
import type { ReportRow } from './transcriberReportUtils';

export const useTranscriberReportLogic = (isOpen: boolean) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setFromDate(toLocalIsoDate(firstDay));
    setToDate(toLocalIsoDate(lastDay));
  }, []);

  const historyUpdates = useAppStore(state => state.storeUpdates['studio_history']);
  
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, historyUpdates]);

  const loadHistory = async () => {
    // The report needs dates, types and lengths only, never the transcripts
    setHistory(await loadLightHistory());
  };

  useEffect(() => {
    if (!history.length) return;
    setReportData(buildReportRows(history, fromDate, toDate));
  }, [history, fromDate, toDate]);

  const totalQty = reportData.reduce((acc, curr) => acc + curr.qty, 0);
  const totalDurationSecs = reportData.reduce((acc, curr) => acc + curr.durationSecs, 0);
  const pages = paginateReportRows(reportData);

  const handleDownloadPDF = () => {
    const element = document.getElementById('report-content');
    if (!element) return;
    printReportElement(element, fromDate, toDate);
  };

  const handleDownloadExcel = () => {
    const csvContent = buildReportCsv(reportData, totalQty, totalDurationSecs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return {
    fromDate, setFromDate,
    toDate, setToDate,
    reportData,
    totalQty,
    totalDurationSecs,
    pages,
    formatSecondsToHrsMin,
    handleDownloadPDF,
    handleDownloadExcel,
    ROWS_FIRST_PAGE,
    ROWS_OTHER_PAGES
  };
};
