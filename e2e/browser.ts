import puppeteer, { type Browser, type Page } from 'puppeteer';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { E2E_URL } from './globalSetup';

const DB_NAME = 'LiCellStudioDB_v5_Final';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface AppSession {
  browser: Browser;
  page: Page;
  errors: string[];
  geminiCalls: () => number;
  close: () => Promise<void>;
}

/**
 * Opens the app in a fresh headless browser profile. Nothing leaves the machine: Firebase and other
 * Google services are blocked, and every Gemini call gets a fake answer numbered by call.
 */
export const openApp = async (): Promise<AppSession> => {
  const browser = await puppeteer.launch({ headless: 'shell', userDataDir: mkdtempSync(join(tmpdir(), 'transcriver-e2e-')) });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
  const errors: string[] = [];
  let calls = 0;

  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (/generativelanguage\.googleapis\.com/.test(url)) {
      if (request.method() === 'OPTIONS') return void request.respond({ status: 200, headers: CORS, body: '' });
      calls += 1;
      const text = `[00:00] **Speaker 1:** পরীক্ষার লেখা নম্বর ${calls}।\n[00:05] **Speaker 2:** ঠিক আছে ${calls}।`;
      return void request.respond({
        status: 200, headers: CORS, contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }], usageMetadata: { totalTokenCount: 20 } }),
      });
    }
    if (/googleapis\.com|firebaseio|identitytoolkit|securetoken/.test(url)) return void request.abort();
    return void request.continue();
  });
  page.on('pageerror', err => errors.push(`pageerror: ${(err as Error).message}`));
  page.on('console', msg => {
    if (msg.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(msg.text())) errors.push(`console: ${msg.text().slice(0, 200)}`);
  });

  await page.goto(E2E_URL, { waitUntil: 'networkidle0', timeout: 60000 });
  await seedFakeKey(page);
  return { browser, page, errors, geminiCalls: () => calls, close: () => browser.close() };
};

// Stores a made-up Gemini key and makes it active, the same way Settings does
const seedFakeKey = async (page: Page) => {
  await page.evaluate((dbName) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(dbName);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(['user_api_keys'], 'readwrite');
      tx.objectStore('user_api_keys').put({ id: 'e2e', key: 'E2E-FAKE-KEY', label: 'E2E', addedAt: new Date().toISOString() });
      tx.oncomplete = () => { localStorage.setItem('manual_active_key_id', 'e2e'); open.result.close(); resolve(); };
    };
  }), DB_NAME);
  await page.reload({ waitUntil: 'networkidle0' });
};

export const historyCount = (page: Page) => page.evaluate((dbName) => new Promise<number>(resolve => {
  const open = indexedDB.open(dbName);
  open.onsuccess = () => {
    const count = open.result.transaction(['studio_history'], 'readonly').objectStore('studio_history').count();
    count.onsuccess = () => resolve(count.result);
  };
}), DB_NAME);

export const waitFor = async (check: () => Promise<boolean>, timeoutMs: number, what: string) => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await check()) return;
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${what}`);
};

// Clicks the visible button whose text is exactly `label`; `inSidebar` limits it to the left panel
export const clickButton = (page: Page, label: string, inSidebar = false) => page.evaluate((text, sidebar) => {
  const button = [...document.querySelectorAll('button')].find(b =>
    (b as HTMLElement).offsetParent && (b as HTMLElement).innerText.trim() === text && (!sidebar || b.getBoundingClientRect().left < 400));
  (button as HTMLElement | undefined)?.click();
  return !!button;
}, label, inSidebar);

export const bodyText = (page: Page) => page.evaluate(() => document.body.innerText);

// Small silent WAV files written to a temp folder, for the file inputs
export const makeWavFiles = (names: string[]) => {
  const dir = mkdtempSync(join(tmpdir(), 'transcriver-e2e-audio-'));
  const samples = 8000;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + samples * 2, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24); header.writeUInt32LE(16000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(samples * 2, 40);
  return names.map(name => {
    const path = join(dir, name);
    writeFileSync(path, Buffer.concat([header, Buffer.alloc(samples * 2)]));
    return path;
  });
};
