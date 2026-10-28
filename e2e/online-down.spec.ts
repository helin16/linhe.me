// Online play fails cleanly when the relay can't be reached or the room doesn't exist (feature 003, US3).
import { expect, test } from '@playwright/test';
import { gameRoute } from '../src/shared/routes.ts';
import { GameSlug } from '../src/games/index.ts';
import { NetText } from '../src/games/turbo-tumble/net.ts';

const GAME = gameRoute(GameSlug.TurboTumble);

test('relay unreachable: a clear message within 5 s, and offline play still works', async ({ page }) => {
  await page.routeWebSocket(/\/relay\//, () => {}); // the connection opens but the relay never answers
  await page.goto(GAME);
  await page.getByRole('button', { name: 'Online', exact: true }).click();
  await page.getByRole('button', { name: 'Create room' }).click();
  await expect(page.locator('#netInfo')).toHaveText(NetText.Unavailable, { timeout: 6000 });
  await page.getByRole('button', { name: '1 Player' }).click();
  await page.getByRole('button', { name: 'Start race' }).click();
  await expect(page.locator('.lap').first()).toHaveText('Lap 1/3', { timeout: 5000 });
});

test('a join link to a room that does not exist says so', async ({ page }) => {
  await page.goto(`${GAME}?room=ZZZZ`);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.locator('#netInfo')).toHaveText(NetText.NoRoom, { timeout: 3000 });
  await expect(page.getByRole('button', { name: 'Create room' })).toBeVisible();
});
