// Tank Clash (feature 007), against the production build. `?seed=` fixes the battlefield, wind and computer tanks
// offline (research R12); the layouts used here are pinned in src/games/tank-clash/seed.test.ts.
import { expect, test, type Page } from '@playwright/test';
import { gameRoute } from '../src/shared/routes.ts';
import { GameSlug } from '../src/games/index.ts';
import { player } from './helpers.ts';

const TANK = gameRoute(GameSlug.TankClash);
const start = (page: Page) => page.getByRole('button', { name: 'Start', exact: true }).click();
const pick = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const row = (page: Page, name: string) => page.locator('#panel .tank', { hasText: name });
const hearts = (page: Page, name: string) => row(page, name).locator('.num');
const turn = (page: Page) => page.locator('#whoseTurn');
async function aim(page: Page, angle: number, power: number) {
  await expect(page.locator('#angle')).toHaveText(/Angle \d+°/);
  const now = Number((await page.locator('#angle').textContent())!.match(/\d+/)![0]);
  for (let i = 0; i < Math.abs(angle - now); i++) await page.keyboard.press(angle > now ? 'ArrowUp' : 'ArrowDown');
  await page.locator('#cPower').fill(String(power));
  await expect(page.locator('#angle')).toHaveText(`Angle ${angle}°`);
  await expect(page.locator('#power')).toHaveText(String(power));
}

test.describe('US1: battle computer tanks solo', () => {
  test('a battle: both tanks in the life panel, wind, a 30 s countdown, the active tank highlighted', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`);
    await expect(a.page.getByRole('heading', { name: 'Tank Clash' })).toBeVisible();
    await pick(a.page, 'Green Hills');
    await start(a.page);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    await expect(hearts(a.page, 'Player 1')).toHaveText('4.0');
    await expect(hearts(a.page, 'CPU 1')).toHaveText('5.0');
    await expect(row(a.page, 'Player 1')).toHaveClass(/active/);
    await expect(a.page.locator('#wind')).toHaveText(/Wind → 11/);
    await expect(a.page.locator('#timer')).toHaveText(/^(30|29|28)$/);
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('aiming stops at the tank type’s limits', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`);
    await start(a.page);
    for (let i = 0; i < 40; i++) await a.page.keyboard.press('ArrowUp');
    await expect(a.page.locator('#angle')).toHaveText('Angle 75°'); // the Allrounder's top
    for (let i = 0; i < 80; i++) await a.page.keyboard.press('ArrowDown');
    await expect(a.page.locator('#angle')).toHaveText('Angle 10°');
    await a.close();
  });

  test('a hit takes the firer’s damage off the target, shown in the panel at once', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`);
    await pick(a.page, 'Green Hills');
    await start(a.page);
    await aim(a.page, 45, 88);
    await a.page.keyboard.press('Space');
    await expect(hearts(a.page, 'CPU 1')).toHaveText('4.0', { timeout: 8000 });
    await expect(turn(a.page)).toHaveText("CPU 1's turn (computer)", { timeout: 5000 });
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('when the countdown runs out the turn passes with no shot', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`);
    await pick(a.page, 'Green Hills');
    await start(a.page);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    await a.page.clock.runFor(31_000);
    await expect(turn(a.page)).toHaveText("CPU 1's turn (computer)");
    await expect(hearts(a.page, 'CPU 1')).toHaveText('5.0');
    await a.close();
  });

  test('destroying the last enemy wins: break the bridge under it (no wreck), "You win!"', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=7`);
    await pick(a.page, 'Timber Gap');
    await start(a.page);
    await aim(a.page, 30, 56);
    await a.page.keyboard.press('Space');
    await expect(a.page.locator('#endText')).toContainText('You win!', { timeout: 10_000 });
    await expect(a.page.getByRole('button', { name: 'Play again' })).toBeVisible();
    await expect(hearts(a.page, 'CPU 1')).toHaveText('destroyed');
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('6 tanks: three a side in the panel, turns alternating sides', async ({ browser }, info) => {
    test.setTimeout(180_000); // fast-forwarding a 6-tank turn is slow in WebKit under load
    const a = await player(browser, info, `${TANK}?seed=2`);
    await pick(a.page, '6');
    await start(a.page);
    await expect(a.page.locator('#panel .tank')).toHaveCount(6);
    const sides = await a.page.locator('#panel li').allTextContents();
    expect(sides.filter(s => s === 'Left' || s === 'Right')).toEqual(['Left', 'Right']);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    await a.page.clock.runFor(31_000);
    await expect(turn(a.page)).toHaveText(/^CPU \d's turn \(computer\)$/, { timeout: 20_000 });
    const active = await a.page.locator('#panel .tank.active').getAttribute('data-id');
    expect(Number(active)).toBeGreaterThanOrEqual(3); // ids 3–5 are the Right side
    await a.close();
  });

  test('first shot within 20 s of opening the page (SC-001); mute is remembered (FR-024)', async ({ browser }, info) => {
    const t0 = Date.now();
    const a = await player(browser, info, `${TANK}?seed=1`);
    await start(a.page);
    await a.page.getByRole('button', { name: 'FIRE' }).click();
    expect(Date.now() - t0).toBeLessThan(20_000);
    await a.page.getByRole('button', { name: 'Sound on or off' }).click();
    await expect(a.page.locator('#mute')).toHaveText('🔇');
    await a.page.reload();
    await start(a.page);
    await expect(a.page.locator('#mute')).toHaveText('🔇');
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('touch: hold ▲ to raise the cannon, tap FIRE', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`, { hasTouch: true });
    await pick(a.page, 'Green Hills');
    await start(a.page);
    await expect(a.page.locator('#angle')).toHaveText('Angle 45°');
    const up = a.page.getByRole('button', { name: 'Raise the cannon' });
    await up.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
    await a.page.waitForTimeout(500);
    await up.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
    await expect(a.page.locator('#angle')).not.toHaveText('Angle 45°');
    await a.page.getByRole('button', { name: 'FIRE' }).tap();
    await expect(turn(a.page)).toHaveText("CPU 1's turn (computer)", { timeout: 8000 });
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('runs smoothly with 10 tanks (SC-002)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'frame timing is measured in Chromium');
    await page.goto(`${TANK}?seed=3`);
    await pick(page, '10');
    await start(page);
    await page.getByRole('button', { name: 'FIRE' }).click();
    const fps = await page.evaluate(() => new Promise<number>(done => {
      let frames = 0; const t0 = performance.now();
      const count = (t: number) => { frames++; if (t - t0 < 3000) requestAnimationFrame(count); else done(frames / ((t - t0) / 1000)); };
      requestAnimationFrame(count);
    }));
    expect(fps).toBeGreaterThanOrEqual(50);
  });
});

test.describe('US2: two players on one device', () => {
  test('player 1 leads Left and goes first, and wins by breaking the bridge under player 2', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=14`);
    await pick(a.page, '2 Players');
    await pick(a.page, 'Timber Gap');
    await start(a.page);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    expect(await a.page.locator('#panel li').evaluateAll(li => li.map(x => x.querySelector('.name')?.textContent ?? x.textContent)))
      .toEqual(['Left', 'Player 1', 'Right', 'Player 2']);
    await aim(a.page, 30, 62);
    await a.page.keyboard.press('Space');
    await expect(a.page.locator('#endText')).toContainText('Player 1 wins!', { timeout: 10_000 });
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('a timed-out turn passes to player 2 (no computer); with 6 tanks each player has two computer teammates', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=2`);
    await pick(a.page, '2 Players');
    await start(a.page);
    await a.page.clock.runFor(31_000);
    await expect(turn(a.page)).toHaveText("Player 2's turn");
    await expect(a.page.locator('#controls button').first()).toBeEnabled(); // player 2 plays on this device
    await a.page.reload();
    await pick(a.page, '2 Players');
    await pick(a.page, '6');
    await start(a.page);
    const names = await a.page.locator('#panel .tank .name').allTextContents();
    expect(names).toEqual(['Player 1', 'CPU 1', 'CPU 2', 'Player 2', 'CPU 3', 'CPU 4']);
    await a.close();
  });
});

test.describe('US3: choose and customise your tank', () => {
  test('the preview and stats change at once; choices survive a reload; the battle uses them; names show as typed', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`);
    const shot = () => a.page.locator('#preview').evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await expect(a.page.locator('#stats')).toHaveText('Cannon 10°–75° · Damage 1.0 · Hearts 4 · Grip Medium');
    const before = await shot();
    await pick(a.page, 'Heavy');
    await expect(a.page.locator('#stats')).toHaveText('Cannon 30°–65° · Damage 1.5 · Hearts 5 · Grip Low');
    expect(await shot()).not.toEqual(before);
    const heavy = await shot();
    await a.page.getByLabel('Colour').fill('#3366ff');
    expect(await shot()).not.toEqual(heavy);
    await a.page.getByLabel('Name').fill('<b>x</b>');
    await a.page.reload();
    await expect(a.page.getByLabel('Name')).toHaveValue('<b>x</b>');
    await expect(a.page.getByLabel('Colour')).toHaveValue('#3366ff');
    await expect(a.page.getByRole('button', { name: 'Heavy' })).toHaveClass(/on/);
    await start(a.page);
    await expect(hearts(a.page, '<b>x</b>')).toHaveText('5.0');
    await expect(row(a.page, '<b>x</b>').locator('.name')).toHaveText('<b>x</b>');
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('2 Players: a tab per tank; tank 2 can’t take tank 1’s colour', async ({ browser }, info) => {
    const a = await player(browser, info, TANK);
    await pick(a.page, '2 Players');
    await pick(a.page, 'Tank 2');
    await a.page.getByLabel('Colour').fill('#4caf50'); // tank 1's
    await expect(a.page.locator('#colorNote')).toHaveText(/taken by Tank 1/);
    await expect(a.page.getByLabel('Colour')).not.toHaveValue('#4caf50');
    await a.close();
  });
});

test.describe('US4: pick the map', () => {
  test('each map starts with its name shown; Random picks one of them', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=4`);
    for (const map of ['Green Hills', 'Timber Gap', 'Lake Valley', 'Frost Ridge']) {
      await pick(a.page, map);
      await start(a.page);
      await expect(a.page.locator('#msg')).toHaveText(map);
      await a.page.reload();
    }
    await pick(a.page, 'Random');
    await start(a.page);
    await expect(a.page.locator('#msg')).toHaveText(/^(Green Hills|Timber Gap|Lake Valley|Frost Ridge)$/);
    expect(a.errors).toEqual([]);
    await a.close();
  });
});

test.describe('US5: air drops', () => {
  test('after a round a crate floats down; driving onto a repair kit adds a heart', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=19`);
    await pick(a.page, 'Green Hills');
    await start(a.page);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    await a.page.clock.runFor(31_000); // pass
    await expect(turn(a.page)).toHaveText("Player 1's turn", { timeout: 15_000 }); // the computer has played
    await expect(hearts(a.page, 'Player 1')).toHaveText('3.2');
    await a.page.clock.runFor(5000); // the crate lands
    await a.page.keyboard.down('ArrowRight');
    await expect(a.page.locator('#msg')).toHaveText('Repair kit!', { timeout: 10_000 });
    await a.page.keyboard.up('ArrowRight');
    await expect(hearts(a.page, 'Player 1')).toHaveText('4.0');
    expect(a.errors).toEqual([]);
    await a.close();
  });
});

test.describe('US6: play online', () => {
  const online = (page: Page) => page.getByRole('button', { name: 'Online', exact: true }).click();
  const hostRoom = async (page: Page, size: number) => {
    await online(page);
    await page.getByLabel('Players').selectOption(String(size));
    await page.getByRole('button', { name: 'Host a room' }).click();
    await expect(page.locator('#roomCount')).toHaveText(`1/${size} players`, { timeout: 5000 });
    return { name: (await page.locator('#roomName').textContent())!, code: (await page.locator('#roomCode').textContent())!.trim() };
  };
  const named = async (page: Page, name: string) => { await page.getByLabel('Name').fill(name); };
  const joinByList = async (page: Page, roomName: string) => {
    if (!(await page.getByRole('dialog').isVisible())) await online(page);
    await page.locator('#roomList').getByRole('button', { name: new RegExp(`^${roomName} · `) }).click({ timeout: 5000 });
  };
  const nums = (page: Page) => page.locator('#panel .num').allTextContents();
  const mineToPlay = (page: Page) => page.evaluate(() => document.querySelector('.tc')!.classList.contains('my-turn'));

  test('only Tank Clash rooms; sides shown and switchable; the host’s picks shown; one battle on every screen', async ({ browser }, info) => {
    test.setTimeout(120_000);
    const sd = await player(browser, info, gameRoute(GameSlug.SnakeDuel)); // a Snake Duel room meanwhile
    await sd.page.getByRole('button', { name: 'Online', exact: true }).click();
    await sd.page.getByRole('button', { name: 'Host a room' }).click();
    await expect(sd.page.locator('#roomCount')).toHaveText(/1\/\d+ players/, { timeout: 5000 });
    const sdName = (await sd.page.locator('#roomName').textContent())!;

    const a = await player(browser, info, TANK), b = await player(browser, info, TANK);
    await named(a.page, 'Ann'); await named(b.page, 'Bea');
    const room = await hostRoom(a.page, 4);
    await online(b.page);
    await expect(b.page.locator('#roomList')).not.toContainText(sdName, { timeout: 3000 });
    await joinByList(b.page, room.name);
    for (const p of [a.page, b.page]) await expect(p.locator('#roomCount')).toHaveText('2/4 players', { timeout: 5000 });
    // sides: random, but the two players start on opposite sides; the roster shows each player's side
    for (const p of [a.page, b.page]) await expect(p.locator('#roster li')).toHaveCount(2);
    await expect.poll(async () => { const tags = await a.page.locator('#roster li').allTextContents(); return tags.some(t => t.includes('Left')) && tags.some(t => t.includes('Right')); }, { timeout: 3000 }).toBe(true);
    // the host's picks reach the guest, who can't change them
    await a.page.getByRole('button', { name: 'Frost Ridge' }).click();
    await a.page.locator('#cTanks').getByRole('button', { name: '6' }).click();
    await expect(b.page.getByRole('button', { name: 'Frost Ridge' })).toHaveClass(/on/, { timeout: 2000 });
    await expect(b.page.locator('#cTanks').getByRole('button', { name: '6' })).toHaveClass(/on/);
    await expect(b.page.getByRole('button', { name: 'Frost Ridge' })).toBeDisabled();
    // B switches to A's side: allowed (a side holds half the tanks: 3 of 6); everyone sees it
    const bSide = (await b.page.locator('#cSide .opt.on').textContent({ timeout: 3000 }))!;
    const other = bSide === 'Left' ? 'Right' : 'Left';
    await b.page.locator('#cSide').getByRole('button', { name: other }).click();
    await expect(a.page.locator('#roster li', { hasText: 'Bea' })).toContainText(other, { timeout: 2000 });

    await a.page.getByRole('button', { name: 'Start', exact: true }).click();
    for (const p of [a.page, b.page]) {
      await expect(p.locator('#msg')).toHaveText('Frost Ridge', { timeout: 6000 });
      await expect(p.locator('#panel .tank')).toHaveCount(6);
    }
    expect(await a.page.locator('#panel .name').allTextContents()).toEqual(await b.page.locator('#panel .name').allTextContents());
    // Ann and Bea are on the same side: Left takes the first turn
    const first = await a.page.locator('#whoseTurn').textContent({ timeout: 3000 });
    await expect(b.page.locator('#whoseTurn')).toHaveText(first!);
    expect(a.errors.concat(b.errors, sd.errors)).toEqual([]);
    await a.close(); await b.close(); await sd.close();
  });

  test('every screen agrees on shots, hearts, the countdown (≤ 1 s) and shows a shot within 0.5 s (SC-004)', async ({ browser }, info) => {
    test.setTimeout(120_000);
    const a = await player(browser, info, TANK), b = await player(browser, info, TANK);
    await named(a.page, 'Ann'); await named(b.page, 'Bea');
    const room = await hostRoom(a.page, 2);
    await joinByList(b.page, room.name);
    await expect(a.page.locator('#roomCount')).toHaveText('2/2 players', { timeout: 5000 });
    await a.page.getByRole('button', { name: 'Start', exact: true }).click();
    for (const p of [a.page, b.page]) await expect(p.locator('#panel .tank')).toHaveCount(2, { timeout: 6000 });
    await a.page.waitForTimeout(1500);
    const [ta, tb] = await Promise.all([a.page.locator('#timer').textContent(), b.page.locator('#timer').textContent()]);
    expect(Math.abs(Number(ta) - Number(tb))).toBeLessThanOrEqual(1);

    const shooter = (await mineToPlay(a.page)) ? a : b, watcher = shooter === a ? b : a;
    const t0 = Date.now();
    await shooter.page.keyboard.press('Space');
    await watcher.page.waitForFunction(() => document.querySelector('#timer')!.textContent === '', null, { polling: 'raf', timeout: 3000 });
    expect(Date.now() - t0).toBeLessThan(500);
    const next = shooter === a ? 'Bea' : 'Ann';
    for (const p of [a.page, b.page]) await expect(p.locator('#whoseTurn')).toHaveText(`${next}'s turn`, { timeout: 10_000 });
    expect(await nums(a.page)).toEqual(await nums(b.page));
    expect(a.errors.concat(b.errors)).toEqual([]);
    await a.close(); await b.close();
  });

  test('a battle refuses newcomers; a dropped player’s tank goes to a computer, and they rejoin from the same device', async ({ browser }, info) => {
    test.setTimeout(120_000);
    const a = await player(browser, info, TANK), b = await player(browser, info, TANK);
    await named(a.page, 'Ann'); await named(b.page, 'Bea');
    const room = await hostRoom(a.page, 3);
    await joinByList(b.page, room.name);
    await expect(a.page.locator('#roomCount')).toHaveText('2/3 players', { timeout: 5000 });
    await a.page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(b.page.locator('#panel .tank')).toHaveCount(2, { timeout: 6000 });

    const c = await player(browser, info, `${TANK}?room=${room.code}`);
    await expect(c.page.locator('#netInfo')).toHaveText('That game has already started', { timeout: 15_000 });

    const context = b.page.context();
    await b.page.close(); // Bea drops; her device keeps its rejoin key
    await expect(a.page.locator('#msg')).toHaveText('Bea left: a computer takes over', { timeout: 5000 });
    const back = await context.newPage(), backErrors: string[] = [];
    back.on('pageerror', e => backErrors.push(e.message)); back.on('console', m => { if (m.type() === 'error') backErrors.push(m.text()); });
    await back.goto(TANK);
    await online(back);
    await back.getByRole('button', { name: 'Rejoin battle' }).click();
    await expect(back.locator('#panel .tank')).toHaveCount(2, { timeout: 10_000 });
    await expect(back.locator('#panel .tank.you .name')).toHaveText('Bea');
    // from her tank's next turn it's hers again: no "(computer)" on either screen
    await a.page.clock.runFor(31_000);
    for (const p of [a.page, back]) await expect(p.locator('#whoseTurn')).toHaveText("Bea's turn", { timeout: 40_000 });
    expect(a.errors.concat(backErrors)).toEqual([]);
    await a.close(); await b.close(); await c.close();
  });

  test('the host drops and rejoins: the battle goes on under the next player, and Ann gets her tank back', async ({ browser }, info) => {
    test.setTimeout(120_000);
    const a = await player(browser, info, TANK), b = await player(browser, info, TANK);
    await named(a.page, 'Ann'); await named(b.page, 'Bea');
    const room = await hostRoom(a.page, 2);
    await joinByList(b.page, room.name);
    await expect(a.page.locator('#roomCount')).toHaveText('2/2 players', { timeout: 5000 });
    await a.page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(b.page.locator('#panel .tank')).toHaveCount(2, { timeout: 6000 });
    const context = a.page.context();
    await a.page.close(); // the host (and runner) drops: Bea runs the battle now
    await expect(b.page.locator('#msg')).toHaveText('Ann left: a computer takes over', { timeout: 5000 });
    const back = await context.newPage(), backErrors: string[] = [];
    back.on('pageerror', e => backErrors.push(e.message)); back.on('console', m => { if (m.type() === 'error') backErrors.push(m.text()); });
    await back.goto(TANK);
    await online(back);
    await back.getByRole('button', { name: 'Rejoin battle' }).click();
    await expect(back.locator('#panel .tank')).toHaveCount(2, { timeout: 10_000 });
    await expect(back.locator('#panel .tank.you .name')).toHaveText('Ann');
    await b.page.clock.runFor(31_000); // Bea runs the battle now: time turns out until Ann's comes round
    for (const p of [b.page, back]) await expect(p.locator('#whoseTurn')).toHaveText("Ann's turn", { timeout: 40_000 });
    expect(b.errors.concat(backErrors)).toEqual([]);
    await a.close(); await b.close();
  });

  test('joining and leaving a waiting room offers no "Rejoin battle" (keys are kept only for battles)', async ({ browser }, info) => {
    const a = await player(browser, info, TANK), b = await player(browser, info, TANK);
    const room = await hostRoom(a.page, 2);
    await joinByList(b.page, room.name);
    await expect(b.page.locator('#roomCount')).toHaveText('2/2 players', { timeout: 5000 });
    await b.page.getByRole('button', { name: 'Leave' }).click();
    await expect(b.page.getByRole('button', { name: 'Host a room' })).toBeVisible();
    await expect(b.page.getByRole('button', { name: 'Rejoin battle' })).toBeHidden();
    await a.close(); await b.close();
  });

  test('when the relay can’t be reached, Online says so within 5 s and 1 Player still works', async ({ browser }, info) => {
    const d = await player(browser, info, TANK);
    await d.page.routeWebSocket(/\/relay\//, () => {}); // opens but never answers
    await online(d.page);
    await d.page.getByRole('button', { name: 'Host a room' }).click();
    await expect(d.page.locator('#netInfo')).toHaveText("Online play isn't available right now", { timeout: 6000 });
    await d.page.getByRole('button', { name: 'Close' }).click();
    await d.page.getByRole('button', { name: '1 Player' }).click();
    await d.page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(d.page.locator('#panel .tank')).toHaveCount(2);
    await d.close();
  });
});
