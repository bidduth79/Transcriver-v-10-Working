import type { SystemLogItem } from '../../../services/SystemLogger';

export interface LogFilters {
  category: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

const timeOf = (ts: any) => {
  const time = ts ? new Date(ts).getTime() : 0;
  return isNaN(time) ? 0 : time;
};

// Drop empty entries and sort newest first (missing/invalid timestamps go last)
export const sortLogsNewestFirst = (data: SystemLogItem[]) =>
  data.filter(item => item != null).sort((a: any, b: any) => timeOf(b.timestamp) - timeOf(a.timestamp));

export const filterLogs = (logs: SystemLogItem[], { category, status, dateFrom, dateTo }: LogFilters) => {
  let res = logs;
  if (category !== 'ALL') {
    res = res.filter(l => l.category === category);
  }
  if (status !== 'ALL') {
    res = res.filter(l => l.status === status);
  }
  if (dateFrom) {
    res = res.filter(l => new Date(l.timestamp) >= new Date(dateFrom));
  }
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59);
    res = res.filter(l => new Date(l.timestamp) <= end);
  }
  return res;
};

export const getStatusColor = (status: string) => {
  switch(status) {
    case 'SUCCESS': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    case 'ERROR': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    case 'WARNING': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
  }
};

export const safeFormatDate = (dateStr: string | undefined) => {
  if (!dateStr) return { date: 'N/A', time: 'N/A', valid: false };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { date: 'Invalid', time: 'Invalid', valid: false };
  return {
    date: d.toLocaleDateString(),
    time: d.toLocaleTimeString(),
    valid: true
  };
};
