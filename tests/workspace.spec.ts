import { test, expect, type Page } from '@playwright/test';

import { expectCanvasPixelRatio, ready, zoomSettled } from './helpers';

test('3D workspace exposes navigation and keeps zoom inside the canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Form study' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
  const zoom = page.getByLabel('Zoom level');
  await expect(zoom).toHaveText('100%');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(zoom).not.toHaveText('100%');
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(zoom).toHaveText('100%');
  await expect(page.locator('canvas')).toBeVisible();
});

test('a first canvas click comments while a drag still pans', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('canvas');
  await ready(page);
  // The requirement is a plain canvas click, so it must work before any tool is chosen.
  await canvas.click({ position: { x: 240, y: 320 } });
  await expect(page.getByLabel('Your comment', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  // A drag outgrowing the slop radius pans instead of leaving the canvas inert.
  const pin = page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true });
  const before = (await pin.boundingBox())!;
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + 500, bounds.y + 400);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 380, bounds.y + 400, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByLabel('Your comment', { exact: true })).toHaveCount(0);
  await expect.poll(async () => (await pin.boundingBox())!.x).toBeLessThan(before.x - 50);
});

test('wheel pan and pinch keep surface pins anchored and never zoom the page', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const pin = page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true });
  await expect(pin).toBeVisible();
  const before = (await pin.boundingBox())!;
  await page.mouse.move(before.x + 10, before.y + 10);
  await page.mouse.wheel(60, 40);
  await expect.poll(async () => (await pin.boundingBox())!.x).toBeLessThan(before.x - 50);
  await expect(page.getByLabel('Zoom level')).toHaveText('100%');
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect.poll(async () => (await pin.boundingBox())!.x).toBeCloseTo(before.x, 0);
  const interaction = page.locator('.interaction-layer');
  const bounds = (await interaction.boundingBox())!;
  const canceled = await interaction.evaluate((element, point) => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -24, clientX: point.x, clientY: point.y });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  }, { x: before.x + 5, y: before.y + 31 });
  expect(canceled).toBe(true);
  await expect(page.getByLabel('Zoom level')).not.toHaveText('100%');
  await expect.poll(async () => (await pin.boundingBox())!.x).toBeCloseTo(before.x, 0);
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
  expect((await interaction.boundingBox())!.width).toBe(bounds.width);
});

test('dragging cannot create a comment and Escape protects dirty text', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Comment tool', exact: true }).click();
  const bounds = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(bounds.x + 80, bounds.y + 140);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 140, bounds.y + 180, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByLabel('Your comment', { exact: true })).toHaveCount(0);
  await page.locator('canvas').click({ position: { x: 80, y: 140 } });
  const input = page.getByLabel('Your comment', { exact: true });
  await input.fill('Keep this draft');
  await page.keyboard.press('Escape');
  const discard = page.getByRole('dialog', { name: 'Discard your changes?' });
  await expect(discard.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(discard.getByRole('button', { name: 'Discard changes' })).toBeFocused();
  await page.getByRole('button', { name: 'Comment tool', exact: true }).evaluate((button) => button.focus());
  await expect(discard.getByRole('button', { name: 'Discard changes' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(discard).toHaveCount(0);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Keep this draft');
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  await expect(input).toHaveValue('Keep this draft');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(input).toHaveValue('Keep this draft');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(input).toHaveCount(0);
  // Focus returns to whatever opened the editor, which for a canvas click is the canvas itself.
  await expect(page.getByRole('application', { name: /Interactive 3D canvas/ })).toBeFocused();
});

test('Retina rendering and narrow layout retain usable controls', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true })).toBeVisible();
  await expectCanvasPixelRatio(page.locator('canvas'), 2);
  await page.screenshot({ path: `.local/planning/stage-2-${testInfo.project.name}-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Reset view', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `.local/planning/stage-2-${testInfo.project.name}-narrow.png`, fullPage: true });
  expect(errors).toEqual([]);
  await context.close();
});

test('a phone workspace fits its visible viewport without document scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/');
  await ready(page);

  expect(await page.evaluate(() => ({ viewport: innerHeight, document: document.documentElement.scrollHeight })))
    .toEqual({ viewport: 664, document: 664 });
  await expect(page.locator('#comments-panel')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Objects in conversation.' })).toBeHidden();
});

test('a physical two-finger gesture zooms the canvas and inspector', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'CDP supplies genuine multi-touch input');
  const context = await browser.newContext({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('/');
  await ready(page);
  const box = (await page.locator('.interaction-layer').boundingBox())!;
  const session = await context.newCDPSession(page);

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + 165, y: box.y + 100 }, { x: box.x + 225, y: box.y + 100 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: box.x + 125, y: box.y + 100 }, { x: box.x + 265, y: box.y + 100 }],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expect(page.getByLabel('Zoom level')).not.toHaveText('100%');
  await expect(page.getByLabel('Your comment', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect Ring study', exact: true }).click();
  const stage = (await page.locator('.study-stage').boundingBox())!;
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: stage.x + 240, y: stage.y + 50 }, { x: stage.x + 300, y: stage.y + 50 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: stage.x + 220, y: stage.y + 50 }, { x: stage.x + 340, y: stage.y + 50 }],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.study-viewer').getByLabel('Zoom level')).not.toHaveText('100%');
  await context.close();
});

test('mobile controls balance compact canvas navigation with finger-sized primary actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/');
  await ready(page);

  // Firefox/WebKit expose a 44px CSS box as 43.99997 through boundingBox, so allow only that
  // floating-point residue; a genuinely undersized 43px target still fails.
  const navigation = page.getByRole('group', { name: 'Canvas navigation' }).first();
  const navigationBox = (await navigation.boundingBox())!;
  expect(navigationBox.width).toBeLessThanOrEqual(210);
  expect(navigationBox.height).toBeLessThanOrEqual(42);
  for (const name of ['Zoom out', 'Zoom in', 'Reset view']) {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(box.width, `${name} width`).toBeGreaterThanOrEqual(35.99);
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(35.99);
  }

  const comments = (await page.getByRole('button', { name: 'Comments', exact: true }).boundingBox())!;
  expect(comments.width).toBeGreaterThanOrEqual(43.99);
  expect(comments.height).toBeGreaterThanOrEqual(43.99);

  for (const name of ['All', 'Resolved']) {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(43.99);
  }
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  for (const name of ['Close conversation', 'Delete', 'Resolve']) {
    const box = (await page.getByRole('button', { name, exact: true }).first().boundingBox())!;
    expect(box.width, `${name} width`).toBeGreaterThanOrEqual(43.99);
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(43.99);
  }
});

test('tablet portrait stacks comments instead of squeezing the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await ready(page);
  const canvasColumn = (await page.locator('main > div').first().boundingBox())!;
  const panel = (await page.locator('#comments-panel').boundingBox())!;

  expect(canvasColumn.width).toBe(768);
  expect(panel.x).toBe(0);
  expect(panel.y).toBeGreaterThanOrEqual(canvasColumn.y + canvasColumn.height - 1);
});

test('short phone landscape keeps canvas and comments side by side', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await ready(page);
  const canvasColumn = (await page.locator('main > div').first().boundingBox())!;
  const panel = (await page.locator('#comments-panel').boundingBox())!;

  expect(panel.x).toBeGreaterThan(0);
  expect(panel.y).toBe(canvasColumn.y);
  expect(canvasColumn.height).toBeGreaterThanOrEqual(300);
});

test('main and inspector canvases cap a 3x display at 2x rendering', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await page.goto('/');
  await ready(page);
  await expectCanvasPixelRatio(page.locator('.interaction-layer canvas'), 2);

  await page.getByRole('button', { name: 'Inspect Ring study', exact: true }).click();
  await expect(page.locator('.study-viewer canvas')).toBeVisible();
  await expectCanvasPixelRatio(page.locator('.study-viewer canvas'), 2);
  await context.close();
});

test('comment placement stays aligned in CSS pixels on a 2x display', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto('/');
  await ready(page);
  const surface = page.locator('.interaction-layer');
  const surfaceBox = (await surface.boundingBox())!;
  const click = { x: 520, y: 520 };
  await surface.click({ position: click });

  const pin = (await page.getByLabel('New comment location').boundingBox())!;
  // A 2x display can expose a half-CSS-pixel layout edge. That is one physical pixel, so include
  // the boundary instead of relying on toBeCloseTo(0), whose strict comparison rejects exactly .5.
  expect(Math.abs(pin.x + 5 - (surfaceBox.x + click.x))).toBeLessThanOrEqual(0.5);
  expect(Math.abs(pin.y + 31 - (surfaceBox.y + click.y))).toBeLessThanOrEqual(0.5);

  await page.getByRole('button', { name: 'Close conversation', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect Ring study', exact: true }).click();
  const stage = page.locator('.study-stage');
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'));
  const stageBox = (await stage.boundingBox())!;
  // The ring's centre is a hole; this point is on its upper surface.
  const inspectorClick = { x: stageBox.width / 2, y: stageBox.height * 0.3 };
  await stage.click({ position: inspectorClick });
  const inspectorPin = (await stage.getByLabel('New comment location').boundingBox())!;
  expect(Math.abs(inspectorPin.x + 5 - (stageBox.x + inspectorClick.x))).toBeLessThanOrEqual(0.5);
  expect(Math.abs(inspectorPin.y + 31 - (stageBox.y + inspectorClick.y))).toBeLessThanOrEqual(0.5);
  await context.close();
});

test('missing WebGL leaves a clear fallback and usable conversations', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (kind === 'webgl2' || kind === 'webgl') return null;
      return original.call(this, kind, ...args);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '3D rendering is unavailable' })).toBeVisible();
  await page.locator('.thread-summary').first().click();
  await expect(page.getByLabel('Add a reply', { exact: true })).toBeVisible();
});

test('zoom-out limits keep anchors visible on a tall viewport', async ({ page }) => {
  await page.setViewportSize({ width: 701, height: 2000 });
  await page.goto('/');
  const pin = page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true });
  await expect(pin).toBeVisible();
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await zoomSettled(page);
  await expect(pin).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(pin).toBeVisible();
});

test('resolving preserves an unfinished reply while editor replacement stays guarded', async ({ page }) => {
  await page.goto('/');
  await page.locator('.thread-summary').first().click();
  const reply = page.getByLabel('Add a reply', { exact: true });
  await reply.fill('Keep this while resolving');
  await expect(page.getByRole('button', { name: 'Edit comment by Maya', exact: true })).toBeDisabled();
  await expect(page.locator('.thread-summary').nth(1)).toBeDisabled();
  const resolve = page.getByRole('button', { name: 'Resolve', exact: true });
  await expect(resolve).toBeEnabled();
  await resolve.click();
  await expect(reply).toHaveValue('Keep this while resolving');
  await page.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect(reply).toHaveValue('Keep this while resolving');
});


test('resize preserves zoom until an explicit reset establishes new framing', async ({ page }) => {
  await page.goto('/');
  const zoom = page.getByLabel('Zoom level');
  await expect(zoom).toHaveText('100%');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(zoom).toHaveText('110%');
  await page.setViewportSize({ width: 800, height: 1000 });
  // Tablet portrait now stacks the panel, so the canvas receives the full viewport width.
  await expect(page.locator('canvas')).toHaveJSProperty('width', 800);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(zoom).toHaveText('110%');
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(zoom).toHaveText('100%');
});

test('zooming out after a tall-to-wide resize never jumps inward', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Zoom level')).toHaveText('100%');
  await page.setViewportSize({ width: 701, height: 2000 });
  await expect(page.locator('canvas')).toHaveJSProperty('width', 701);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (let i = 0; i < 15; i++) await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  // Zoom eases now, so let the run land before reading it.
  await zoomSettled(page);
  const percent = async () => Number((await page.getByLabel('Zoom level').textContent())!.replace('%', ''));
  const before = await percent();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('canvas')).toHaveJSProperty('width', 1090);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await zoomSettled(page);
  // The invariant is the direction, not the number: asking to zoom out must never zoom in. Where the
  // clamp lands depends on the viewport, so pinning an exact percentage tested the clamp, not this.
  expect(await percent()).toBeLessThanOrEqual(before);
});

test('C and V switch tools without hijacking typing', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const comment = page.getByRole('button', { name: 'Comment tool', exact: true });
  const pan = page.getByRole('button', { name: 'Pan tool', exact: true });
  await page.keyboard.press('v');
  await expect(pan).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('c');
  await expect(comment).toHaveAttribute('aria-pressed', 'true');
  // A shortcut key typed into a composer must reach the textarea, not the toolbar.
  await page.locator('canvas').click({ position: { x: 240, y: 320 } });
  const input = page.getByLabel('Your comment', { exact: true });
  await input.fill('vc');
  await expect(input).toHaveValue('vc');
  await expect(comment).toHaveAttribute('aria-pressed', 'true');
});

test('threads persist across reload and a cleared board stays cleared', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.locator('canvas').click({ position: { x: 240, y: 320 } });
  await page.getByLabel('Your comment', { exact: true }).fill('Persisted note');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.locator('.thread-summary').filter({ hasText: 'Persisted note' })).toBeVisible();
  await page.reload();
  await ready(page);
  await expect(page.locator('.thread-summary').filter({ hasText: 'Persisted note' })).toBeVisible();
  // An empty saved board must not be re-seeded on the next load.
  await page.evaluate(() => localStorage.setItem('encube.threads.v1', '[]'));
  await page.reload();
  await ready(page);
  await expect(page.locator('.thread-summary')).toHaveCount(0);
  // Unreadable storage falls back to seeds rather than crashing.
  await page.evaluate(() => localStorage.setItem('encube.threads.v1', '{not json'));
  await page.reload();
  await ready(page);
  await expect(page.locator('.thread-summary')).toHaveCount(3);
});

test('the drag surface covers the whole canvas area, including under the heading', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  // A heading in normal flow would shrink the gesture surface and leave a dead strip on top.
  const gap = await page.evaluate(() => {
    const viewport = document.querySelector('.canvas-viewport')!.getBoundingClientRect();
    const layer = document.querySelector('.interaction-layer')!.getBoundingClientRect();
    return { top: Math.round(layer.top - viewport.top), bottom: Math.round(viewport.bottom - layer.bottom) };
  });
  expect(gap).toEqual({ top: 0, bottom: 0 });
  // Dragging from inside the heading must pan rather than do nothing.
  const pin = page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true });
  const before = (await pin.boundingBox())!;
  const heading = (await page.locator('.canvas-heading').boundingBox())!;
  await page.mouse.move(heading.x + heading.width - 40, heading.y + heading.height / 2);
  await page.mouse.down();
  await page.mouse.move(heading.x + heading.width - 160, heading.y + heading.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await pin.boundingBox())!.x).toBeLessThan(before.x - 50);
});

test('a pin anchored at an edge sits against it instead of being clipped', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const layer = (await page.locator('.interaction-layer').boundingBox())!;
  // Anchor hard against the top-left corner, where the bubble would otherwise overhang the frame.
  await page.locator('canvas').click({ position: { x: 3, y: 4 } });
  await page.getByLabel('Your comment', { exact: true }).fill('Edge pin');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  const pin = page.getByRole('button', { name: /Open comment \d+ by Dalton/ });
  const box = (await pin.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(layer.x - 0.5);
  expect(box.y).toBeGreaterThanOrEqual(layer.y - 0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(layer.x + layer.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(layer.y + layer.height + 0.5);
});

// Check committed positions at fixed animation times, so React scheduling cannot hide intermediate motion.
async function samplePinDuringReveal(page: Page, reducedMotion = false) {
  const pin = page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true });
  await page.mouse.move(400, 400);
  await page.mouse.wheel(-900, 0);
  await expect(pin).toHaveCount(0);
  await page.clock.install({ time: new Date('2026-09-12T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-12T12:01:00Z'));
  await page.locator('.thread-summary').first().click();
  await page.clock.runFor(100);
  await expect(pin).toBeVisible();
  const first = (await pin.boundingBox())!.x;
  await page.clock.runFor(100);
  if (!reducedMotion) await expect.poll(async () => (await pin.boundingBox())!.x).toBeLessThan(first - 1);
  const second = (await pin.boundingBox())!.x;
  await page.clock.runFor(300);
  const canvas = (await page.locator('.interaction-layer').boundingBox())!;
  await expect.poll(async () => (await pin.boundingBox())!.x).toBeCloseTo(canvas.x + canvas.width / 2 - 5, 0);
  const last = (await pin.boundingBox())!.x;
  return new Set([first, second, last].map(Math.round)).size;
}

test('navigating to an offscreen comment glides instead of teleporting', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  // More than a start and an end position means intermediate frames were actually rendered.
  expect(await samplePinDuringReveal(page)).toBeGreaterThan(2);
  await expect(page.locator('.comment-pin').first()).toBeVisible();
});

test('reduced motion jumps straight to the comment', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await ready(page);
  expect(await samplePinDuringReveal(page, true)).toBeLessThanOrEqual(2);
  await expect(page.locator('.comment-pin').first()).toBeVisible();
});

test('opening a thread from a pin animates the conversation in and brings it into view', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const scroll = page.locator('.comments-scroll');
  // Push the panel down so the conversation would otherwise open out of sight.
  await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const animations = await page.evaluate(async () => {
    const seen: string[] = [];
    document.addEventListener('animationstart', (event) => seen.push((event as AnimationEvent).animationName), true);
    (document.querySelector('[aria-label="Open comment 2 by Leo"]') as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 600));
    return seen;
  });
  expect(animations).toContain('conversation-enter');
  await expect.poll(async () => scroll.evaluate((element) => Math.round(element.scrollTop))).toBe(0);
  await expect(page.locator('.active-conversation')).toBeInViewport();
});

test('the command modifier with Enter posts without leaving the textarea', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.locator('canvas').click({ position: { x: 240, y: 320 } });
  const input = page.getByLabel('Your comment', { exact: true });
  // Plain Enter belongs to the textarea, so a newline must not submit the draft.
  await input.fill('First line');
  await input.press('Enter');
  await input.type('second line');
  await expect(input).toHaveValue('First line\nsecond line');
  const accelerator = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
  await input.press(accelerator);
  await expect(page.locator('.message-text').filter({ hasText: 'second line' })).toBeVisible();
  // The shortcut badge must not leak into the button's accessible name.
  await expect(page.getByRole('button', { name: 'Reply', exact: true })).toBeVisible();
  const reply = page.getByLabel('Add a reply', { exact: true });
  await reply.fill('Sent by keyboard');
  await reply.press(accelerator);
  await expect(page.locator('.message-text').filter({ hasText: 'Sent by keyboard' })).toBeVisible();
});

test('tool shortcuts survive an open conversation', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const pan = page.getByRole('button', { name: 'Pan tool' });
  // Opening a thread to read it must not hand the keyboard to the reply box.
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  await expect(page.getByLabel('Add a reply', { exact: true })).not.toBeFocused();
  await page.keyboard.press('v');
  await expect(pan).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('c');
  await expect(pan).toHaveAttribute('aria-pressed', 'false');
  // Once the author is genuinely typing, the same keys must reach the textarea instead.
  const reply = page.getByLabel('Add a reply', { exact: true });
  await reply.click();
  await reply.type('vc');
  await expect(reply).toHaveValue('vc');
  await expect(pan).toHaveAttribute('aria-pressed', 'false');
});

test('the canvas is operable and announced without a pointer', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const pin = page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true });
  const before = (await pin.boundingBox())!;
  const canvas = page.getByRole('application', { name: /Interactive 3D canvas/ });
  await canvas.focus();
  await expect(canvas).toBeFocused();
  // Arrow keys must move the camera, not scroll the page.
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await pin.boundingBox())!.x).toBeLessThan(before.x - 20);
  const zoom = page.getByLabel('Zoom level');
  await expect(zoom).toHaveText('100%');
  await page.keyboard.press('-');
  await expect(zoom).not.toHaveText('100%');
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(zoom).toHaveText('100%');
});

test('comment actions are announced to assistive technology', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const live = page.locator('[aria-live="polite"]');
  await page.locator('canvas').click({ position: { x: 240, y: 320 } });
  await page.getByLabel('Your comment', { exact: true }).fill('Announced note');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(live).toHaveText('Comment posted.');
  await page.getByLabel('Add a reply', { exact: true }).fill('And a reply');
  await page.getByRole('button', { name: 'Reply', exact: true }).click();
  await expect(live).toHaveText('Reply added.');
  await page.getByRole('button', { name: 'Resolve', exact: true }).click();
  await expect(live).toHaveText('Conversation resolved.');
  await page.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect(live).toHaveText('Conversation reopened.');
});

test('the focus ring follows the tool a shortcut selects', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const pan = page.getByRole('button', { name: 'Pan tool' });
  const comment = page.getByRole('button', { name: 'Comment tool' });
  // Focus explicitly: Safari does not focus a button on click, so clicking would not set the premise.
  await pan.focus();
  await page.keyboard.press('c');
  // A ring left on Pan while Comment is active reads as the wrong tool being selected.
  await expect(comment).toHaveAttribute('aria-pressed', 'true');
  await expect(comment).toBeFocused();
  await page.keyboard.press('v');
  await expect(pan).toBeFocused();
  // From the canvas the shortcut must change the tool without stealing focus back to the toolbar.
  const canvas = page.getByRole('application', { name: /Interactive 3D canvas/ });
  await canvas.focus();
  await page.keyboard.press('c');
  await expect(comment).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).toBeFocused();
});

test('the comments panel collapses and reveals itself when a comment needs it', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const toggle = page.getByRole('button', { name: 'Comments', exact: true });
  const panel = page.locator('#comments-panel');
  const canvas = page.locator('canvas');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const wide = (await canvas.boundingBox())!.width;
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  // `inert` is the part that matters: clipping alone would leave the panel focusable and announced.
  await expect.poll(() => panel.evaluate((el) => el.closest('[inert]') !== null)).toBe(true);
  await expect.poll(async () => (await canvas.boundingBox())!.width).toBeGreaterThan(wide + 200);
  // Placing a comment behind a collapsed panel would look like a click that did nothing.
  await canvas.click({ position: { x: 240, y: 320 } });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Your comment', { exact: true })).toBeFocused();
});

test('a resolved conversation refuses replies until it is reopened', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  const reply = page.getByLabel('Add a reply', { exact: true });
  await expect(reply).toBeVisible();
  await page.getByRole('button', { name: 'Resolve', exact: true }).click();
  await expect(reply).toHaveCount(0);
  await expect(page.getByText('This conversation is resolved. Reopen it to reply.')).toBeVisible();
  await page.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect(reply).toBeVisible();
  // Resolving mid-sentence must not destroy typed text, so the editor survives while it is dirty.
  await reply.fill('Still writing this');
  await page.getByRole('button', { name: 'Resolve', exact: true }).click();
  await expect(reply).toHaveValue('Still writing this');
});

test('Cancel in the reply box is only offered when there is text to discard', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  const reply = page.getByLabel('Add a reply', { exact: true });
  const cancel = page.locator('.thread-editor').getByRole('button', { name: 'Cancel', exact: true });
  // Cancelling a reply closes nothing, so with an empty box the control would do nothing at all.
  await expect(cancel).toBeDisabled();
  await reply.fill('Second thoughts');
  await expect(cancel).toBeEnabled();
  await cancel.click();
  await expect(reply).toHaveValue('');
  await expect(cancel).toBeDisabled();
});

test('fullscreen covers the canvas and the conversations together', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const button = page.getByRole('button', { name: 'Fullscreen', exact: true });
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await button.click();
  // The whole workspace goes fullscreen, not the canvas alone, so the panel comes with it.
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName ?? null)).toBe('HTML');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#comments-panel')).toBeVisible();
  // The browser can leave fullscreen without the button, so the button has to follow the document.
  await page.evaluate(() => document.exitFullscreen());
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('mobile browsers without the Fullscreen API offer an honest focus view', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { configurable: true, get: () => false });
  });
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/');
  await ready(page);
  const button = page.getByRole('button', { name: 'Focus view', exact: true });

  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#root > div')).toHaveAttribute('data-focus-view', 'true');
  await expect(page.locator('#root > div > header')).toBeHidden();
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
});

test('the Open filter counts outstanding conversations as they are resolved', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  // Scoped to the filter group: every canvas pin is also named "Open comment ...".
  const openFilter = page.locator('[aria-label="Filter conversations"]').getByRole('button', { name: /^Open/ });
  await expect(openFilter).toHaveText(/^Open\s*2$/);
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  await page.getByRole('button', { name: 'Resolve', exact: true }).click();
  await expect(openFilter).toHaveText(/^Open\s*1$/);
  await page.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect(openFilter).toHaveText(/^Open\s*2$/);
});

test('stacked elements share one gutter in each column', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  const leftEdge = (selector: string) => page.locator(selector).first().evaluate((el) => Math.round(el.getBoundingClientRect().left));
  // Four elements stacked down the canvas column; three different gutters used to read as a ragged edge.
  const canvas = await Promise.all([
    leftEdge('header [aria-label="Encube"]'),
    leftEdge('[aria-label="Canvas tools"]'),
    leftEdge('.canvas-heading h2'),
  ]);
  expect(new Set(canvas).size).toBe(1);
  // The active conversation carries a left accent, whose width its padding has to give back.
  const panel = await Promise.all([
    leftEdge('#comments-panel h2'),
    leftEdge('#comments-panel h3'),
    leftEdge('.active-conversation span'),
  ]);
  expect(new Set(panel).size).toBe(1);
});

test('the interface renders in Inter rather than a system fallback', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  // Declaring a font it never loads would leave the tuned letter-spacing landing on another face.
  const width = (family: string) => page.evaluate((name) => {
    const context = document.createElement('canvas').getContext('2d')!;
    context.font = `16px ${name}`;
    return context.measureText('Handgloves 0123456789').width;
  }, family);
  expect(await width('Inter Variable')).not.toBeCloseTo(await width('__NoSuchFont__'), 1);
});

test('zoom controls move in ten percent steps', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const zoom = page.getByLabel('Zoom level');
  // Zoom eases into each stop, so read it once it has settled rather than mid-glide.
  const settled = async (expected: string) => { await expect(zoom).toHaveText(expected); return expected; };
  const steps: string[] = [await settled('100%')];
  for (const expected of ['110%', '120%', '130%']) {
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    steps.push(await settled(expected));
  }
  for (const expected of ['120%', '110%', '100%', '90%', '80%']) {
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    steps.push(await settled(expected));
  }
  // A fixed multiplier drifted to 144% and 173%; every stop has to land on a round number.
  expect(steps).toEqual(['100%', '110%', '120%', '130%', '120%', '110%', '100%', '90%', '80%']);
});

test('each board opens an inspector that turns, comments, and leaves the panel readable', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expect(page.getByRole('button', { name: /^Inspect / })).toHaveCount(4);
  const badge = page.getByRole('button', { name: 'Inspect Ring study' });
  // Opened from the keyboard: Safari does not focus a button on click, so a click would leave the
  // focus-restoration check with no origin to return to.
  await badge.focus();
  await page.keyboard.press('Enter');
  const stage = page.locator('.study-stage');
  await expect(stage).toBeFocused();
  // The overlay covers the canvas only. Reading and replying carry on beside it.
  const panel = (await page.locator('#comments-panel').boundingBox())!;
  const box = (await stage.boundingBox())!;
  expect(Math.round(box.x + box.width)).toBe(Math.round(panel.x));
  await expect(page.locator('.thread-summary')).toHaveCount(3);
  // This form's own comment is here, and it travels with the surface when the form turns.
  const pin = stage.locator('.comment-pin');
  await expect(pin).toHaveCount(1);
  const before = (await pin.boundingBox())!.x;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // A modest turn: swing it far enough and the pin correctly disappears behind its own surface.
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs(((await pin.boundingBox())?.x ?? before) - before)).toBeGreaterThan(20);
  // Commenting works here too, into the same conversation list.
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
  const composer = page.getByLabel('Your comment', { exact: true });
  await expect(composer).toBeFocused();
  await composer.fill('This back edge needs a softer break.');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.locator('.thread-summary')).toHaveCount(4);
  await expect(stage).toHaveCount(1);
  // Escape closes the conversation first, then the inspector. Waiting between them matters: the
  // panel restores focus on the next frame, and two presses inside one frame race that restore.
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Add a reply', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(stage).toHaveCount(0);
  await expect(badge).toBeFocused();
});

test('turning the inspector works from the keyboard alone', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Inspect Ring study' }).click();
  const stage = page.locator('.study-stage');
  await expect(stage).toBeFocused();
  // Pixels are the only honest evidence the form turned; the rotation lives inside WebGL.
  const before = await stage.screenshot();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await stage.screenshot()).equals(before)).toBe(false);
});

test('the grid reads out its own scale and rescales with zoom', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const scale = page.locator('.scene-scale');
  const bar = () => scale.locator('span').last().evaluate((element) => Math.round(element.getBoundingClientRect().width));
  const started = await bar();
  await expect(scale).toContainText('units');
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  // Zooming out shrinks a world unit on screen, so the bar has to shrink or restep to stay honest.
  await expect.poll(bar).not.toBe(started);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect.poll(bar).toBe(started);
});

test('a released pan keeps moving briefly instead of stopping dead', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const pin = page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true });
  const bounds = (await page.locator('canvas').first().boundingBox())!;
  // Thrown rightwards so the pin stays on screen; flung the other way it leaves the frame entirely.
  await page.mouse.move(bounds.x + 300, bounds.y + 400);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) await page.mouse.move(bounds.x + 300 + step * 20, bounds.y + 400);
  await page.mouse.up();
  const atRelease = (await pin.boundingBox())!.x;
  await expect.poll(async () => (await pin.boundingBox())!.x).toBeGreaterThan(atRelease + 4);
});

test('inspect badges ride with their board and never block a comment', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const badge = page.getByRole('button', { name: 'Inspect Ring study' });
  const before = (await badge.boundingBox())!.x;
  const canvas = page.locator('canvas').first();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + 500, bounds.y + 400);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 380, bounds.y + 400, { steps: 8 });
  await page.mouse.up();
  // A drag still pans the whole view, exactly as it did before the inspector existed.
  await expect.poll(async () => (await badge.boundingBox())!.x).toBeLessThan(before - 50);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  // Clicking a badge opens the inspector rather than dropping a comment behind it.
  await badge.click();
  await expect(page.getByLabel('Your comment', { exact: true })).toHaveCount(0);
});

test('the inspector carries the same grid, scale and zoom controls as the canvas', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Inspect Ring study' }).click();
  const stage = page.locator('.study-stage');
  await expect(stage.locator('.scene-grid')).toHaveCount(1);
  await expect(stage.locator('.scene-scale')).toContainText('units');
  const level = stage.getByLabel('Zoom level');
  await expect(level).toHaveText('100%');
  // The same ten-percent stops the canvas uses, so zooming reads identically in both views.
  await stage.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect(level).toHaveText('90%');
  await stage.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(level).toHaveText('100%');
  await stage.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await stage.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(level).toHaveText('100%');
  // Fullscreen belongs here too: inspecting a form is exactly when the extra room is wanted.
  await expect(stage.getByRole('button', { name: 'Fullscreen' })).toHaveCount(1);
});

test('a comment on a hidden surface stays on the canvas, dimmed rather than gone', async ({ page }) => {
  // Seeded rather than clicked: staging an occlusion through the inspector depends on where a click
  // lands on a curved surface, and the rule under test is simply that a hidden anchor still draws.
  await page.addInitScript(() => {
    const message = { id: 'm-far', author: 'Maya', createdAt: '2026-09-11T10:00:00Z', text: 'Inside the ring.' };
    localStorage.setItem('encube.threads.v1', JSON.stringify([
      { id: 'far', anchor: [0, 0, 0], on: 'form-block', resolved: false, messages: [message] },
    ]));
  });
  await page.goto('/');
  await ready(page);
  // Anchored at the block's own origin, which is inside solid geometry and so always behind a
  // surface. The ring would not do: its origin is the hole. Hiding it outright is how a comment comes to look lost, so it dims instead.
  const pin = page.locator('.interaction-layer .comment-pin');
  await expect(pin).toHaveCount(1);
  await expect(pin).toHaveCSS('opacity', '0.4');
  await expect(pin).toHaveAttribute('title', /^On the far side: /);
  await expect(pin).toBeEnabled();
});

test('the inspector carries a part sheet that collapses out of the way', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Inspect Block study' }).click();
  const card = page.locator('.study-info');
  await expect(card.getByRole('heading', { name: 'Block study' })).toBeVisible();
  await expect(card).toContainText('FRM-002');
  await expect(card.locator('dt')).toHaveText(['Material', 'Mass', 'Dimensions', 'Finish']);
  const toggle = page.getByRole('button', { name: 'Part details', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  // Collapsed, the name stays readable: the sheet is reference material, not the label for the view.
  await expect(page.locator('#study-details')).toBeHidden();
  await expect(card.getByRole('heading', { name: 'Block study' })).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  // Each form carries its own sheet.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Inspect Facet study' }).click();
  await expect(page.locator('.study-info')).toContainText('FRM-003');
});

test('a collapsed mobile part sheet becomes one compact information control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Inspect Block study' }).click();
  const card = page.locator('.study-info');
  await page.getByRole('button', { name: 'Part details', exact: true }).click();
  const box = (await card.boundingBox())!;

  expect(box.width).toBeLessThanOrEqual(44);
  expect(box.height).toBeLessThanOrEqual(44);
  await expect(card.getByRole('heading', { name: 'Block study' })).toBeHidden();
});

test('every enabled control shows a pointer cursor', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  // Tailwind's reset gives buttons the default arrow, so the affordance is opt-in and easy to miss
  // on a hand-rolled class. Checking them all at once beats finding them one report at a time.
  const arrows = () => page.evaluate(() => [...document.querySelectorAll('button:not([disabled])')]
    .filter((element) => getComputedStyle(element).cursor !== 'pointer')
    .map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 30)));
  expect(await arrows()).toEqual([]);
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  expect(await arrows()).toEqual([]);
  await page.getByRole('button', { name: 'Inspect Ring study' }).click();
  await expect(page.locator('.study-stage')).toHaveCount(1);
  expect(await arrows()).toEqual([]);
});

test('fullscreen says how to leave it', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const hint = page.getByText('to leave fullscreen');
  await expect(hint).toHaveCount(0);
  await page.getByRole('button', { name: 'Fullscreen' }).click();
  // Fullscreen takes away the browser chrome, so the exit has to be stated in the page.
  await expect(hint).toBeVisible();
  await page.evaluate(() => document.exitFullscreen());
  await expect(hint).toHaveCount(0);
});

test('the canvas hints name what each key acts on', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const hints = page.locator('.canvas-hints');
  // Nothing is open, so Escape has nothing to close and is not offered.
  await expect(hints).not.toContainText('Esc');
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  await expect(hints).toContainText('Close the conversation with');
  await page.keyboard.press('Escape');
  await page.locator('canvas').first().click({ position: { x: 240, y: 320 } });
  await expect(page.getByLabel('Your comment', { exact: true })).toBeFocused();
  await expect(hints).toContainText('Discard the draft with');
});


test('shift with the arrows zooms the inspector', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Inspect Ring study' }).click();
  const stage = page.locator('.study-stage');
  const level = stage.getByLabel('Zoom level');
  await expect(level).toHaveText('100%');
  await page.keyboard.press('Shift+ArrowUp');
  await expect(level).toHaveText('110%');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(level).toHaveText('90%');
  // Without shift the same keys still turn rather than zoom.
  await page.keyboard.press('ArrowUp');
  await expect(level).toHaveText('90%');
});

test('R resets the view and F toggles fullscreen', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const zoom = page.getByLabel('Zoom level');
  const canvas = page.getByRole('application', { name: /Interactive 3D canvas/ });
  await canvas.focus();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(zoom).toHaveText('110%');
  await canvas.focus();
  await page.keyboard.press('r');
  await expect(zoom).toHaveText('100%');
  // Fullscreen is workspace-wide, so its key is not scoped to the canvas the way reset is.
  const hint = page.getByText('to leave fullscreen');
  await page.keyboard.press('f');
  await expect(hint).toBeVisible();
  await page.keyboard.press('f');
  await expect(hint).toHaveCount(0);
});

test('R resets the inspector, orientation included', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Inspect Ring study' }).click();
  const stage = page.locator('.study-stage');
  const level = stage.getByLabel('Zoom level');
  const pin = stage.locator('.comment-pin').first();
  const rest = Math.round((await pin.boundingBox())!.x);
  await page.keyboard.press('Shift+ArrowDown');
  await expect(level).toHaveText('90%');
  for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowRight');
  await expect.poll(async () => Math.round((await pin.boundingBox())!.x)).not.toBe(rest);
  await page.keyboard.press('r');
  await expect(level).toHaveText('100%');
  await expect.poll(async () => Math.round((await pin.boundingBox())!.x)).toBe(rest);
});
