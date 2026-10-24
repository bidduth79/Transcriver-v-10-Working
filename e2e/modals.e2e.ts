import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openApp, waitFor, sleep, type AppSession } from './browser';

let app: AppSession;

beforeEach(async () => { app = await openApp(); });
afterEach(async () => { await app.close(); });

const SETTINGS = '#settings-modal-container';
// The header's gear button (its title depends on the interface language)
const openSettings = async () => {
  await app.page.click('header button:has(path[d^="M10.325 4.317"])');
  await waitFor(async () => !!(await app.page.$(SETTINGS)), 5000, 'settings modal');
  await sleep(400); // open animation
};
const settingsGone = () => waitFor(async () => !(await app.page.$(SETTINGS)), 5000, 'settings closed');

describe('modals in a real browser', () => {
  it('closes with Esc, keeps Tab inside, stops page scroll and gives focus back', async () => {
    const { page } = app;
    await openSettings();
    const state = await page.evaluate((sel) => {
      const dialog = document.querySelector(sel)!;
      return { role: dialog.getAttribute('role'), focused: dialog.contains(document.activeElement), overflow: document.body.style.overflow };
    }, SETTINGS);
    expect(state).toEqual({ role: 'dialog', focused: true, overflow: 'hidden' });

    for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate((sel) => document.querySelector(sel)!.contains(document.activeElement), SETTINGS)).toBe(true);

    await page.keyboard.press('Escape');
    await settingsGone();
    const after = await page.evaluate(() => ({ overflow: document.body.style.overflow, gear: !!document.activeElement?.querySelector('path[d^="M10.325 4.317"]') }));
    expect(after).toEqual({ overflow: '', gear: true });
    expect(app.errors).toEqual([]);
  });

  it('closes on a backdrop click but not on a click inside', async () => {
    const { page } = app;
    await openSettings();
    const box = (await (await page.$(SETTINGS))!.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(300);
    expect(await page.$(SETTINGS)).not.toBeNull();
    await page.mouse.click(5, box.y + box.height / 2);
    await settingsGone();
  });
});
