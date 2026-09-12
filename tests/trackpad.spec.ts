import { test, expect } from '@playwright/test';

import { loadTraces, ready, replayWheel } from './helpers';

// Replays real macOS trackpad recordings. Without fixtures these skip rather than pass quietly:
// a green suite that asserted nothing about trackpad feel is the failure mode worth avoiding.
// Record with `npm run dev`, then open http://127.0.0.1:5173/tools/record-gesture.html.
const panTraces = loadTraces('pan-');
const pinchTraces = loadTraces('pinch-');
const missing = 'No recording yet. See tools/record-gesture.html.';

// A per-trace loop generates nothing at all when the directory is empty, and a file that
// contributes no tests reads as a passing file. This one always reports, skipped or not.
test('trackpad recordings are available to replay', () => {
  test.skip(panTraces.length + pinchTraces.length === 0, missing);
  expect(panTraces.every((trace) => trace.events.length > 0)).toBe(true);
});

test.describe('a recorded two-finger pan', () => {
  for (const trace of panTraces) {
    test(`${trace.name} moves the scene without zooming it`, async ({ page }) => {
      await page.goto('/');
      await ready(page);
      const pin = page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true });
      await expect(pin).toBeVisible();
      const before = (await pin.boundingBox())!;
      // Expectation comes from the recording itself, so any pan trace works: the scene travels
      // opposite the fingers, and a pan must never change the zoom level.
      const travelX = trace.events.reduce((sum, sample) => sum + sample.x, 0);
      const travelY = trace.events.reduce((sum, sample) => sum + sample.y, 0);
      const axis = Math.abs(travelX) >= Math.abs(travelY) ? 'x' : 'y';
      const travel = axis === 'x' ? travelX : travelY;
      test.skip(Math.abs(travel) < 30, 'Recording is too short to assert a direction from.');

      await replayWheel(page, '.interaction-layer', trace, { x: 500, y: 400 });
      // Signed so one assertion covers either direction: the scene travels against the fingers.
      await expect.poll(async () => ((await pin.boundingBox())![axis] - before[axis]) * -Math.sign(travel))
        .toBeGreaterThan(8);
      await expect(page.getByLabel('Zoom level')).toHaveText('100%');
      // The gesture belongs to the canvas; the document must not scroll or scale underneath it.
      expect(await page.evaluate(() => window.scrollY + window.scrollX)).toBe(0);
      expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
    });
  }
});

test.describe('a recorded pinch', () => {
  for (const trace of pinchTraces) {
    test(`${trace.name} zooms and keeps the point under the cursor`, async ({ page }) => {
      await page.goto('/');
      await ready(page);
      const pin = page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true });
      await expect(pin).toBeVisible();
      const anchor = (await pin.boundingBox())!;
      const layer = (await page.locator('.interaction-layer').boundingBox())!;
      // macOS reports a trackpad pinch as ctrl-wheel; a recording without it is a pan, not a pinch.
      expect(trace.events.some((sample) => sample.ctrl)).toBe(true);

      // Pinch centred on the pin: a pointer-anchored dolly must leave that point where it was.
      await replayWheel(page, '.interaction-layer', trace, { x: anchor.x + 5 - layer.x, y: anchor.y + 31 - layer.y });
      await expect(page.getByLabel('Zoom level')).not.toHaveText('100%');
      await expect.poll(async () => Math.abs((await pin.boundingBox())!.x - anchor.x)).toBeLessThan(6);
      await expect.poll(async () => Math.abs((await pin.boundingBox())!.y - anchor.y)).toBeLessThan(6);
      expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
    });
  }
});
