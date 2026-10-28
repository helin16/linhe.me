// Snake Duel (feature 006), against the production build. `?seed=` fixes the arena and `?bots=0` parks the computer
// snakes (offline only, research R9): players always start in the same place with a line of orbs ahead.
import { expect, test, type Page } from '@playwright/test';
import { gameRoute } from '../src/shared/routes.ts';
import { GameSlug } from '../src/games/index.ts';
import { player } from './helpers.ts';

const SNAKE = gameRoute(GameSlug.SnakeDuel);
const len = (page: Page, id = 'len') => page.locator(`#${id}`);
const lengthOf = async (page: Page, id = 'len') => Number((await len(page, id).textContent())!.match(/Length (\d+)/)![1]);
const start = (page: Page) => page.getByRole('button', { name: 'Start', exact: true }).click();
const hold = async (page: Page, key: string, ms: number) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };

test.describe('US1: play solo', () => {
  test('starts at length 10 with a minimap; going straight eats the lead orbs; turning eats fewer', async ({ browser }, info) => {
    const a = await player(browser, info, `${SNAKE}?seed=1&bots=0`);
    await expect(a.page.getByRole('heading', { name: 'Snake Duel' })).toBeVisible();
    await start(a.page);
    await expect(len(a.page)).toHaveText('Length 10');
    await expect(a.page.locator('#mini')).toBeVisible();
    await a.page.waitForTimeout(2000);
    const straight = await lengthOf(a.page);
    expect(straight).toBeGreaterThanOrEqual(15);

    const b = await player(browser, info, `${SNAKE}?seed=1&bots=0`);
    await start(b.page);
    await hold(b.page, 'ArrowRight', 2000); // circling right misses most of the line
    expect(await lengthOf(b.page)).toBeLessThan(straight);
    expect([...a.errors, ...b.errors]).toEqual([]);
    await a.close(); await b.close();
  });

  test('boost shrinks the snake back to 10 and no further; going out shows the length; the best is kept', async ({ browser }, info) => {
    const a = await player(browser, info, `${SNAKE}?seed=1&bots=0`);
    await start(a.page);
    await a.page.waitForTimeout(2000); // eat the lead orbs
    expect(await lengthOf(a.page)).toBeGreaterThan(10);
    await hold(a.page, 'Space', 4000);
    await expect(len(a.page)).toHaveText('Length 10');
    await a.page.clock.runFor(20_000); // straight on into the edge (or a parked snake)
    await expect(a.page.locator('#endText')).toContainText("You're out", { timeout: 5000 });
    await expect(a.page.locator('#endText')).toContainText(/Length \d+/);
    await a.page.getByRole('button', { name: 'Garage' }).click();
    await a.page.reload();
    await expect(a.page.locator('#best')).toHaveText(/Best length (1\d|[2-9]\d)/); // at least 10
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('runs smoothly with 20 snakes (SC-002)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'frame timing is measured in Chromium');
    await page.goto(`${SNAKE}?seed=2`);
    await start(page);
    const fps = await page.evaluate(() => new Promise<number>(done => {
      let frames = 0; const t0 = performance.now();
      const count = (t: number) => { frames++; if (t - t0 < 3000) requestAnimationFrame(count); else done(frames / ((t - t0) / 1000)); };
      requestAnimationFrame(count);
    }));
    expect(fps).toBeGreaterThanOrEqual(50);
  });
});

test.describe('US5: customise your snake', () => {
  test('the preview changes at once; choices survive a reload; 2P tabs; P2 cannot copy P1’s colour', async ({ browser }, info) => {
    const a = await player(browser, info, SNAKE);
    const shot = () => a.page.locator('#preview').evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const before = await shot();
    await a.page.getByLabel('Name').fill('<b>x</b>');
    await a.page.getByLabel('Colour', { exact: true }).fill('#ff3366');
    await a.page.getByLabel('Accent').fill('#111111');
    await a.page.getByRole('button', { name: 'Stripes' }).click();
    await a.page.getByRole('button', { name: 'Angry' }).click();
    expect(await shot()).not.toEqual(before);
    await a.page.reload();
    await expect(a.page.getByLabel('Name')).toHaveValue('<b>x</b>');
    await expect(a.page.getByLabel('Colour', { exact: true })).toHaveValue('#ff3366');
    await expect(a.page.getByRole('button', { name: 'Angry' })).toHaveClass(/on/);
    await a.page.getByRole('button', { name: '2 Players' }).click();
    await a.page.getByRole('button', { name: 'Snake 2' }).click();
    await a.page.getByLabel('Colour', { exact: true }).fill('#ff3366'); // P1's colour
    await expect(a.page.locator('#colorNote')).toContainText('taken');
    await expect(a.page.getByLabel('Colour', { exact: true })).not.toHaveValue('#ff3366');
    expect(a.errors).toEqual([]);
    await a.close();
  });
});

test.describe('US2: two players on one device', () => {
  const twoUp = async (page: Page, matchType: string) => {
    await page.getByRole('button', { name: '2 Players' }).click();
    await page.getByRole('button', { name: matchType }).click();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100)); // frames now come only from runFor: repeatable
    await start(page);
  };

  test('split screen, a 3-2-1 countdown, each player steers; Deathmatch rounds and the match result', async ({ browser }, info) => {
    const a = await player(browser, info, `${SNAKE}?seed=2&bots=0`);
    await a.page.getByLabel('Name').fill('<b>x</b>');
    await twoUp(a.page, 'Deathmatch');
    await a.page.clock.runFor(200);
    await expect(a.page.locator('#msg')).toHaveText('3');
    await expect(len(a.page, 'len2')).toHaveText('P2 · Length 10');
    await expect(a.page.locator('#score')).toHaveText('<b>x</b> 0 – Player 2 0');
    // each round: P1 turns up, moves out of P2's way and circles there; P2 runs on into the far edge → P1 wins it
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 80 && (await a.page.locator('#msg').textContent()) !== 'GO!'; i++) await a.page.clock.runFor(100);
      await a.page.keyboard.down('KeyA');
      await a.page.clock.runFor(450);
      await a.page.keyboard.up('KeyA');
      await a.page.clock.runFor(2000);
      await a.page.keyboard.down('KeyA');
      await a.page.clock.runFor(16_000);
      await a.page.keyboard.up('KeyA');
      if (round < 2) await expect(a.page.locator('#score')).toHaveText(`<b>x</b> ${round + 1} – Player 2 0`);
    }
    await expect(a.page.locator('#endText b')).toHaveText('<b>x</b> wins!'); // the name as text, not markup
    await expect(a.page.locator('#endText')).toContainText('<b>x</b> 3 – Player 2 0');
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('Quick match: a 5:00 timer, a crashed player rejoins after 3 s, and at 0 the longer snake wins', async ({ browser }, info) => {
    const a = await player(browser, info, `${SNAKE}?seed=2&bots=0`);
    await twoUp(a.page, 'Quick match');
    await a.page.clock.runFor(3500); // countdown
    await expect(a.page.locator('#timer')).toHaveText(/^(5:00|4:59)$/);
    await a.page.clock.runFor(6000); // straight at each other: both crash…
    await a.page.clock.runFor(4000); // …and are back
    await expect(a.page.locator('#end')).toBeHidden();
    await expect(len(a.page)).toHaveText(/Length \d+/);
    // to 0: five minutes of frames are slow to run, so only in Chromium (the rule itself is unit tested)
    if (info.project.name === 'chromium') {
      test.setTimeout(240_000);
      await a.page.clock.runFor(300_000);
      await expect(a.page.locator('#endText b')).toHaveText(/wins!$|^It's a draw$/);
    }
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('on a tablet each half has its own stick and boost', async ({ browser }, info) => {
    const a = await player(browser, info, `${SNAKE}?seed=2&bots=0`, { viewport: { width: 1024, height: 700 }, hasTouch: true });
    test.skip(!(await a.page.evaluate(() => navigator.maxTouchPoints > 0)), 'this engine does not emulate touch points');
    await a.page.getByRole('button', { name: '2 Players' }).click();
    await start(a.page);
    await expect(a.page.getByLabel('Steer', { exact: true })).toBeVisible();
    await expect(a.page.getByLabel('Steer player 2')).toBeVisible();
    const [one, two] = await Promise.all([a.page.getByLabel('Steer', { exact: true }).boundingBox(), a.page.getByLabel('Steer player 2').boundingBox()]);
    expect(one!.x + one!.width).toBeLessThan(512);
    expect(two!.x).toBeGreaterThanOrEqual(512);
    await a.close();
  });
});

test.describe('US3: play online, 2 to 8 players', () => {
  const online = (page: Page) => page.getByRole('button', { name: 'Online', exact: true }).click();
  const hostRoom = async (page: Page, size: number) => {
    await online(page);
    await page.getByLabel('Players').selectOption(String(size));
    await page.getByRole('button', { name: 'Host a room' }).click();
    await expect(page.locator('#roomCount')).toHaveText(`1/${size} players`, { timeout: 5000 });
    return { name: (await page.locator('#roomName').textContent())!, code: (await page.locator('#roomCode').textContent())!.trim() };
  };
  const alive = (page: Page) => page.locator('#alive');

  test('the lobby lists only Snake Duel rooms; three players share one arena; leaving, handing over and the last one left', async ({ browser }, info) => {
    test.setTimeout(120_000);
    const tt = await player(browser, info, gameRoute(GameSlug.TurboTumble)); // a Turbo Tumble room meanwhile
    await tt.page.getByRole('button', { name: 'Online', exact: true }).click();
    await tt.page.getByRole('button', { name: 'Host a room' }).click();
    await expect(tt.page.locator('#roomCount')).toHaveText(/1\/\d+ players/, { timeout: 5000 });
    const ttName = (await tt.page.locator('#roomName').textContent())!;
    expect(ttName).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);

    const a = await player(browser, info, SNAKE);
    const room = await hostRoom(a.page, 4);
    await expect(a.page.locator('#countdown')).toHaveText(/Starts in \d+s/);
    await expect(a.page.locator('#roster li')).toHaveCount(1);
    await expect(a.page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await a.page.getByRole('button', { name: 'Quick match' }).click(); // the host's pick

    const b = await player(browser, info, SNAKE), c = await player(browser, info, SNAKE);
    for (const p of [b.page, c.page]) {
      await online(p);
      await expect(p.locator('#roomList')).not.toContainText(ttName, { timeout: 3000 });
      await p.locator('#roomList').getByRole('button', { name: new RegExp(`^${room.name} · `) }).click({ timeout: 5000 });
    }
    for (const p of [a.page, b.page, c.page]) await expect(p.locator('#roomCount')).toHaveText('3/4 players', { timeout: 5000 });
    await expect(b.page.getByRole('button', { name: 'Leave' })).toBeVisible();
    await expect(b.page.getByRole('button', { name: 'Quick match' })).toHaveClass(/on/); // guests see the host's picks, locked
    await expect(b.page.getByRole('button', { name: 'Quick match' })).toBeDisabled();
    await a.page.getByRole('button', { name: 'Deathmatch' }).click();

    await a.page.getByRole('button', { name: 'Start', exact: true }).click();
    for (const p of [a.page, b.page, c.page]) await expect(alive(p)).toHaveText('3 players in', { timeout: 6000 });

    await c.close(); // a player leaves mid-match: taken out, the match goes on
    for (const p of [a.page, b.page]) await expect(alive(p)).toHaveText('2 players in', { timeout: 5000 });

    // the runner (A) hides its tab: B takes over running the arena, and B's own boost now shrinks it
    await a.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await b.page.waitForTimeout(2500); // B has eaten its lead orbs by now
    const before = Number((await b.page.locator('#len').textContent())!.match(/\d+/)![0]);
    test.skip(before <= 10, 'B was taken out before the hand-over could be checked'); // rare: a computer snake got B first
    await b.page.keyboard.down('Space'); await b.page.waitForTimeout(1000); await b.page.keyboard.up('Space');
    expect(Number((await b.page.locator('#len').textContent())!.match(/\d+/)![0])).toBeLessThan(before);

    await a.close(); // only B is left in the room
    await expect(b.page.locator('#endText')).toContainText('Everyone else left', { timeout: 6000 });
    expect([...a.errors, ...b.errors, ...c.errors, ...tt.errors]).toEqual([]);
    await b.close(); await tt.close();
  });

  test('a full room refuses, Cancel closes the room for guests, and an unreachable relay says so', async ({ browser }, info) => {
    const a = await player(browser, info, SNAKE);
    const room = await hostRoom(a.page, 2);
    const b = await player(browser, info, `${SNAKE}?room=${room.code}`);
    await expect(b.page.locator('#roomCount')).toHaveText('2/2 players', { timeout: 15_000 });
    const c = await player(browser, info, `${SNAKE}?room=${room.code}`);
    await expect(c.page.locator('#netInfo')).toHaveText('That room is full', { timeout: 15_000 });
    await a.page.getByRole('button', { name: 'Cancel' }).click();
    await expect(b.page.locator('#netInfo')).toHaveText('The host closed the room', { timeout: 3000 });

    const d = await player(browser, info, SNAKE);
    await d.page.routeWebSocket(/\/relay\//, () => {}); // opens but never answers
    await online(d.page);
    await d.page.getByRole('button', { name: 'Host a room' }).click();
    await d.page.clock.runFor(5500); // past the 5 s join timeout, whatever the machine's speed
    await expect(d.page.locator('#netInfo')).toHaveText("Online play isn't available right now", { timeout: 3000 });
    await d.page.getByRole('button', { name: 'Close' }).click();
    await d.page.getByRole('button', { name: '1 Player' }).click();
    await start(d.page);
    await expect(len(d.page)).toHaveText(/^Length \d+$/); // a solo game runs (it may already have eaten)
    expect([...a.errors, ...b.errors, ...c.errors, ...d.errors]).toEqual([]);
    for (const x of [a, b, c, d]) await x.close();
  });
});
