import { printHtmlInFrame } from '../../common/print/printHtmlInFrame';
import type { HistoryItem } from '../../../types';

// Helpers for the transcriber activity report (rows, pages, CSV, printing)

export const parseDurationToSeconds = (dur: string) => {
  if (!dur) return 0;
  const parts = dur.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
};

export const formatSecondsToHrsMin = (totalSecs: number) => {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  return `${hrs.toString().padStart(2, '0')} Hrs ${mins.toString().padStart(2, '0')} Min`;
};

// Group history in [fromDate, toDate] by day + Audio/Video, oldest day first
// One report line: how many files of a type were done on a day, and their total length
export interface ReportRow {
  date: string;
  method: string;
  fileType: 'Audio' | 'Video';
  qty: number;
  durationSecs: number;
}

export const buildReportRows = (history: HistoryItem[], fromDate: string, toDate: string): ReportRow[] => {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  const filtered = history.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= start && itemDate <= end;
  });

  const grouped: Record<string, ReportRow> = {};

  filtered.forEach(item => {
    const dateKey = new Date(item.date).toLocaleDateString('en-GB'); 
    const isVideo = ['mp4', 'mkv', 'webm', 'avi', 'mov'].includes(String(item.extension || '').toLowerCase());
    const fileType: ReportRow['fileType'] = isVideo ? 'Video' : 'Audio';
    const method = item.fileName.includes('http') ? 'Youtube Link' : 'File Upload'; 
    
    const key = `${dateKey}-${fileType}`;

    if (!grouped[key]) {
      grouped[key] = {
        date: dateKey,
        method: method,
        fileType: fileType,
        qty: 0,
        durationSecs: 0
      };
    }

    grouped[key].qty += 1;
    grouped[key].durationSecs += parseDurationToSeconds(item.duration);
  });

  const rows = Object.values(grouped).sort((a, b) => {
      const dateA = a.date.split('/').reverse().join('-');
      const dateB = b.date.split('/').reverse().join('-');
      return dateA.localeCompare(dateB);
  });
  return rows;
};

export const ROWS_FIRST_PAGE = 24;
export const ROWS_OTHER_PAGES = 30;

// The first A4 page has the report header, so it holds fewer rows
export const paginateReportRows = (reportData: ReportRow[]) => {
  const pages: ReportRow[][] = [];
  let dataCopy = [...reportData];
  
  if (dataCopy.length === 0) {
    return [[]];
  }

  pages.push(dataCopy.splice(0, ROWS_FIRST_PAGE));
  
  while(dataCopy.length > 0) {
    pages.push(dataCopy.splice(0, ROWS_OTHER_PAGES));
  }
  return pages;
};

// Prints the rendered report pages from a hidden frame in this page (no popup window); saved as PDF from the dialog
export const printReportElement = (element: HTMLElement, fromDate: string, toDate: string) => {
  printHtmlInFrame(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Transcriber_Report_${fromDate}_to_${toDate}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
            body {
              margin: 0;
              padding: 20px;
              background-color: #52525b;
              display: flex;
              flex-direction: column;
              align-items: center;
              font-family: 'Hind Siliguri', sans-serif;
            }
            @media print {
              @page { size: A4 portrait; margin: 0; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #ffffff; padding: 0; display: block; }
              .page-break { page-break-after: always !important; }
              .report-page { display: block !important; height: auto !important; min-height: 297mm !important; }
            }
          </style>
        </head>
        <body>
          <div style="display: flex; flex-direction: column; gap: 2rem;">
            ${element.innerHTML}
          </div>
        </body>
      </html>
    `, { fontWaitMs: 1500 });
};

export const buildReportCsv = (reportData: ReportRow[], totalQty: number, totalDurationSecs: number) => {
  const escapeCSV = (str: unknown) => {
    if (str === null || str === undefined) return '""';
    const stringified = String(str);
    if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
      return `"${stringified.replace(/"/g, '""')}"`;
    }
    return stringified;
  };

  let csvContent = "\uFEFF"; 
  csvContent += "Sl No,Transcriber Date,Using Method,File Type,Qty,Duration,Remarks\n";

  reportData.forEach((row, index) => {
      const dur = formatSecondsToHrsMin(row.durationSecs);
      csvContent += `${index + 1},${escapeCSV(row.date)},${escapeCSV(row.method)},${escapeCSV(row.fileType)},${row.qty},${escapeCSV(dur)},""\n`;
  });

  csvContent += `,,,Total-,${totalQty},${escapeCSV(formatSecondsToHrsMin(totalDurationSecs))},""\n`;
  return csvContent;
};
