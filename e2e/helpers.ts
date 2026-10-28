// Shared steps for the online browser tests.
import { expect, type Browser, type BrowserContextOptions, type Page, type TestInfo } from '@playwright/test';
import { gameRoute } from '../src/shared/routes.ts';
import { GameSlug } from '../src/games/index.ts';

export const GAME = gameRoute(GameSlug.TurboTumble);

export async function player(browser: Browser, info: TestInfo, path = GAME, device: BrowserContextOptions = {}) {
  const context = await browser.newContext({ ...info.project.use, ...device }); // the project's device (iPad: touch), or one given
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.install(); // lets lobby tests fast-forward the countdown; time otherwise runs normally
  await page.goto(path);
  return { page, errors, close: () => context.close() };
}
export const count = (page: Page) => page.locator('#roomCount');
export const info = (page: Page) => page.locator('#roomInfo');
export async function host(page: Page, size = 4) {
  if (!(await page.getByRole('dialog').isVisible())) await page.getByRole('button', { name: 'Online', exact: true }).click();
  await page.getByLabel('Players').selectOption(String(size));
  await page.getByRole('button', { name: 'Host a room' }).click();
  await expect(count(page)).toHaveText(`1/${size} players`, { timeout: 3000 });
  return (await page.locator('#roomCode').textContent())!.trim();
}


/** Back to the garage mid-race (the G key; the on-screen button only shows on touch screens). */
export const garage = (page: Page) => page.keyboard.press('KeyG');

/** Starts a race from the garage and waits for the lap counter. */
export async function race(page: Page) {
  await page.getByRole('button', { name: 'Start race' }).click();
  await expect(page.locator('.lap').first()).toHaveText('Lap 1/3', { timeout: 5000 });
}

/** Waits for a page that opened a join link to be in the room; says what the page showed if it never got there.
 *  Generous: on CI several software-rendered game windows share one machine, so loading can take a while. */
export async function joined(page: Page, players: string) {
  try {
    await expect(count(page)).toHaveText(players, { timeout: 15_000 });
  } catch {
    throw new Error(`never joined (expected ${players}); the lobby said: "${await page.locator('#netInfo').textContent()}"`);
  }
}
