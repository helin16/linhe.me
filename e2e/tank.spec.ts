// Tank Clash (feature 007), against the production build. `?seed=` fixes the battlefield and computer tanks
// offline (research R12); the layouts used here are pinned in src/games/tank-clash/seed.test.ts.
import { expect, test, type Page } from '@playwright/test';
import { gameRoute } from '../src/shared/routes.ts';
import { GameSlug } from '../src/games/index.ts';
import { player } from './helpers.ts';
import { look } from './pixels.ts';

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
  test('a battle: both tanks in the life panel, a 30 s countdown, the active tank highlighted, no wind', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`);
    await expect(a.page.getByRole('heading', { name: 'Tank Clash' })).toBeVisible();
    await pick(a.page, 'Green Hills');
    await start(a.page);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    await expect(hearts(a.page, 'Player 1')).toHaveText('4.0');
    await expect(hearts(a.page, 'CPU 1')).toHaveText('5.0');
    await expect(row(a.page, 'Player 1')).toHaveClass(/active/);
    await expect(a.page.locator('#wind')).toHaveCount(0);
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
    await aim(a.page, 45, 91);
    await a.page.keyboard.press('Space');
    await expect(hearts(a.page, 'CPU 1')).toHaveText('4.0', { timeout: 8000 });
    await expect(turn(a.page)).toHaveText("CPU 1's turn (computer)", { timeout: 5000 });
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('a big countdown shows for the last 10 seconds; when it runs out the turn passes with no shot', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`);
    await pick(a.page, 'Green Hills');
    await start(a.page);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    await expect(a.page.locator('#bigCount')).toBeHidden(); // only for the last 10 seconds
    await a.page.clock.runFor(21_000);
    await expect(a.page.locator('#bigCount')).toHaveText(/^(10|9|8)$/);
    await a.page.clock.runFor(10_000);
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
    await expect(page.locator('.tc')).toHaveAttribute('data-detail', /^(full|low)$/); // lowering detail is allowed (009 FR-013)
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
    await aim(a.page, 30, 64);
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
    await expect(a.page.locator('#panel .tank')).toHaveCount(6);
    const names = await a.page.locator('#panel .tank .name').allTextContents();
    expect(names).toEqual(['Player 1', 'CPU 1', 'CPU 2', 'Player 2', 'CPU 3', 'CPU 4']);
    await a.close();
  });
});

test.describe('US3: choose and customise your tank', () => {
  test('the preview and stats change at once; choices survive a reload; the battle uses them; names show as typed', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`);
    const shot = () => a.page.locator('#preview').evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await expect(a.page.locator('#stats')).toHaveText('Cannon 10°–75° · Damage 1.0 · Top power 95 · Hearts 4 · Grip Medium · Speed 75');
    const before = await shot();
    await pick(a.page, 'Heavy');
    await expect(a.page.locator('#stats')).toHaveText('Cannon 30°–65° · Damage 1.5 · Top power 89 · Hearts 5 · Grip Low · Speed 60');
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

  test('Arcade is gone: no Style row; a save from Arcade days plays in the normal look and keeps its choices (008 US4)', async ({ browser }, info) => {
    const a = await player(browser, info, TANK);
    await expect(a.page.locator('#styleRow')).toHaveCount(0);
    await expect(a.page.getByRole('button', { name: 'Arcade' })).toHaveCount(0);
    await a.page.evaluate(() => localStorage.setItem('tc-cfg', JSON.stringify({ style: 'arcade', muted: true, tanks: 4,
      players: [{ name: 'Ann', color: '#3366ff', type: 'Heavy' }] })));
    await a.page.reload();
    await expect(a.page.getByLabel('Name')).toHaveValue('Ann');
    await expect(a.page.getByRole('button', { name: '4', exact: true })).toHaveClass(/on/);
    await start(a.page);
    await expect(a.page.locator('#mute')).toHaveText('🔇');
    await expect(hearts(a.page, 'Ann')).toHaveText('5.0');
    await expect(a.page.locator('.tc')).not.toHaveClass(/arcade/);
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
    const a = await player(browser, info, `${TANK}?seed=15`);
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
    // WebKit draws only the front window: bring each page forward before fast-forwarding or reading it
    await a.page.bringToFront();
    await a.page.clock.runFor(31_000);
    for (const p of [a.page, back]) { await p.bringToFront(); await expect(p.locator('#whoseTurn')).toHaveText("Bea's turn", { timeout: 40_000 }); }
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
    await b.page.bringToFront(); // WebKit draws only the front window
    await b.page.clock.runFor(31_000); // Bea runs the battle now: time turns out until Ann's comes round
    for (const p of [b.page, back]) { await p.bringToFront(); await expect(p.locator('#whoseTurn')).toHaveText("Ann's turn", { timeout: 40_000 }); }
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

// specs/008-tank-focus-camera and specs/009-tank-semi-3d: the game reports where things are on screen for these tests
// (contracts/ui.md: data-camera, data-view, data-tanks, data-shells, data-blast, data-materials)
const tc = (page: Page) => page.locator('.tc');
const attr = async (page: Page, name: string) => (await tc(page).getAttribute(`data-${name}`)) ?? '';
const viewOf = async (page: Page) => { const [cx, cy, halfW] = (await attr(page, 'view')).split(',').map(Number); return { cx, cy, halfW }; };
const tanksOf = async (page: Page) => (await attr(page, 'tanks')).split(';').filter(Boolean).map(s => {
  const [id, rest] = s.split(':'), [x, y, sx, sy, alive] = rest.split(',').map(Number);
  return { id: Number(id), x, y, sx, sy, alive: alive === 1 };
});
const point = (s: string) => { const [x, y, sx, sy] = s.split(',').map(Number); return { x, y, sx, sy }; };
const aspectOf = (page: Page) => { const v = page.viewportSize()!; return v.width / v.height; };
const shows = (v: { cx: number; cy: number; halfW: number }, x: number, y: number, aspect: number) =>
  Math.abs(x - v.cx) <= v.halfW + 2 && Math.abs(y - v.cy) <= v.halfW / aspect + 2;
const CLOSE = 400; // half the field's width (constants CLOSE_HALF_W)

test.describe('008/009: the 3D look, the camera and the overview map', () => {
  test('every map is solid 3D; each material looks itself; a shot leaves a crater with soil inside (009 US1)', async ({ browser }, info) => {
    test.setTimeout(120_000);
    const isMat: Record<string, (c: number[]) => boolean> = {
      1: ([r, g, b]) => r > b || g > b,                  // earth: grass or soil, never sky blue
      2: ([r, g, b]) => r > 190 && g > 190 && b > 190,   // snow: bright
      3: ([r, g, b]) => b > r && b > 150,                // ice: pale blue
      4: ([r, g, b]) => r > b + 25,                      // wood: brown
      5: ([r, , b]) => b > r + 30,                       // water: blue
    };
    for (const map of ['Green Hills', 'Timber Gap', 'Lake Valley', 'Frost Ridge']) {
      const a = await player(browser, info, `${TANK}?seed=1`);
      await pick(a.page, map); await start(a.page);
      await expect(tc(a.page)).toHaveAttribute('data-ready', '1');
      await a.page.clock.runFor(1500); // the view has settled
      const img = await look(a.page), tanks = await tanksOf(a.page);
      for (const m of (await attr(a.page, 'materials')).split(';')) {
        const [mat, rest] = m.split(':'), p = point(rest);
        if (p.sx < 0 || p.sx >= img.w || p.sy < 0 || p.sy >= img.h) continue; // off screen at the close view
        if (tanks.some(t => Math.abs(t.sx - p.sx) < 60 && Math.abs(t.sy - p.sy) < 40)) continue; // a tank stands there
        expect(isMat[mat](img.at(p.sx, p.sy)), `${map}: material ${mat} at ${p.sx},${p.sy} is ${img.at(p.sx, p.sy)}`).toBe(true);
      }
      expect(a.errors).toEqual([]);
      await a.close();
    }
    const a = await player(browser, info, `${TANK}?seed=1`);
    await pick(a.page, 'Green Hills'); await start(a.page);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    await a.page.keyboard.press('Space');
    await expect.poll(() => attr(a.page, 'blast'), { timeout: 10_000 }).not.toBe('');
    await a.page.clock.runFor(1200); // the fireball has gone
    const blast = point(await attr(a.page, 'blast')), [r, , b] = (await look(a.page)).at(blast.sx, blast.sy + 6);
    expect(b - r, 'soil shows inside the crater, not the blue sky behind').toBeLessThan(40);
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('tanks are solid 3D: each type and build looks different in the garage; bonuses show on the field (009 US2)', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`);
    const shot = () => a.page.locator('#preview').evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const seen = new Set<string>();
    for (const type of ['Scout', 'Allrounder', 'Heavy', 'Artillery']) for (const build of ['A', 'B', 'C']) {
      await pick(a.page, type); await pick(a.page, build);
      seen.add(await shot());
    }
    expect(seen.size, 'twelve different previews').toBe(12);
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('a repair kit sends a heart up from the tank (009 FR-009)', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`);
    await pick(a.page, 'Green Hills'); await start(a.page);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    await a.page.clock.runFor(31_000);
    await expect(turn(a.page)).toHaveText("Player 1's turn", { timeout: 15_000 });
    await a.page.clock.runFor(5000);
    await a.page.keyboard.down('ArrowRight');
    await expect(a.page.locator('#msg')).toHaveText('Repair kit!', { timeout: 10_000 });
    await a.page.keyboard.up('ArrowRight');
    const me = (await tanksOf(a.page)).find(t => t.id === 0)!, img = await look(a.page);
    let red = 0;
    for (let dy = 20; dy < 110; dy += 3) for (let dx = -12; dx <= 12; dx += 3) {
      const [r, g, b] = img.at(me.sx + dx, me.sy - dy); if (r > 200 && g < 120 && b < 150) red++;
    }
    expect(red, 'a red heart above the tank').toBeGreaterThan(0);
    await a.close();
  });

  test('the camera follows the tank in turn up close and keeps it in the middle third while driving (008 US1)', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`), aspect = aspectOf(a.page);
    await pick(a.page, 'Green Hills'); await start(a.page);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    await a.page.clock.runFor(1000);
    await expect(tc(a.page)).toHaveAttribute('data-camera', 'follow');
    const check = async () => {
      const v = await viewOf(a.page), t = (await tanksOf(a.page)).find(x => x.id === 0)!;
      expect(v.halfW).toBe(CLOSE);
      expect(Math.abs(v.cx - Math.min(1600 - CLOSE, Math.max(CLOSE, t.x)))).toBeLessThanOrEqual(CLOSE / 3 + 2);
      expect(shows(v, t.x, t.y, aspect)).toBe(true);
    };
    await check();
    await a.page.keyboard.down('ArrowRight');
    for (let i = 0; i < 5; i++) { await a.page.clock.runFor(200); await check(); }
    await a.page.keyboard.up('ArrowRight');
    // the next turn: the computer's tank (step to it, so it hasn't fired yet when we look)
    for (let i = 0; i < 80 && (await turn(a.page).textContent()) !== "CPU 1's turn (computer)"; i++) await a.page.clock.runFor(500);
    await expect(turn(a.page)).toHaveText("CPU 1's turn (computer)");
    let close = false; // before it fires (it thinks for 0.9 s), the close view lands on its tank
    for (let i = 0; i < 120 && !close && !(await attr(a.page, 'shells')); i++) {
      await a.page.clock.runFor(17);
      const v = await viewOf(a.page), cpu = (await tanksOf(a.page)).find(x => x.id === 1)!;
      close = v.halfW === CLOSE && shows(v, cpu.x, cpu.y, aspect);
    }
    expect(close).toBe(true);
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('the camera never jumps; with reduced motion it does (008 FR-002, FR-010)', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`);
    await pick(a.page, 'Green Hills'); await start(a.page);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    const steps: number[] = [];
    let prev = await viewOf(a.page);
    for (let i = 0; i < 40; i++) { // through the zoom-in from the whole field
      await a.page.clock.runFor(17);
      const v = await viewOf(a.page);
      steps.push(Math.max(Math.abs(v.cx - prev.cx), Math.abs(v.halfW - prev.halfW) * 2) / (2 * prev.halfW));
      prev = v;
    }
    expect(Math.max(...steps)).toBeLessThanOrEqual(0.1); // two frames' worth at most: 5% a frame
    await a.page.emulateMedia({ reducedMotion: 'reduce' });
    await a.page.goto(`${TANK}?seed=1`);
    await pick(a.page, 'Green Hills'); await start(a.page);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    await a.page.clock.runFor(50);
    expect((await viewOf(a.page)).halfW, 'straight to the close view').toBe(CLOSE);
    await a.close();
  });

  test('a shot: the view widens to keep the firing tank and the shell on screen, shows the blast, then the next tank (008 US2)', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`), aspect = aspectOf(a.page);
    await pick(a.page, 'Green Hills'); await start(a.page);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    await aim(a.page, 45, 95);
    await a.page.clock.runFor(1000);
    const shooter = (await tanksOf(a.page)).find(t => t.id === 0)!;
    await a.page.keyboard.press('Space');
    let widest = 0, frames = 0;
    for (let i = 0; i < 400; i++) {
      await a.page.clock.runFor(17);
      const shell = await attr(a.page, 'shells');
      if (!shell) { if (frames) break; continue; }
      frames++;
      const v = await viewOf(a.page), s = point(shell);
      expect(await attr(a.page, 'camera')).toBe('shot');
      if (s.y >= 0) expect(shows(v, s.x, s.y, aspect), `shell at ${s.x},${s.y} in view ${JSON.stringify(v)}`).toBe(true);
      expect(shows(v, shooter.x, shooter.y, aspect)).toBe(true);
      widest = Math.max(widest, v.halfW);
    }
    expect(frames).toBeGreaterThan(10);
    expect(widest, 'a long shot widens the view').toBeGreaterThan(CLOSE);
    const blast = point(await attr(a.page, 'blast'));
    expect(shows(await viewOf(a.page), blast.x, blast.y, aspect)).toBe(true);
    await expect(turn(a.page)).toHaveText("CPU 1's turn (computer)", { timeout: 10_000 });
    await a.page.clock.runFor(1500);
    await expect(tc(a.page)).toHaveAttribute('data-camera', 'follow');
    await a.close();
  });

  test('the battle over: the whole field (008 FR-013)', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=14`);
    await pick(a.page, '2 Players'); await pick(a.page, 'Timber Gap'); await start(a.page);
    await aim(a.page, 30, 64);
    await a.page.keyboard.press('Space');
    await expect(a.page.locator('#endText')).toContainText('Player 1 wins!', { timeout: 10_000 });
    await expect(tc(a.page)).toHaveAttribute('data-camera', 'whole');
    await expect.poll(async () => (await viewOf(a.page)).halfW).toBeGreaterThanOrEqual(799); // gliding out to the whole field
    await a.close();
  });

  test('the overview map: drag or tap to look around, keys too; driving brings the camera back; hiding is remembered (008 US3)', async ({ browser }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`);
    await pick(a.page, 'Green Hills'); await start(a.page);
    await expect(turn(a.page)).toHaveText("Player 1's turn");
    await a.page.clock.runFor(1000);
    const map = a.page.locator('#overview'), box = (await map.boundingBox())!, before = await viewOf(a.page);
    if (info.project.name.includes('ipad')) await map.tap({ position: { x: box.width - 4, y: box.height / 2 } });
    else {
      const x0 = box.x + before.cx / 1600 * box.width, y = box.y + box.height / 2;
      await a.page.mouse.move(x0, y); await a.page.mouse.down(); await a.page.mouse.move(box.x + box.width - 4, y, { steps: 5 }); await a.page.mouse.up();
    }
    await expect(tc(a.page)).toHaveAttribute('data-camera', 'held');
    await a.page.clock.runFor(1000);
    expect((await viewOf(a.page)).cx).toBe(1600 - CLOSE); // to the far side, same zoom
    expect((await viewOf(a.page)).halfW).toBe(before.halfW);
    await a.page.keyboard.down('ArrowRight'); await a.page.clock.runFor(100); await a.page.keyboard.up('ArrowRight');
    await expect(tc(a.page)).toHaveAttribute('data-camera', 'follow');
    await a.page.keyboard.press('BracketRight');
    await expect(tc(a.page)).toHaveAttribute('data-camera', 'held');
    await a.page.keyboard.press('KeyF');
    await expect(tc(a.page)).toHaveAttribute('data-camera', 'follow');
    await a.page.getByRole('button', { name: 'Hide map' }).click();
    await expect(map).toBeHidden();
    await a.page.reload(); await start(a.page);
    await expect(a.page.getByRole('button', { name: 'Show map' })).toBeVisible();
    await expect(map).toBeHidden();
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('the overview map stays clear of the tank list, the turn bar and the controls on phones and desktops (008 FR-011)', async ({ browser }, info) => {
    for (const size of [{ width: 844, height: 390 }, { width: 390, height: 844 }, { width: 1280, height: 720 }]) {
      const a = await player(browser, info, `${TANK}?seed=1`, { viewport: size });
      await pick(a.page, '4'); await start(a.page);
      await expect(turn(a.page)).toHaveText("Player 1's turn");
      const boxOf = async (sel: string) => (await a.page.locator(sel).boundingBox())!;
      const m = await boxOf('#mapBox');
      for (const sel of ['#panel', '#bar', '#controls']) {
        const o = await boxOf(sel);
        const apart = m.x + m.width <= o.x || o.x + o.width <= m.x || m.y + m.height <= o.y || o.y + o.height <= m.y;
        expect(apart, `${size.width}×${size.height}: the map and ${sel}`).toBe(true);
      }
      await a.close();
    }
  });

  test('a battle opens quickly (009 SC-005)', async ({ browser, browserName }, info) => {
    const a = await player(browser, info, `${TANK}?seed=1`);
    const t0 = Date.now();
    await start(a.page);
    await expect(tc(a.page)).toHaveAttribute('data-ready', '1');
    expect(Date.now() - t0).toBeLessThan(browserName === 'webkit' ? 3500 : 2500);
    await a.close();
  });

  test('online: each screen looks around on its own; both see the same battle (008 FR-009)', async ({ browser }, info) => {
    test.setTimeout(120_000);
    const a = await player(browser, info, TANK);
    await a.page.getByLabel('Name').fill('Ann');
    await a.page.getByRole('button', { name: 'Online', exact: true }).click();
    await a.page.getByLabel('Players').selectOption('2');
    await a.page.getByRole('button', { name: 'Host a room' }).click();
    await expect(a.page.locator('#roomCount')).toHaveText('1/2 players', { timeout: 5000 });
    const code = (await a.page.locator('#roomCode').textContent())!.trim();
    const b = await player(browser, info, `${TANK}?room=${code}`);
    await expect(a.page.locator('#roomCount')).toHaveText('2/2 players', { timeout: 10_000 });
    await a.page.getByRole('button', { name: 'Start', exact: true }).click();
    for (const p of [a.page, b.page]) await expect(p.locator('#panel .tank')).toHaveCount(2, { timeout: 10_000 });
    await a.page.waitForTimeout(1500);
    await a.page.bringToFront();
    await a.page.keyboard.press('BracketRight'); await a.page.keyboard.press('BracketRight');
    await expect(tc(a.page)).toHaveAttribute('data-camera', 'held');
    await b.page.bringToFront();
    await expect(tc(b.page)).not.toHaveAttribute('data-camera', 'held');
    expect(await a.page.locator('#panel .num').allTextContents()).toEqual(await b.page.locator('#panel .num').allTextContents());
    await a.close(); await b.close();
  });
});
