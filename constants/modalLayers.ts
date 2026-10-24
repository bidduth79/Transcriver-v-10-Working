// Stacking order of the full-screen layers, lowest first (whole class names, so Tailwind can find them).
// The header (z-[70]), footer (z-[60]) and the expanded history (z-[150]) sit between these.
export const MODAL_LAYER = {
  view: 'z-[90]', // full-screen analysis view
  panel: 'z-[110]', // working windows: summary, report, settings, activity logs, user manual
  minimized: 'z-[120]', // the small button a minimised window leaves behind
  drawerBackdrop: 'z-[160]', // speaker profile drawer
  drawer: 'z-[161]',
  dialog: 'z-[200]', // confirm, batch summary, shortcuts, transcriber report
  dialogOverlay: 'z-[210]', // a prompt opened from a dialog (shortcut capture)
  success: 'z-[300]',
} as const;

// The same dimmed, blurred page behind every modal
export const MODAL_BACKDROP = 'bg-slate-950/60 backdrop-blur-md';
