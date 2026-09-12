import { expect, test } from '@playwright/test';
import { ready } from './helpers';

test('comments survive navigation, support replies and edits, and filter by resolution', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Comment tool', exact: true }).click();
  const canvas = page.locator('canvas');
  await ready(page);
  await canvas.click({ position: { x: 100, y: 130 } });
  const input = page.getByLabel('Your comment', { exact: true });
  await expect(input).toBeFocused();
  await input.fill('   ');
  await expect(page.getByRole('button', { name: 'Post comment', exact: true })).toBeDisabled();
  await input.fill('Check the edge treatment.');
  await page.getByRole('button', { name: 'Resolved', exact: true }).click();
  await expect(input).toHaveValue('Check the edge treatment.');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await page.getByLabel('Add a reply', { exact: true }).fill('A softer radius would help.');
  await page.getByRole('button', { name: 'Reply', exact: true }).click();
  await page.getByRole('button', { name: 'Edit reply by Dalton', exact: true }).click();
  await page.getByLabel('Edit reply', { exact: true }).fill('A consistent radius would help.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.message-text').filter({ hasText: 'A consistent radius would help.' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit comment by Dalton', exact: true }).click();
  await page.getByLabel('Edit comment', { exact: true }).fill('Unsaved replacement');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.message-text').filter({ hasText: 'Check the edge treatment.' })).toBeVisible();
  await page.getByRole('button', { name: 'Resolve', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reopen', exact: true })).toBeVisible();
  await expect(page.locator('.thread-summary').filter({ hasText: 'Check the edge treatment.' })).toBeVisible();
  await page.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect(page.locator('.thread-summary').filter({ hasText: 'Check the edge treatment.' })).toHaveCount(0);
});

test('individual removal preserves the conversation structure', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  await page.getByRole('button', { name: 'Remove reply by Leo', exact: true }).click();
  const replyDialog = page.getByRole('dialog', { name: 'Delete this reply?' });
  await expect(replyDialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await replyDialog.getByRole('button', { name: 'Delete reply', exact: true }).click();
  await expect(page.locator('.thread-summary').first()).toContainText('0 replies');

  await page.getByRole('button', { name: 'Remove comment by Maya', exact: true }).click();
  await page.getByRole('dialog', { name: 'Delete this comment?' }).getByRole('button', { name: 'Delete comment', exact: true }).click();
  await expect(page.locator('.active-conversation')).toContainText('Empty conversation');
  await expect(page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true })).toBeVisible();
});

test('message actions are inline and the scrollbar gutter stays stable', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('aside[aria-label="Comments"]');
  const panelLeft = (await panel.boundingBox())!.x;
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  const edit = page.getByRole('button', { name: 'Edit comment by Maya', exact: true });
  const remove = page.getByRole('button', { name: 'Remove comment by Maya', exact: true });
  await expect(edit).toBeVisible();
  await expect(remove).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'));
  const editBox = (await edit.boundingBox())!;
  const removeBox = (await remove.boundingBox())!;
  expect(editBox.y + editBox.height / 2).toBeCloseTo(removeBox.y + removeBox.height / 2, 0);
  expect((await panel.boundingBox())!.x).toBe(panelLeft);
  await expect(page.locator('.comments-scroll')).toHaveCSS('scrollbar-gutter', /stable/);
});

test('conversation deletion removes its thread and pin after confirmation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete this conversation?' });
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete conversation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Comments', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Open comment 1 by Maya', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.thread-summary').filter({ hasText: 'The softer edge is working well.' })).toHaveCount(0);
});
