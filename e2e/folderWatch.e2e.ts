import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { openApp, historyCount, waitFor, makeWavFiles, type AppSession } from './browser';

let app: AppSession;

beforeEach(async () => { app = await openApp(); });
afterEach(async () => { await app.close(); });

// The real folder picker opens a system dialog; the browser's private file system stands in for the chosen folder
const fakePicker = () => {
  (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker = async () =>
    (await navigator.storage.getDirectory()).getDirectoryHandle('watched', { create: true });
};

const putInFolder = (name: string, base64: string) => app.page.evaluate(async (fileName, data) => {
  const folder = await (await navigator.storage.getDirectory()).getDirectoryHandle('watched', { create: true });
  const writable = await (await folder.getFileHandle(fileName, { create: true })).createWritable();
  await writable.write(Uint8Array.from(atob(data), c => c.charCodeAt(0)));
  await writable.close();
}, name, base64);

describe('watched folder', () => {
  it('transcribes audio put into the chosen folder by itself, and keeps the folder after a reload', async () => {
    await app.page.evaluateOnNewDocument(fakePicker);
    await app.page.reload({ waitUntil: 'networkidle0' });

    await app.page.click('button:has(svg.lucide-folder-sync)');
    await waitFor(async () => (await app.page.$('button:has(svg.lucide-x)')) !== null, 10000, 'watching status');

    const [wav] = makeWavFiles(['dropped.wav']);
    await putInFolder('dropped.wav', readFileSync(wav).toString('base64'));
    await waitFor(async () => (await historyCount(app.page)) === 1, 90000, 'transcript of the dropped file');
    expect(app.geminiCalls()).toBe(1);

    await app.page.reload({ waitUntil: 'networkidle0' });
    const status = await app.page.evaluate(() => document.body.innerText.includes('watched'));
    expect(status).toBe(true);
    expect(app.errors).toEqual([]);
  });
});
