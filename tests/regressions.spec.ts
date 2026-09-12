import { test, expect } from '@playwright/test';
import { ready } from './helpers';

test('mount and navigation preserve unreadable storage until a real edit', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('encube.threads.v1', '{not json'));
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('encube.threads.v1'))).toBe('{not json');
  await page.getByLabel('Add a reply', { exact: true }).fill('An intentional edit');
  await page.getByRole('button', { name: 'Reply', exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('encube.threads.v1'))).toContain('An intentional edit');
});

test('storage failure stays visible until a later edit saves the whole session', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Object.assign(window, { restoreStorage: () => { Storage.prototype.setItem = original; } });
    Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); };
  });
  await page.goto('/');
  await ready(page);
  await page.locator('canvas').click({ position: { x: 100, y: 150 } });
  await page.getByLabel('Your comment', { exact: true }).fill('Keep this session note');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('lost on reload');
  await page.getByRole('button', { name: 'Close conversation', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
  await page.locator('.thread-summary').filter({ hasText: 'Keep this session note' }).click();
  await page.getByLabel('Add a reply', { exact: true }).fill('Storage is working again');
  await page.getByRole('button', { name: 'Reply', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await ready(page);
  await expect(page.locator('.thread-summary').filter({ hasText: 'Keep this session note' })).toBeVisible();
});

test('wheel continuation events still pan when they cannot be canceled', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const pin = page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true });
  const before = (await pin.boundingBox())!.x;
  await page.locator('.interaction-layer').evaluate((surface) => {
    surface.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 30 }));
    surface.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: false, deltaX: 30 }));
  });
  await expect.poll(async () => (await pin.boundingBox())!.x).toBeLessThan(before - 55);
});

for (const key of ['ArrowRight', '-']) {
  test(`keyboard ${key} releases a preceding pinch target`, async ({ page }) => {
    await page.goto('/');
    await ready(page);
    // Hold the idle timer so this tests explicit cancellation, independent of machine load.
    await page.clock.install({ time: new Date('2026-09-12T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-12T12:01:00Z'));
    const surface = page.locator('.interaction-layer');
    const pin = page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true });
    const canvas = (await surface.boundingBox())!;
    const initial = (await pin.boundingBox())!;
    const cursor = { x: initial.x + 5, y: initial.y + 31 };
    await surface.evaluate((element, cursor) => element.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -5, clientX: cursor.x, clientY: cursor.y })), cursor);
    await page.clock.runFor(16);
    // Three presses, then most of the zoom ease. One 10% step moves the pin too little to tell
    // displacement from noise, and the clock has to stay inside the 150 ms idle window: past it the
    // gesture target would lapse on its own and the test would no longer prove the keyboard cleared it.
    for (let press = 0; press < 3; press++) {
      await surface.evaluate((element, key) => element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key })), key);
      await page.clock.runFor(8);
    }
    await page.clock.runFor(110);
    const afterKey = (await pin.boundingBox())!;
    await surface.evaluate((element, cursor) => element.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -5, clientX: cursor.x, clientY: cursor.y })), cursor);
    await page.clock.runFor(16);
    const afterPinch = (await pin.boundingBox())!;
    // A fresh pinch must retain the keyboard displacement, not snap back to the old world target.
    expect(Math.abs(afterKey.x - initial.x)).toBeGreaterThan(20);
    expect(Math.abs(afterPinch.x - afterKey.x)).toBeLessThan(10);
    expect(afterPinch.x).toBeGreaterThan(canvas.x);
  });
}
