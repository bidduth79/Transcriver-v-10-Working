import { toast } from 'sonner';
import { normalizeTimestamps } from './exportContent';

const TOAST_ID = 'pdf-export-toast';

interface PdfOptions {
  transcript: any;
  fileName: string;
  searchTerm: any;
  keywordRegex: RegExp | null;
}

const buildPdfHtml = ({ transcript, fileName, searchTerm, keywordRegex }: PdfOptions) => {
  const headerHtml = `
        <div style="border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #4338ca;">LI CELL STUDIO</h1>
            <p style="margin: 5px 0 0 0; font-size: 10px; font-weight: 900; color: #64748b; letter-spacing: 2px;">TRANSCRIPTION EXPORT ${searchTerm ? '(SEARCH HIGHLIGHTED)' : ''}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 10px; font-weight: 700; color: #94a3b8;">DATE: ${new Date().toLocaleDateString()}</p>
            <p style="margin: 5px 0 0 0; font-size: 10px; font-weight: 700; color: #94a3b8;">FILE: ${fileName}</p>
          </div>
        </div>
      `;

  let searchRegex: RegExp | null = null;
  if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim() !== '') {
    const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    searchRegex = new RegExp(`(${escapedSearch})`, 'gi');
  }

  const highlightText = (text: string) => {
    let processed = text;
    if (searchRegex) {
      processed = processed.replace(searchRegex, '<mark style="background-color: #f97316; color: white; padding: 0 2px; border-radius: 2px;">$1</mark>');
    }
    if (keywordRegex) {
      processed = processed.replace(keywordRegex, '<mark style="background-color: #ef4444; color: white; padding: 0 4px; border-radius: 4px; font-weight: bold;">$1</mark>');
    }
    return processed;
  };

  const lines = normalizeTimestamps(transcript).split('\n').filter((l: string) => l && typeof l === 'string');
  const contentHtml = lines.map((line: string) => {
    const processedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #4338ca; font-weight: 700;">$1</strong>');
    return `<p style="margin-bottom: 15px; line-height: 1.6; font-size: 13px;">${highlightText(processedLine)}</p>`;
  }).join('');

  return `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${fileName}_transcript</title>
            <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
              body { 
                font-family: 'Hind Siliguri', 'Kalpurush', 'SolaimanLipi', 'Inter', -apple-system, sans-serif; 
                padding: 40px; 
                color: #1e293b; 
                background-color: #ffffff;
              }
              @media print {
                @page { margin: 20mm; }
                body { 
                  -webkit-print-color-adjust: exact; 
                  print-color-adjust: exact; 
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            ${headerHtml}
            <div id="transcript-content">
              ${contentHtml}
            </div>
          </body>
        </html>
      `;
};

// Opens a print-ready window; the user saves it as PDF from the browser print dialog
export const printTranscriptAsPdf = (options: PdfOptions, addToast?: (msg: string, type: string) => void) => {
  try {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if (addToast) addToast('পপ-আপ ব্লক করা আছে। দয়া করে পপ-আপ অ্যালাউ করুন।', 'error');
      return;
    }

    // Show brief notification that disappears quickly
    toast.info('PDF প্রস্তুত করা হচ্ছে...', { id: TOAST_ID, duration: 1500 });

    printWindow.document.write(buildPdfHtml(options));
    printWindow.document.close();

    const triggerPrint = () => {
      if (!printWindow || printWindow.closed) return;
      toast.success('PDF প্রস্তুত হয়েছে!', { id: TOAST_ID, duration: 1200 });
      try {
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.error(e);
      }
    };

    printWindow.onafterprint = () => {
      try {
        printWindow.close();
      } catch (e) {}
    };

    // Fast font load fallback (max 300ms) to prevent long freezes
    if (printWindow.document.fonts) {
      Promise.race([
        printWindow.document.fonts.ready,
        new Promise(resolve => setTimeout(resolve, 300))
      ]).then(() => {
        setTimeout(triggerPrint, 50);
      });
    } else {
      setTimeout(triggerPrint, 50);
    }
  } catch (error: any) {
    console.error('PDF Export Error:', error);
    toast.error(`PDF এরর: ${error.message}`, { id: TOAST_ID, duration: 2500 });
  }
};
