// Fast M/D/YYYY key (avoids slow toLocaleDateString in tight loops)
export const toDateKey = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

export const buildDuplicateCounts = (history: any[]) => {
  const counts: Record<string, number> = {};
  (history || []).forEach((h: any) => {
    if (!counts[h.fileName]) counts[h.fileName] = 0;
    counts[h.fileName]++;
  });
  return counts;
};

// Search file names and transcript content, then group the matches by date
export const searchAndGroupHistory = (sourceArray: any[], query: string) => {
  const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const filtered = sourceArray.filter((item: any) => {
    const rawFileName = item.fileName || '';
    const displayFileName = rawFileName.replace(/_/g, ' ').replace(/#/g, '').replace(/\s+/g, ' ').trim();
    const fileNameMatch = searchRegex.test(rawFileName) || searchRegex.test(displayFileName);
    const transcriptMatch = searchRegex.test(item.transcript || item.text || '');
    return fileNameMatch || transcriptMatch;
  });

  const groups: any = {};
  filtered.forEach((item: any) => {
    let d = 'Unknown Date';
    if (item.date) {
      try {
        const dateObj = new Date(item.date);
        if (!isNaN(dateObj.getTime())) {
          d = toDateKey(dateObj);
        }
      } catch(e) {}
    }
    if (!groups[d]) groups[d] = [];
    groups[d].push(item);
  });
  return groups;
};

export type FlatHistoryRow =
  | { type: 'header'; group: string; count: number }
  | { type: 'item'; item: any; isDuplicate: boolean; group: string };

export const flattenGroups = (groups: Record<string, any[]>, duplicateCounts: Record<string, number>) => {
  const arr: FlatHistoryRow[] = [];
  Object.entries(groups).forEach(([group, items]) => {
    arr.push({ type: 'header', group, count: (items as any[]).length });
    (items as any[]).forEach(item => {
      arr.push({ type: 'item', item, isDuplicate: duplicateCounts[item.fileName] > 1, group });
    });
  });
  return arr;
};

export const collectHistoryDates = (items: any[]) => {
  const dates = new Set<string>();
  (items || []).forEach((item: any) => {
    if (item?.date) {
      try {
        const dateStr = item.date;
        if (dateStr.length >= 10 && dateStr[4] === '-' && dateStr[7] === '-') {
          const year = dateStr.substring(0, 4);
          const month = parseInt(dateStr.substring(5, 7), 10);
          const day = parseInt(dateStr.substring(8, 10), 10);
          dates.add(`${month}/${day}/${year}`);
        } else {
          const dateObj = new Date(dateStr);
          if (!isNaN(dateObj.getTime())) {
            dates.add(toDateKey(dateObj));
          }
        }
      } catch(e) {}
    }
  });
  return dates;
};

export interface CalendarDay { day: number; isCurrentMonth: boolean; date: Date; dateStr: string }

// 6-week (42 cell) month grid including leading/trailing days of adjacent months
export const buildCalendarDays = (viewDate: Date): CalendarDay[] => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cell = (day: number, isCurrentMonth: boolean, d: Date) => ({ day, isCurrentMonth, date: d, dateStr: toDateKey(d) });

  const days: CalendarDay[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push(cell(prevMonthDays - i, false, new Date(year, month - 1, prevMonthDays - i)));
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(cell(i, true, new Date(year, month, i)));
  }
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push(cell(i, false, new Date(year, month + 1, i)));
  }
  return days;
};
