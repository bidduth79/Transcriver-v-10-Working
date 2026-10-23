interface PrintOptions {
  // Longest wait for web fonts (e.g. Hind Siliguri) before printing
  fontWaitMs?: number;
  onBeforePrint?: () => void;
}

const FRAME_STYLE = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
const FALLBACK_CLEANUP_MS = 60000;

/**
 * Prints a complete HTML document from a hidden frame inside this page. No new window is opened, so
 * popup blockers and sandboxed iframes (such as AI Studio's preview) cannot stop it. The user saves
 * the result as PDF from the browser's print dialog; the frame is removed afterwards.
 */
export const printHtmlInFrame = (html: string, { fontWaitMs = 300, onBeforePrint }: PrintOptions = {}) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.title = 'print';
  frame.style.cssText = FRAME_STYLE;
  document.body.appendChild(frame);

  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  if (!win || !doc) {
    frame.remove();
    throw new Error('Print frame is not available');
  }
  doc.open();
  doc.write(html);
  doc.close();

  const remove = () => frame.remove();
  win.onafterprint = () => setTimeout(remove, 100);

  const fontsReady = doc.fonts?.ready ?? Promise.resolve();
  Promise.race([fontsReady, new Promise(resolve => setTimeout(resolve, fontWaitMs))]).then(() => {
    setTimeout(() => {
      onBeforePrint?.();
      try {
        win.focus();
        win.print();
      } catch (err) {
        console.error('Print failed:', err);
        remove();
      }
      // Browsers that never fire "afterprint"
      setTimeout(remove, FALLBACK_CLEANUP_MS);
    }, 50);
  });
  return frame;
};
