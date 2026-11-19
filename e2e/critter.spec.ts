// Critter Hop (feature 012), against the production build. `?seed=` fixes the computer players' types and moves
// offline (research R9). Moves are made the ways a player can: the move buttons (what screen readers use; the same
// choices as tapping the board), the keyboard, H + Enter, and real taps on the board.
import { expect, test, type Page } from '@playwright/test';
import { gameRoute } from '../src/shared/routes.ts';
import { GameSlug } from '../src/games/index.ts';
import { NetText } from '../src/shared/online/client.ts';
import { count, host, joined, player } from './helpers.ts';

const HOP = gameRoute(GameSlug.CritterHop);
const pick = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const typeCard = (page: Page, type: string) => page.locator(`#cTypes .type[data-type="${type}"]`);
const start = (page: Page) => page.getByRole('button', { name: 'Start', exact: true }).click();
const turn = (page: Page) => page.locator('#whoseTurn');
const spots = (page: Page) => page.locator('#spots button');
/** The move buttons are for screen readers (not drawn): activate one as a screen reader does. */
const press = (button: ReturnType<typeof spots>) => button.dispatchEvent('click');
const ready = (page: Page) => expect(page.locator('.ch')).toHaveAttribute('data-ready', '1', { timeout: 10_000 });
/** Plays the hinted move once this device can move (the Hint button shows only then). */
async function hinted(page: Page) {
  await expect(page.locator('#hintBtn')).toBeVisible({ timeout: 8000 });
  await page.keyboard.press('KeyH'); await page.keyboard.press('Enter');
}
/** Plays the person's turns with H then Enter until the end screen shows. */
async function playOut(page: Page) {
  const end = page.locator('#end');
  for (let i = 0; i < 400 && !(await end.isVisible()); i++) {
    if (await page.locator('#hintBtn').isVisible()) { await page.keyboard.press('KeyH'); await page.keyboard.press('Enter'); }
    else await page.waitForTimeout(50);
  }
  await expect(end).toBeVisible();
}

test.describe('US1: pick a type and play against the computer', () => {
  test('setup: six types with their match-ups; taken ones disabled; the board for each player count', async ({ browser }, info) => {
    const a = await player(browser, info, `${HOP}?seed=1`);
    await expect(a.page.getByRole('heading', { name: 'Critter Hop' })).toBeVisible();
    await expect(a.page.locator('#cTypes .type')).toHaveCount(6);
    await expect(typeCard(a.page, 'Water')).toContainText('Strong vs Fire · Weak vs Psychic');
    await typeCard(a.page, 'Water').click();
    await expect(typeCard(a.page, 'Water')).toHaveAttribute('aria-pressed', 'true');
    for (const [n, board] of [['2', 'star'], ['4', 'cross'], ['6', 'star']] as const) {
      await pick(a.page, n);
      await start(a.page);
      await ready(a.page);
      await expect(a.page.locator('.ch')).toHaveAttribute('data-board', board);
      await expect(a.page.locator('#seatList li')).toHaveCount(Number(n));
      await expect(a.page.locator('#seatList')).toContainText('Water (you)');
      await a.page.getByRole('button', { name: 'Menu' }).click();
    }
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('select shows the reachable holes; again clears; a move passes the turn and the computer replies', async ({ browser }, info) => {
    const a = await player(browser, info, `${HOP}?seed=1`);
    await start(a.page);
    await ready(a.page);
    await expect(turn(a.page)).toHaveText('Your turn');
    await expect(spots(a.page).first()).toContainText('Fire creature');
    const creature = await spots(a.page).first().getAttribute('data-hole');
    await press(spots(a.page).first());
    await expect(spots(a.page).filter({ hasText: /^(Step|Hop|Long hop) to/ }).first()).toBeAttached();
    await press(a.page.locator(`#spots button[data-hole="${creature}"]`)); // the same creature again: cleared
    await expect(spots(a.page).filter({ hasText: /^(Step|Hop) to/ })).toHaveCount(0);
    await press(spots(a.page).first());
    await press(spots(a.page).filter({ hasText: /^(Step|Hop) to/ }).first());
    await expect(turn(a.page)).toHaveText(/\(computer\)'s turn/);
    await expect(turn(a.page)).toHaveText('Your turn', { timeout: 5000 });
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('tapping an empty spot of the board does nothing and keeps the turn', async ({ browser }, info) => {
    const a = await player(browser, info, `${HOP}?seed=1`);
    await start(a.page);
    await ready(a.page);
    await a.page.mouse.click(5, 400); // off the board
    await expect(turn(a.page)).toHaveText('Your turn');
    await expect(spots(a.page).first()).toContainText('Fire creature');
    await a.close();
  });

  test('keyboard only: arrows move the cursor, Enter selects and moves, Escape cancels, Q/E/+/− turn and zoom', async ({ browser }, info) => {
    const a = await player(browser, info, `${HOP}?seed=1`);
    await start(a.page);
    await ready(a.page);
    for (const k of ['KeyQ', 'KeyE', 'Equal', 'Minus']) await a.page.keyboard.press(k);
    await a.page.keyboard.press('ArrowRight');
    await expect(a.page.locator('#status')).toContainText('Fire creature');
    await a.page.keyboard.press('Enter');
    await expect(spots(a.page).filter({ hasText: /^(Step|Hop) to/ }).first()).toBeAttached();
    await a.page.keyboard.press('Escape');
    await expect(spots(a.page).filter({ hasText: /^(Step|Hop) to/ })).toHaveCount(0);
    await a.page.keyboard.press('ArrowUp');
    await a.page.keyboard.press('Enter');
    await a.page.keyboard.press('ArrowUp');
    await expect(a.page.locator('#status')).toContainText(/^(Step|Hop|Long hop) to/);
    await a.page.keyboard.press('Enter');
    await expect(turn(a.page)).toHaveText(/\(computer\)'s turn/);
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('touch: tap a creature on the board to select it', async ({ browser }, info) => {
    const a = await player(browser, info, `${HOP}?seed=1`, { hasTouch: true });
    await start(a.page);
    await ready(a.page);
    await a.page.waitForTimeout(800); // the camera has turned to face us
    const b = spots(a.page).first(), x = Number(await b.getAttribute('data-x')), y = Number(await b.getAttribute('data-y'));
    await a.page.touchscreen.tap(x, y);
    await expect(spots(a.page).filter({ hasText: /^(Step|Hop) to/ }).first()).toBeAttached();
    expect(await a.page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth)).toBe(true);
    await a.close();
  });

  test('a whole game to the end screen (H then Enter, fast hops): order, Play again, Menu', async ({ browser }, info) => {
    test.setTimeout(240_000);
    const a = await player(browser, info, `${HOP}?seed=1`);
    await pick(a.page, 'Fast');
    await start(a.page);
    await ready(a.page);
    await playOut(a.page);
    await expect(a.page.locator('#endText b')).toHaveText(/You win!|You finished 2nd/);
    await expect(a.page.locator('#endText li')).toHaveCount(2);
    await expect(a.page.getByRole('button', { name: 'Play again' })).toBeVisible();
    await a.page.locator('#endText').getByRole('button', { name: 'Menu' }).click();
    await expect(a.page.getByRole('heading', { name: 'Critter Hop' })).toBeVisible();
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('fits a phone without sideways scrolling', async ({ browser }, info) => {
    const a = await player(browser, info, `${HOP}?seed=1`, { viewport: { width: 375, height: 667 } });
    expect(await a.page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth)).toBe(true);
    await start(a.page);
    await ready(a.page);
    expect(await a.page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth)).toBe(true);
    await a.close();
  });
});

test.describe('US2: 2, 4 or 6 on one device', () => {
  test('each person picks a different type; seats are Person or Computer; turns go round; End game ranks', async ({ browser }, info) => {
    const a = await player(browser, info, `${HOP}?seed=2`);
    await pick(a.page, '2 Players');
    await pick(a.page, '4');
    await expect(a.page.locator('#cSeats li')).toHaveCount(4);
    await expect(a.page.getByRole('button', { name: 'Seat 1 kind: Person' })).toBeDisabled(); // always a person
    await a.page.getByRole('button', { name: /^Seat 2: / }).click();
    await typeCard(a.page, 'Grass').click();
    await a.page.getByRole('button', { name: /^Seat 1: / }).click();
    await expect(typeCard(a.page, 'Grass')).toBeDisabled();
    await typeCard(a.page, 'Water').click();
    await start(a.page);
    await ready(a.page);
    await expect(a.page.locator('.ch')).toHaveAttribute('data-board', 'cross');
    await expect(turn(a.page)).toHaveText("Water (Player 1)'s turn");
    await hinted(a.page);
    await expect(turn(a.page)).toHaveText("Grass (Player 2)'s turn", { timeout: 5000 });
    await hinted(a.page);
    await expect(turn(a.page)).toHaveText("Water (Player 1)'s turn", { timeout: 8000 }); // two computers in between
    await a.page.getByRole('button', { name: 'End game' }).click();
    await expect(a.page.locator('#endText')).toContainText('Game ended');
    await expect(a.page.locator('#endText li')).toHaveCount(4);
    expect(a.errors).toEqual([]);
    await a.close();
  });
});

test.describe('US3: online', () => {
  test('host and guest: unique types, the same board, moves on both screens, a dropped player becomes a computer', async ({ browser }, info) => {
    const a = await player(browser, info, HOP);
    await pick(a.page, 'Online');
    const code = await host(a.page, 4);
    await typeCard(a.page, 'Water').click();
    const b = await player(browser, info, `${HOP}?room=${code}`);
    await joined(b.page, '2/4 players');
    await expect(typeCard(b.page, 'Water')).toBeDisabled({ timeout: 3000 });
    await typeCard(b.page, 'Grass').click();
    await expect(typeCard(a.page, 'Grass')).toBeDisabled({ timeout: 3000 });
    await expect(b.page.getByRole('button', { name: 'Waiting for host…' })).toBeDisabled();
    // another room in the same game sees nothing of this one
    const c = await player(browser, info, HOP);
    await pick(c.page, 'Online');
    await host(c.page, 2);
    await start(a.page);
    for (const p of [a.page, b.page]) {
      await ready(p);
      await expect(p.locator('.ch')).toHaveAttribute('data-board', 'cross');
      await expect(p.locator('#seatList')).toContainText('Water');
      await expect(p.locator('#seatList')).toContainText('Grass');
      await expect(p.locator('#seatList li', { hasText: '(computer)' })).toHaveCount(2);
    }
    await expect(turn(a.page)).toHaveText('Your turn');
    await expect(b.page.locator('#hintBtn')).toBeHidden(); // not B's turn: no moving
    await hinted(a.page);
    await expect(turn(b.page)).toHaveText('Your turn', { timeout: 3000 });
    await expect(c.page.getByRole('heading', { name: 'Critter Hop' })).toBeVisible();
    await expect(count(c.page)).toHaveText('1/2 players');
    await b.close();
    await expect(a.page.locator('#msg')).toContainText('left: a computer takes over', { timeout: 5000 });
    await expect(turn(a.page)).toHaveText('Your turn', { timeout: 8000 }); // the computer played B's seat
    expect([...a.errors, ...c.errors]).toEqual([]);
    await a.close(); await c.close();
  });

  test('relay unreachable: a plain message, and 1 Player still works', async ({ page }) => {
    await page.routeWebSocket(/\/relay\//, () => {});
    await page.goto(HOP);
    await pick(page, 'Online');
    await page.getByRole('button', { name: 'Host a room' }).click();
    await expect(page.locator('#netInfo')).toHaveText(NetText.Unavailable, { timeout: 6000 });
    await page.getByRole('button', { name: 'Close' }).click();
    await start(page);
    await ready(page);
    await expect(turn(page)).toHaveText('Your turn');
  });
});

test.describe('US4: turn timer and hints', () => {
  test('Hint shows a move without playing it; Enter plays it', async ({ browser }, info) => {
    const a = await player(browser, info, `${HOP}?seed=1`);
    await start(a.page);
    await ready(a.page);
    await a.page.getByRole('button', { name: 'Hint' }).click();
    await expect(a.page.locator('#status')).toContainText('Hint shown');
    await expect(turn(a.page)).toHaveText('Your turn');
    await a.page.keyboard.press('Enter');
    await expect(turn(a.page)).toHaveText(/\(computer\)'s turn/);
    await a.close();
  });

  test('the local turn timer is off unless chosen; when it runs out a move is played', async ({ browser }, info) => {
    const a = await player(browser, info, `${HOP}?seed=1`);
    await expect(a.page.locator('#cTimer')).not.toBeChecked();
    await a.page.locator('#cTimer').check();
    await start(a.page);
    await ready(a.page);
    await expect(a.page.locator('#timer')).toHaveText(/^(60|59|58)$/);
    await a.page.clock.fastForward(61_000);
    await expect(turn(a.page)).not.toHaveText('Your turn', { timeout: 3000 });
    await a.close();
  });
});
