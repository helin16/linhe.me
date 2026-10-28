// Two browsers race online through the real relay (feature 003, US1).
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { gameRoute } from '../src/shared/routes.ts';
import { GameSlug } from '../src/games/index.ts';

const GAME = gameRoute(GameSlug.TurboTumble);

async function player(browser: Browser, info: TestInfo, path = GAME) {
  const context = await browser.newContext({ ...info.project.use }); // same device as the project (iPad: touch)
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(path);
  return { page, errors, close: () => context.close() };
}
const status = (page: Page) => page.locator('#netInfo');

test('create a room, join by link, race, leave, and hand over the host', async ({ browser }, info) => {
  const a = await player(browser, info);
  await a.page.getByRole('button', { name: 'Online', exact: true }).click();
  await a.page.getByRole('button', { name: 'Create room' }).click();
  await expect(status(a.page)).toContainText('Online as P1 · 1/4 players', { timeout: 3000 });
  const code = (await a.page.locator('#roomCode').textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{4}$/);
  await expect(a.page.getByRole('button', { name: 'Copy link' })).toBeVisible();

  // the friend opens the join link: code filled in, one tap to join
  const b = await player(browser, info, `${GAME}?room=${code.toLowerCase()}`);
  await expect(b.page.locator('#cCode')).toHaveValue(code);
  await b.page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(status(b.page)).toContainText('Online as P2 · 2/4 players', { timeout: 3000 });
  await expect(status(b.page)).toContainText('The host picks the track and starts');
  await expect(status(a.page)).toContainText('2/4 players');

  // the host starts; both race
  await a.page.getByRole('button', { name: 'Start race' }).click();
  for (const p of [a.page, b.page]) await expect(p.locator('.lap').first()).toHaveText('Lap 1/3', { timeout: 5000 });

  // a player leaves mid-race
  await b.close();
  await expect(status(a.page)).toContainText('1/4 players', { timeout: 5000 });

  // host hand-off: someone joins, then the host leaves
  const c = await player(browser, info, `${GAME}?room=${code}`);
  await c.page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(status(c.page)).toContainText('2/4 players', { timeout: 3000 });
  await a.close();
  await expect(status(c.page)).toContainText('You are the host', { timeout: 5000 });
  await expect(c.page.getByRole('button', { name: 'Start race' })).toBeEnabled();

  expect([...a.errors, ...b.errors, ...c.errors]).toEqual([]);
  await c.close();
});
