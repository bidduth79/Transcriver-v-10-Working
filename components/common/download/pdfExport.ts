import { toast } from 'sonner';
import { normalizeTimestamps } from './exportContent';
import { printHtmlInFrame } from '../print/printHtmlInFrame';
import { messageOf } from '../../../utils/errorMessage';
import { uiText } from '../../../utils/uiText';
import { currentAppLang } from '../../../hooks/useThemeStore';

const TOAST_ID = 'pdf-export-toast';

interface PdfOptions {
  transcript: unknown;
  fileName: string;
  searchTerm: string;
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

// Prints from a hidden frame in this page (no popup window); the user saves it as PDF from the print dialog
export const printTranscriptAsPdf = (options: PdfOptions) => {
  try {
    // Show brief notification that disappears quickly
    toast.info(uiText(currentAppLang(), 'pdfPreparing'), { id: TOAST_ID, duration: 1500 });
    printHtmlInFrame(buildPdfHtml(options), {
      fontWaitMs: 300,
      onBeforePrint: () => toast.success(uiText(currentAppLang(), 'pdfReady'), { id: TOAST_ID, duration: 1200 }),
    });
  } catch (error) {
    console.error('PDF Export Error:', error);
    toast.error(uiText(currentAppLang(), 'pdfErrorWith', { message: messageOf(error) }), { id: TOAST_ID, duration: 2500 });
  }
};
