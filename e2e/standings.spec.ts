// Feature 005: the standings panel during races, and who's in the waiting room.
import { expect, test, type Page } from '@playwright/test';
import { count, GAME, host, player, race } from './helpers.ts';

const panel = (page: Page) => page.locator('#standings');
const roster = (page: Page) => page.locator('#roster');
const setName = (page: Page, name: string) => page.getByLabel('Name').fill(name);
const setColour = (page: Page, colour: string) => page.getByLabel('Kart colour').fill(colour);
const swatch = (page: Page, slot: number) => roster(page).locator('li').filter({ has: page.locator('.slot', { hasText: new RegExp(`^P${slot}$`) }) }).locator('.dot');
const rgb = (hex: string) => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

test('US1: 1 Player — four rows in race order, ours highlighted and matching the big position', async ({ browser }, info) => {
  const a = await player(browser, info);
  await setName(a.page, '<b>x</b>');
  await race(a.page);
  const rows = panel(a.page).locator('li');
  await expect(rows).toHaveCount(4);
  await expect(rows.locator('.place')).toHaveText(['1', '2', '3', '4']);
  await expect(rows.locator('.dot')).toHaveCount(4);
  await expect(panel(a.page).locator('li.mine')).toHaveCount(1);
  await expect(panel(a.page).locator('li.mine .name')).toHaveText('<b>x</b>'); // text, not markup
  for (let i = 0; i < 6; i++) { // the panel follows the live order: our row's place is our position
    const [pos, place] = await a.page.evaluate(() => [ // read both in the same frame
      parseInt(document.querySelector('.pv .pos')!.textContent!), Number(document.querySelector('#standings li.mine .place')!.textContent)]);
    expect(place).toBe(pos);
    await a.page.waitForTimeout(500);
  }
  expect(a.errors).toEqual([]);
  await a.close();
});

test('US1: 2 Players — one panel, both players highlighted', async ({ browser }, info) => {
  const a = await player(browser, info);
  await a.page.getByRole('button', { name: '2 Players' }).click();
  await race(a.page);
  await expect(panel(a.page)).toHaveCount(1);
  await expect(panel(a.page).locator('li')).toHaveCount(4);
  await expect(panel(a.page).locator('li.mine')).toHaveCount(2);
  expect(a.errors).toEqual([]);
  await a.close();
});

test('US1: online — every kart in an 8-player room, with the guest under their chosen name', async ({ browser }, info) => {
  const a = await player(browser, info);
  const code = await host(a.page, 8);
  const b = await player(browser, info, `${GAME}?room=${code}`);
  await expect(roster(a.page).locator('li')).toHaveCount(2, { timeout: 3000 });
  await setName(b.page, 'Guesty');
  await expect(roster(a.page)).toContainText('Guesty', { timeout: 2000 });
  await race(a.page);
  await expect(panel(a.page).locator('li')).toHaveCount(8);
  await expect(panel(a.page).locator('.name')).toContainText(['Guesty']);
  await expect(panel(b.page).locator('li')).toHaveCount(8, { timeout: 5000 });
  expect([...a.errors, ...b.errors]).toEqual([]);
  await a.close(); await b.close();
});

for (const [shape, viewport] of [['landscape', { width: 640, height: 360 }], ['portrait', { width: 360, height: 640 }]] as const)
test(`US1: phone ${shape} — top 3 plus our row, clear of the touch controls and the map`, async ({ browser }, info) => {
  const a = await player(browser, info, GAME, { viewport, hasTouch: true });
  // the game shows touch controls when the browser reports touch points; not every engine fakes them
  const touch = await a.page.evaluate(() => navigator.maxTouchPoints > 0);
  if (!touch) await a.close();
  test.skip(!touch, 'this engine does not emulate touch points');
  await host(a.page, 12);
  await race(a.page);
  const rows = panel(a.page).locator('li');
  await expect(rows.first()).toBeVisible();
  expect([3, 4]).toContain(await rows.count());
  await expect(panel(a.page).locator('li.mine')).toHaveCount(1);
  const box = (await panel(a.page).boundingBox())!;
  for (const control of ['.pv .steer', '.pv .acts', '#map']) {
    const c = (await a.page.locator(control).first().boundingBox())!;
    const overlap = box.x < c.x + c.width && c.x < box.x + box.width && box.y < c.y + c.height && c.y < box.y + box.height;
    expect(overlap, control).toBe(false);
  }
  expect(a.errors).toEqual([]);
  await a.close();
});

test('US2: host and guests see who joined, their colours, host and you, live', async ({ browser }, info) => {
  const a = await player(browser, info);
  await setName(a.page, 'Hosty');
  await setColour(a.page, '#ff0000');
  const code = await host(a.page, 4);
  await expect(roster(a.page).locator('li')).toHaveCount(1);
  await expect(roster(a.page).locator('li').first()).toContainText('P1');
  await expect(roster(a.page).locator('li').first()).toContainText('Hosty');
  await expect(roster(a.page).locator('li').first()).toContainText('host');
  await expect(roster(a.page).locator('li').first()).toContainText('you');
  await expect(swatch(a.page, 1)).toHaveCSS('background-color', rgb('#ff0000'));
  await expect(a.page.locator('#botCount')).toHaveText('+3 computer karts');

  const b = await player(browser, info, `${GAME}?room=${code}`);
  await expect(count(b.page)).toHaveText('2/4 players', { timeout: 5000 });
  await setName(b.page, '<i>B</i>');
  await setColour(b.page, '#0000ff');
  for (const p of [a.page, b.page]) await expect(roster(p).locator('li')).toHaveCount(2, { timeout: 2000 });
  await expect(roster(a.page).locator('li').nth(1)).toContainText('<i>B</i>', { timeout: 2000 }); // text, not markup
  await expect(swatch(a.page, 2)).toHaveCSS('background-color', rgb('#0000ff'), { timeout: 2000 });
  await expect(roster(b.page).locator('li', { hasText: 'you' })).toContainText('P2');
  await expect(roster(a.page).locator('li', { hasText: 'you' })).toContainText('P1');
  await expect(a.page.locator('#botCount')).toHaveText('+2 computer karts');

  await setColour(b.page, '#00ff00'); // a change in the garage reaches the others
  await expect(swatch(a.page, 2)).toHaveCSS('background-color', rgb('#00ff00'), { timeout: 2000 });

  // a third player joins, then the host leaves: the host mark moves to P2
  const c = await player(browser, info, `${GAME}?room=${code}`);
  await expect(count(c.page)).toHaveText('3/4 players', { timeout: 5000 }); // page load + join (slower on CI)
  await expect(roster(c.page).locator('li')).toHaveCount(3, { timeout: 2000 });
  await a.close();
  await expect(roster(b.page).locator('li')).toHaveCount(2, { timeout: 5000 });
  await expect(roster(b.page).locator('li', { hasText: 'host' })).toContainText('P2');

  await c.close();
  await expect(roster(b.page).locator('li')).toHaveCount(1, { timeout: 5000 });
  expect([...a.errors, ...b.errors, ...c.errors]).toEqual([]);
  await b.close();
});
