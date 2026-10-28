// Every game loads with no console errors (constitution: end-to-end suite); on failure, says what broke.
import { expect, test } from '@playwright/test';
import { GAME } from './helpers.ts';

test('Turbo Tumble loads to its garage with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(GAME);
  try {
    await expect(page.getByRole('button', { name: 'Start race' })).toBeVisible({ timeout: 10_000 });
  } catch {
    throw new Error(`the garage never showed; page errors: ${errors.join(' | ') || 'none'}`);
  }
  expect(errors).toEqual([]);
});
