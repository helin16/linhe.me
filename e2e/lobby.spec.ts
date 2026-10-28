// The online lobby (feature 004): host with a size, browse and join, the 60-second countdown, cancel, hand-over.
import { expect, test, type Page } from '@playwright/test';
import { ROOM_SIZES } from '../src/games/turbo-tumble/net.ts';
import { NetText } from '../src/shared/online/client.ts';
import { GameSlug } from '../src/games/index.ts';
import { count, GAME, garage, host, info, player, joined } from './helpers.ts';

const seconds = async (page: Page) => Number((await page.locator('#countdown').textContent())!.match(/\d+/)![0]);
const online = (page: Page) => page.getByRole('button', { name: 'Online', exact: true }).click();
const rooms = (page: Page) => page.locator('#roomList');

test('US1: host picks 4–12, gets a name and a countdown; 0 starts the race with a full grid; Start and Cancel', async ({ browser }, testInfo) => {
  const a = await player(browser, testInfo);
  await online(a.page);
  const size = a.page.getByLabel('Players');
  await expect(size.locator('option')).toHaveText(ROOM_SIZES.map(String));
  await expect(size).toHaveValue('4');
  await host(a.page, 8);
  await expect(a.page.locator('#roomName')).toHaveText(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  await expect(a.page.locator('#countdown')).toHaveText(/Starts in (60|59)s/);
  await expect(a.page.getByRole('button', { name: 'Start race' })).toBeEnabled();
  await expect(a.page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await expect(a.page.getByRole('button', { name: 'Leave' })).toBeHidden();

  // no one presses Start: at 0 the race starts, 8 karts on the grid (7 computer karts)
  await a.page.clock.fastForward(60_000);
  await expect(a.page.locator('.lap').first()).toHaveText('Lap 1/3', { timeout: 5000 });

  // back to the garage: the room waits again with a fresh countdown
  await garage(a.page);
  await expect(a.page.locator('#countdown')).toHaveText(/Starts in (60|59)s/, { timeout: 3000 });

  // a guest joins; the host starts early; then cancels from the garage
  const b = await player(browser, testInfo);
  await online(b.page);
  await rooms(b.page).getByRole('button').first().click();
  await joined(b.page, '2/8 players');
  expect(Math.abs(await seconds(a.page) - await seconds(b.page))).toBeLessThanOrEqual(1);
  await expect(b.page.getByRole('button', { name: 'Leave' })).toBeVisible();
  await expect(b.page.getByRole('button', { name: 'Cancel' })).toBeHidden();
  await a.page.getByRole('button', { name: 'Start race' }).click();
  for (const p of [a.page, b.page]) await expect(p.locator('.lap').first()).toHaveText('Lap 1/3', { timeout: 5000 });
  await garage(a.page);
  await a.page.getByRole('button', { name: 'Cancel' }).click();
  await expect(b.page.locator('#netInfo')).toHaveText(NetText.Closed, { timeout: 2000 });
  await expect(a.page.getByRole('button', { name: 'Host a room' })).toBeVisible();

  expect([...a.errors, ...b.errors]).toEqual([]);
  await a.close(); await b.close();
});

test('US1: when the host drops while waiting, the next player hosts and the countdown carries on', async ({ browser }, testInfo) => {
  const a = await player(browser, testInfo);
  const code = await host(a.page, 4);
  const b = await player(browser, testInfo, `${GAME}?room=${code}`);
  await joined(b.page, '2/4 players');
  await a.page.clock.fastForward(10_000);
  await b.page.clock.fastForward(10_000);
  const before = await seconds(b.page);
  await a.close();
  await expect(info(b.page)).toContainText('You are the host', { timeout: 5000 });
  await expect(b.page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  expect(Math.abs(await seconds(b.page) - before)).toBeLessThanOrEqual(1);
  expect(b.errors).toEqual([]);
  await b.close();
});

test('US2: the list shows waiting rooms live; pick to join, Leave to go back; started rooms vanish', async ({ browser }, testInfo) => {
  const b = await player(browser, testInfo);
  await online(b.page);
  await expect(rooms(b.page)).toHaveText(NetText.NoRooms, { timeout: 3000 });

  const a = await player(browser, testInfo);
  await host(a.page, 8);
  const name = (await a.page.locator('#roomName').textContent())!;
  const row = rooms(b.page).getByRole('button', { name: `${name} · 1/8` });
  await expect(row).toBeVisible({ timeout: 2000 }); // without reopening the popup
  await row.click();
  await joined(b.page, '2/8 players');
  await expect(count(a.page)).toHaveText('2/8 players');
  expect(Math.abs(await seconds(a.page) - await seconds(b.page))).toBeLessThanOrEqual(1);

  await b.page.getByRole('button', { name: 'Leave' }).click();
  await expect(count(a.page)).toHaveText('1/8 players', { timeout: 3000 });
  await expect(rooms(b.page).getByRole('button', { name: `${name} · 1/8` })).toBeVisible({ timeout: 2000 });

  // the host starts: the room leaves the list; a stale pick says the race has started
  // b keeps seeing the list from before the start (a fixed answer), so its pick is stale for sure
  const before = await (await b.page.request.get(`/relay/${GameSlug.TurboTumble}/rooms`)).text();
  await b.page.route(`**/relay/${GameSlug.TurboTumble}/rooms`, route => route.fulfill({ contentType: 'application/json', body: before }));
  await a.page.getByRole('button', { name: 'Start race' }).click();
  await expect(a.page.locator('.lap').first()).toHaveText('Lap 1/3', { timeout: 5000 });
  await rooms(b.page).getByRole('button', { name: `${name} · 1/8` }).click();
  await expect(b.page.locator('#netInfo')).toHaveText(NetText.Started, { timeout: 3000 });
  await b.page.unroute(`**/relay/${GameSlug.TurboTumble}/rooms`);
  await expect(rooms(b.page)).toHaveText(NetText.NoRooms, { timeout: 2000 });

  expect([...a.errors, ...b.errors]).toEqual([]);
  await a.close(); await b.close();
});

test('US3: a join link to a racing room says the race has started', async ({ browser }, testInfo) => {
  const a = await player(browser, testInfo);
  const code = await host(a.page, 4);
  await a.page.getByRole('button', { name: 'Start race' }).click();
  await expect(a.page.locator('.lap').first()).toHaveText('Lap 1/3', { timeout: 5000 });
  const b = await player(browser, testInfo, `${GAME}?room=${code}`);
  await expect(b.page.locator('#netInfo')).toHaveText(NetText.Started, { timeout: 3000 });
  expect([...a.errors, ...b.errors]).toEqual([]);
  await a.close(); await b.close();
});
