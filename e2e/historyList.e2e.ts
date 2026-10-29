import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openApp, sleep, type AppSession } from './browser';

let app: AppSession;

beforeEach(async () => { app = await openApp(); });
afterEach(async () => { await app.close(); });

// Space under the stuck history header that has no row drawn in it, at a few scroll positions
const gapsUnderHeader = () => app.page.evaluate(async () => {
  const list = document.querySelector<HTMLElement>('div[data-index]')!.parentElement!;
  let scroller: HTMLElement | null = list;
  while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 5 && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
  const header = [...scroller!.querySelectorAll<HTMLElement>('*')].find(n => getComputedStyle(n).position === 'sticky' && n.getBoundingClientRect().height > 20)!;
  const gaps: number[] = [];
  for (const extra of [0, 400, 1500, 4000]) {
    scroller!.scrollTop = 0;
    scroller!.scrollTop = header.getBoundingClientRect().top - scroller!.getBoundingClientRect().top + extra;
    await new Promise(r => setTimeout(r, 600));
    const bottom = header.getBoundingClientRect().bottom;
    const rows = [...document.querySelectorAll<HTMLElement>('div[data-index]')].map(e => e.getBoundingClientRect()).filter(b => b.bottom > bottom);
    gaps.push(Math.round(Math.min(...rows.map(b => b.top)) - bottom));
  }
  return gaps;
});

describe('history list', () => {
  it('leaves no blank space under the stuck header, however much sits above the list', async () => {
    await app.page.evaluate(() => new Promise<void>((resolve) => {
      const open = indexedDB.open('LiCellStudioDB_v5_Final');
      open.onsuccess = () => {
        const tx = open.result.transaction(['studio_history'], 'readwrite');
        const store = tx.objectStore('studio_history');
        for (let i = 0; i < 1500; i++) store.put({ id: 'g' + i, fileName: `gap-${i}.opus`, duration: '10:00', channelName: '', publishedDate: '', date: new Date(Date.UTC(2026, 9, 29, 12) - i * 1800000).toISOString(), transcript: 'লেখা', timeTaken: '30s' });
        tx.oncomplete = () => { open.result.close(); resolve(); };
      };
    }));
    await app.page.reload({ waitUntil: 'networkidle0' });
    await sleep(2500);
    // Like file details, a waveform and a batch list above the history: push the list far down
    await app.page.evaluate(() => {
      let scroller: HTMLElement | null = document.querySelector<HTMLElement>('div[data-index]')!.parentElement;
      while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 5 && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
      (scroller!.firstElementChild as HTMLElement).style.paddingTop = '1500px';
    });
    await sleep(500);
    // Only the date label row (44 px) may sit between the header and the first card
    for (const gap of await gapsUnderHeader()) expect(gap).toBeLessThan(50);
    expect(app.errors).toEqual([]);
  });
});
