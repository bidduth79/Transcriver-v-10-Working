import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ElementHandle } from 'puppeteer';
import { openApp, historyCount, waitFor, clickButton, bodyText, makeWavFiles, sleep, type AppSession } from './browser';

let app: AppSession;

beforeEach(async () => { app = await openApp(); });
afterEach(async () => { await app.close(); });

const singleFileInput = async () => {
  for (const input of await app.page.$$('input[type=file]')) {
    const single = await input.evaluate(el => !(el as HTMLInputElement).multiple && !(el as HTMLInputElement).accept.includes('.json'));
    if (single) return input as ElementHandle<HTMLInputElement>;
  }
  throw new Error('No single file input');
};

const transcribe = async (path: string, name: string) => {
  await (await singleFileInput()).uploadFile(path);
  await waitFor(async () => (await bodyText(app.page)).includes(name), 10000, 'file info');
  await app.page.evaluate(() => {
    const start = [...document.querySelectorAll('button')].find(b => b.offsetParent && /শুরু করুন$/.test(b.innerText.trim()) && b.innerText.trim().length > 10);
    start?.click();
  });
};

// Clicks the history card of a saved file in the left panel
const openFromHistory = (name: string) => app.page.evaluate((fileName) => {
  const cards = [...document.querySelectorAll<HTMLElement>('.cursor-pointer')].filter(el =>
    el.offsetParent && el.getBoundingClientRect().left < 400 && el.innerText.includes(fileName.replace(/\.wav$/, '')));
  cards[cards.length - 1]?.click();
  return cards.length > 0;
}, name);

describe('a transcription running while a saved transcript is open', () => {
  it('goes on in the background without taking the screen, then offers its result', async () => {
    const [first, second] = makeWavFiles(['saved-first.wav', 'running-second.wav']);
    await transcribe(first, 'saved-first.wav');
    await waitFor(async () => (await historyCount(app.page)) === 1, 30000, 'first transcript saved');

    app.setGeminiDelay(6000);
    await transcribe(second, 'running-second.wav');
    await sleep(1500);
    expect(await openFromHistory('saved-first')).toBe(true);
    await waitFor(async () => (await bodyText(app.page)).includes('পরীক্ষার লেখা নম্বর 1'), 10000, 'first transcript on screen');
    expect(await bodyText(app.page)).toContain('পেছনে ট্রান্সক্রাইব চলছে');

    // The second file finishes and is saved, but the open transcript stays on screen
    await waitFor(async () => (await historyCount(app.page)) === 2, 30000, 'second transcript saved');
    await waitFor(async () => (await bodyText(app.page)).includes('ট্রান্সক্রাইব শেষ'), 10000, 'finished notice');
    const screen = await bodyText(app.page);
    expect(screen).toContain('পরীক্ষার লেখা নম্বর 1');
    expect(screen).not.toContain('পরীক্ষার লেখা নম্বর 2');

    // "Open" shows the new transcript
    expect(await clickButton(app.page, 'খুলুন')).toBe(true);
    await waitFor(async () => (await bodyText(app.page)).includes('পরীক্ষার লেখা নম্বর 2'), 10000, 'second transcript on screen');
    expect(app.errors).toEqual([]);
  });

  it('"Show" brings the running job back to the screen, and its result appears there', async () => {
    const [first, second] = makeWavFiles(['saved-one.wav', 'running-two.wav']);
    await transcribe(first, 'saved-one.wav');
    await waitFor(async () => (await historyCount(app.page)) === 1, 30000, 'first transcript saved');

    app.setGeminiDelay(6000);
    await transcribe(second, 'running-two.wav');
    await sleep(1500);
    expect(await openFromHistory('saved-one')).toBe(true);
    await waitFor(async () => (await bodyText(app.page)).includes('পেছনে ট্রান্সক্রাইব চলছে'), 10000, 'background notice');
    expect(await clickButton(app.page, 'দেখুন')).toBe(true);
    await waitFor(async () => !(await bodyText(app.page)).includes('পেছনে ট্রান্সক্রাইব চলছে'), 5000, 'notice gone');
    expect(await bodyText(app.page)).not.toContain('পরীক্ষার লেখা নম্বর 1');
    await waitFor(async () => (await bodyText(app.page)).includes('পরীক্ষার লেখা নম্বর 2'), 30000, 'result on screen');
    expect(app.errors).toEqual([]);
  });
});
