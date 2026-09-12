import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

import { ready } from './helpers';

// The WebGL canvas cannot be introspected, so scan the HTML that carries the actual controls.
// Axe reads computed colour, and a mid-fade element reports blended values, so let motion finish first.
async function scan(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'));
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

test('the workspace has no automatically detectable accessibility violations', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const results = await scan(page);
  expect(results.violations.map((violation) => `${violation.id}: ${violation.description}`)).toEqual([]);
});

test('an open conversation and its editor stay accessible', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  await expect(page.getByLabel('Add a reply', { exact: true })).toBeVisible();
  const results = await scan(page);
  expect(results.violations.map((violation) => `${violation.id}: ${violation.description}`)).toEqual([]);
});

test('the discard dialog is reachable and labelled', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.locator('canvas').click({ position: { x: 240, y: 320 } });
  await page.getByLabel('Your comment', { exact: true }).fill('Unsaved');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toBeVisible();
  const results = await scan(page);
  expect(results.violations.map((violation) => `${violation.id}: ${violation.description}`)).toEqual([]);
});

test('the delete conversation dialog is reachable and labelled', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Delete this conversation?' }).getByRole('button', { name: 'Cancel' })).toBeFocused();
  const results = await scan(page);
  expect(results.violations.map((violation) => `${violation.id}: ${violation.description}`)).toEqual([]);
});
