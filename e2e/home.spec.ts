// Feature 005 US3: the site says Turbo Tumble can be played online.
import { expect, test } from '@playwright/test';
import { Route } from '../src/shared/routes.ts';

test('the home page card says the game plays online', async ({ page }) => {
  await page.goto(Route.Home);
  await expect(page.locator('.tag', { hasText: '1–2 players' })).toHaveText('1–2 players · Online up to 12 · iPad ready');
});

test('the games page says it too, in the tag and the description', async ({ page }) => {
  await page.goto(Route.Games);
  await expect(page.locator('.tag', { hasText: '1–2 players' })).toHaveText('Keyboard or touch · 1–2 players · online up to 12');
  await expect(page.getByText(/or up to 11 others online in a room\.$/)).toBeVisible();
});
