import { useState, useEffect } from 'react';

/**
 * How far below the top of its scroll container a virtual list starts. The sidebar scrolls the upload area,
 * file details and the batch list together with the history, so without this the list draws the rows for
 * the wrong place and leaves a blank gap under the stuck history header. Measured again whenever anything
 * in the container changes size or is added.
 */
export const useListScrollMargin = (scrollEl: HTMLElement | null) => {
  const [listEl, setListEl] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    if (!listEl || !scrollEl) return;
    const update = () => {
      const margin = Math.round(listEl.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop);
      setScrollMargin(prev => (prev === margin ? prev : margin));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const resizes = new ResizeObserver(update);
    const watchChildren = () => {
      resizes.disconnect();
      // The whole box, so padding and borders count too
      for (const child of Array.from(scrollEl.children)) resizes.observe(child, { box: 'border-box' });
    };
    watchChildren();
    const additions = new MutationObserver(() => { watchChildren(); update(); });
    additions.observe(scrollEl, { childList: true });
    return () => { resizes.disconnect(); additions.disconnect(); };
  }, [listEl, scrollEl]);

  return { listRef: setListEl, scrollMargin };
};
