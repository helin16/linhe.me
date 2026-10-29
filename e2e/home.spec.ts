// Feature 005 US3: the site says Turbo Tumble can be played online.
import { expect, test } from '@playwright/test';
import { Route } from '../src/shared/routes.ts';

test('the home page card says the game plays online', async ({ page }) => {
  await page.goto(Route.Home);
  await expect(page.getByRole('link', { name: /Turbo Tumble/ }).locator('.tag')).toHaveText('1–2 players · Online up to 12 · iPad ready');
});

test('the games page says it too, in the tag and the description', async ({ page }) => {
  await page.goto(Route.Games);
  await expect(page.getByRole('link', { name: /Turbo Tumble/ }).locator('.tag')).toHaveText('Keyboard or touch · 1–2 players · online up to 12');
  await expect(page.getByText(/or up to 11 others online in a room\.$/)).toBeVisible();
});

test('Snake Duel is on the home page and the games page, and its card opens the game', async ({ page }) => {
  await page.goto(Route.Home);
  const card = page.getByRole('link', { name: /Snake Duel/ });
  await expect(card).toContainText('1–2 players · Online up to 8 · iPad ready');
  await card.click();
  await expect(page).toHaveURL(/\/games\/snake-duel\/$/);
  await expect(page.getByRole('heading', { name: 'Snake Duel' })).toBeVisible();
  await page.goto(Route.Games);
  await expect(page.getByText(/Customise your snake, play solo against computer snakes/)).toBeVisible();
});

test('Tank Clash is on the home page and the games page, and its card opens the game', async ({ page }) => {
  await page.goto(Route.Home);
  const card = page.getByRole('link', { name: /Tank Clash/ });
  await expect(card).toContainText('1–2 players · Online up to 10 · iPad ready');
  await card.click();
  await expect(page).toHaveURL(/\/games\/tank-clash\/$/);
  await expect(page.getByRole('heading', { name: 'Tank Clash' })).toBeVisible();
  await page.goto(Route.Games);
  await expect(page.getByText(/Blast the ground away under your rivals, grab air drops/)).toBeVisible();
});

test('the home page says Show Ground, with no name in the heading or welcome line', async ({ page }) => {
  await page.goto(Route.Home);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Show Ground');
  await expect(page.locator('.hero p')).toHaveText('Welcome! A few small games you can play right in your browser.');
});
