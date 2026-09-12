import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';

export async function expectCanvasPixelRatio(canvas: Locator, ratio: number) {
  await expect.poll(() => canvas.evaluate((element) => element.width / element.clientWidth)).toBe(ratio);
}

// Wait for real WebGL readiness; concurrent browser startup can take longer than an ordinary UI update.
export async function ready(page: Page) {
  await expect(page.locator('.interaction-layer')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
}

/** One wheel event as the browser reported it, with `t` in milliseconds from the first of the burst. */
export type WheelSample = { t: number; x: number; y: number; mode: number; ctrl: boolean };
export type WheelTrace = { name: string; recorded: string; platform: string; userAgent: string; events: WheelSample[] };

const fixtures = join(import.meta.dirname, 'fixtures');

// Recorded on a real trackpad by tools/record-gesture.html. Nothing synthetic reproduces the momentum
// tail macOS sends after the fingers lift, so the tests replay a real stream rather than approximate one.
export function loadTraces(prefix: string): WheelTrace[] {
  let names: string[];
  try { names = readdirSync(fixtures); } catch { return []; }
  return names
    .filter((file) => file.startsWith(prefix) && file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(join(fixtures, file), 'utf8')) as WheelTrace);
}

/**
 * Replay a trace onto `selector` at a point inside it, keeping the original inter-event timing.
 * Scheduling happens inside the page: driving it from Node would add round-trip jitter to a stream
 * whose spacing is the thing under test. Dispatched events are untrusted, which costs nothing here
 * because no handler gates on `isTrusted`.
 */
export async function replayWheel(page: Page, selector: string, trace: WheelTrace, at: { x: number; y: number }) {
  await page.evaluate(async ({ selector, events, at }) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`No element matches ${selector}`);
    const box = element.getBoundingClientRect();
    const start = performance.now();
    for (const sample of events) {
      const wait = start + sample.t - performance.now();
      if (wait > 1) await new Promise((resolve) => setTimeout(resolve, wait));
      element.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true,
        deltaX: sample.x, deltaY: sample.y, deltaMode: sample.mode, ctrlKey: sample.ctrl,
        clientX: box.left + at.x, clientY: box.top + at.y,
      }));
    }
  }, { selector, events: trace.events, at });
}

/** Wait until the zoom readout stops moving. Zoom eases into place, and at the clamp it stops
 *  changing altogether, so "wait until it differs" is the wrong wait: stability is the signal.
 *  One eased run lasts 220 ms, so the first wait clears any run already in flight; the poll then
 *  catches the case where a throttled frame made two reads match while the camera was still going. */
export async function zoomSettled(page: Page) {
  const read = () => page.getByLabel('Zoom level').first().textContent();
  await page.waitForTimeout(350);
  await expect.poll(async () => {
    const first = await read();
    await page.waitForTimeout(120);
    return (await read()) === first;
  }).toBe(true);
}
