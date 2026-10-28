// Two browsers race online through the real relay (feature 003 US1; joining by link, feature 004 US3).
import { expect, test } from '@playwright/test';
import { count, GAME, garage, host, info, player, joined } from './helpers.ts';


test('host a room, join by link, race, leave, and hand over the host', async ({ browser }, testInfo) => {
  const a = await player(browser, testInfo);
  const code = await host(a.page);
  expect(code).toMatch(/^[A-Z2-9]{4}$/);
  await expect(info(a.page)).toContainText('Online as P1');
  await expect(a.page.getByRole('button', { name: 'Copy link' })).toBeVisible();

  // the friend opens the join link: straight into the room
  const b = await player(browser, testInfo, `${GAME}?room=${code.toLowerCase()}`);
  await joined(b.page, '2/4 players');
  await expect(info(b.page)).toContainText('The host picks the track');
  await expect(count(a.page)).toHaveText('2/4 players');

  // the host starts; both race
  await a.page.getByRole('button', { name: 'Start race' }).click();
  for (const p of [a.page, b.page]) await expect(p.locator('.lap').first()).toHaveText('Lap 1/3', { timeout: 5000 });

  // a player leaves mid-race
  await b.close();
  await expect(count(a.page)).toHaveText('1/4 players', { timeout: 5000 });

  // host hand-off: the host goes back to the garage (the room waits again), someone joins, then the host leaves
  await garage(a.page);
  await expect(a.page.locator('#countdown')).toContainText('Starts in', { timeout: 3000 });
  const c = await player(browser, testInfo, `${GAME}?room=${code}`);
  await joined(c.page, '2/4 players');
  await a.close();
  await expect(info(c.page)).toContainText('You are the host', { timeout: 5000 });
  await expect(c.page.getByRole('button', { name: 'Start race' })).toBeEnabled();
  await expect(c.page.getByRole('button', { name: 'Cancel' })).toBeVisible();

  expect([...a.errors, ...b.errors, ...c.errors]).toEqual([]);
  await c.close();
});
