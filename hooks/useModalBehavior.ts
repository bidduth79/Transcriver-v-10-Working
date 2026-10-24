import { useEffect, useRef, type MouseEvent } from 'react';

// Open modals, newest last: only the top one answers Esc and keeps the keyboard focus
const openModals: object[] = [];
let savedBodyOverflow = '';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keeps Tab and Shift+Tab cycling through the dialog's own controls
const keepFocusInside = (dialog: HTMLElement, e: KeyboardEvent) => {
  const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (items.length === 0) {
    e.preventDefault();
    dialog.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const current = document.activeElement;
  if (!dialog.contains(current)) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && (current === first || current === dialog)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && current === last) {
    e.preventDefault();
    first.focus();
  }
};

/**
 * Shared dialog behaviour: Esc closes the top-most open modal, Tab stays inside it, the page behind
 * does not scroll, focus returns to where it was when the modal closes, and a click on the backdrop
 * closes it. `active` is false while the modal is closed or minimised.
 * Spread `dialogProps` on the dialog box and `backdropProps` on the full-screen layer around it.
 */
export const useModalBehavior = <T extends HTMLElement = HTMLDivElement>(active: boolean, onClose: () => void) => {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  // A press that starts inside the dialog (resizing, selecting text) and ends on the backdrop is not a click on it
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const token = {};
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openModals.push(token);
    if (openModals.length === 1) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    // Focus the dialog unless something inside already took focus (e.g. an autoFocus input)
    const focusTimer = setTimeout(() => {
      const dialog = dialogRef.current;
      if (dialog && !dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== token || e.defaultPrevented) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === 'Tab' && dialogRef.current) {
        keepFocusInside(dialogRef.current, e);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      openModals.splice(openModals.indexOf(token), 1);
      if (openModals.length === 0) document.body.style.overflow = savedBodyOverflow;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
    };
  }, [active]);

  const dialogProps = { ref: dialogRef, role: 'dialog' as const, 'aria-modal': true, tabIndex: -1 };
  const backdropProps = {
    onMouseDown: (e: MouseEvent) => {
      pressedOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e: MouseEvent) => {
      if (pressedOnBackdrop.current && e.target === e.currentTarget) onCloseRef.current();
      pressedOnBackdrop.current = false;
    },
  };
  return { dialogProps, backdropProps };
};
