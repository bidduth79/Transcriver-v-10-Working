import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ElementHandle } from 'puppeteer';
import { openApp, historyCount, waitFor, clickButton, bodyText, makeWavFiles, sleep, type AppSession } from './browser';

let app: AppSession;

beforeEach(async () => { app = await openApp(); });
afterEach(async () => { await app.close(); });

const fileInput = async (multiple: boolean) => {
  for (const input of await app.page.$$('input[type=file]')) {
    const matches = await input.evaluate((el, many) => (el as HTMLInputElement).multiple === many && !(el as HTMLInputElement).accept.includes('.json'), multiple);
    if (matches) return input as ElementHandle<HTMLInputElement>;
  }
  throw new Error(`No ${multiple ? 'multi' : 'single'} file input`);
};

describe('app in a real browser', () => {
  it('loads without errors', async () => {
    expect(await app.page.title()).toBe('LI CELL Transcription Studio');
    expect(app.errors).toEqual([]);
  });

  it('transcribes one uploaded file and saves it to history', async () => {
    const [file] = makeWavFiles(['single-e2e.wav']);
    await (await fileInput(false)).uploadFile(file);
    await waitFor(async () => (await bodyText(app.page)).includes('single-e2e.wav'), 10000, 'file info');
    // The start button under the file info ("শুরু করুন" plus more words)
    await app.page.evaluate(() => {
      const start = [...document.querySelectorAll('button')].find(b => b.offsetParent && /শুরু করুন$/.test(b.innerText.trim()) && b.innerText.trim().length > 10);
      start?.click();
    });
    await waitFor(async () => (await historyCount(app.page)) === 1, 30000, 'saved transcript');
    await waitFor(async () => (await bodyText(app.page)).includes('পরীক্ষার লেখা নম্বর 1'), 10000, 'transcript on screen');
    expect(app.geminiCalls()).toBe(1);
    expect(app.errors).toEqual([]);
  });

  it('runs a batch of three files and finds them by transcript text', async () => {
    const files = makeWavFiles(['batch-a.wav', 'batch-b.wav', 'batch-c.wav']);
    await (await fileInput(true)).uploadFile(...files);
    await sleep(1500);
    // Confirm the batch in the toast, then start the queue in the sidebar
    expect(await clickButton(app.page, 'শুরু করুন')).toBe(true);
    await sleep(1000);
    expect(await clickButton(app.page, 'শুরু করুন', true)).toBe(true);
    await waitFor(async () => (await historyCount(app.page)) === 3, 120000, 'three transcripts');
    expect(app.geminiCalls()).toBe(3);

    // History search looks inside the saved transcripts
    await app.page.evaluate(() => {
      const search = [...document.querySelectorAll('button')].find(b => b.offsetParent && b.getBoundingClientRect().left < 400 && /সার্চ/.test(b.title.normalize('NFC')));
      search?.click();
    });
    const box = await app.page.waitForSelector('input[type=text], input[type=search]', { visible: true });
    await box!.type('ঠিক আছে 2');
    await waitFor(async () => (await bodyText(app.page)).includes('batch-'), 10000, 'search result');
    expect(app.errors).toEqual([]);
  });
});
