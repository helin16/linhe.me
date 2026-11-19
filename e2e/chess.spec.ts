// Critter Chess (feature 013), against the production build. Moves are made the ways a player can: the move buttons
// (what screen readers use; the same choices as tapping the board), the keyboard, H + Enter, and real taps. On the 8 × 8
// board cells are named a1…h8. `?seed=` fixes the computer players offline.
import { expect, test, type Page } from '@playwright/test';
import { gameRoute } from '../src/shared/routes.ts';
import { GameSlug } from '../src/games/index.ts';
import { NetText } from '../src/shared/online/client.ts';
import { count, host, joined, player } from './helpers.ts';

const CHESS = gameRoute(GameSlug.CritterChess);
const pick = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const typeCard = (page: Page, type: string) => page.locator(`#cTypes .type[data-type="${type}"]`);
const start = (page: Page) => page.getByRole('button', { name: 'Start', exact: true }).click();
const turn = (page: Page) => page.locator('#whoseTurn');
const spots = (page: Page) => page.locator('#spots button');
const ready = (page: Page) => expect(page.locator('.cc')).toHaveAttribute('data-ready', '1', { timeout: 10_000 });
/** The move buttons are for screen readers (not drawn): activate one as a screen reader does. */
const press = (page: Page, text: RegExp) => spots(page).filter({ hasText: text }).first().dispatchEvent('click');
/** One move by whoever's turn it is on this device, e.g. "e2e4" (the piece's button, then the destination's). */
async function move(page: Page, mv: string) {
  await expect(spots(page).filter({ hasText: new RegExp(` on ${mv.slice(0, 2)}$`) })).toHaveCount(1, { timeout: 8000 });
  await press(page, new RegExp(` on ${mv.slice(0, 2)}$`));
  await press(page, new RegExp(` to ${mv.slice(2, 4)}$`));
}
async function hinted(page: Page) {
  await expect(page.locator('#hintBtn')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('KeyH'); await page.keyboard.press('Enter');
}
async function twoPeople(page: Page) {
  await pick(page, '2 Players'); await pick(page, '2');
  await start(page); await ready(page);
}

test.describe('US1: play chess against the computer', () => {
  test('setup: six types; the board for each player count', async ({ browser }, info) => {
    const a = await player(browser, info, `${CHESS}?seed=1`);
    await expect(a.page.getByRole('heading', { name: 'Critter Chess' })).toBeVisible();
    await expect(a.page.locator('#cTypes .type')).toHaveCount(6);
    await expect(typeCard(a.page, 'Water')).toContainText('King, Queen, Rook, Bishop, Knight and Pawns');
    await typeCard(a.page, 'Water').click();
    await expect(typeCard(a.page, 'Water')).toHaveAttribute('aria-pressed', 'true');
    for (const [n, board] of [['2', 'square-board'], ['4', 'cross-board'], ['6', 'hexagon']] as const) {
      await pick(a.page, n);
      await start(a.page);
      await ready(a.page);
      await expect(a.page.locator('.cc')).toHaveAttribute('data-board', board);
      await expect(a.page.locator('#seatList li')).toHaveCount(Number(n));
      await expect(a.page.locator('#seatList')).toContainText('Water (you)');
      await a.page.locator('#menuBtn').click();
    }
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('select a pawn: its two squares light up; again clears; a move passes the turn and the computer replies', async ({ browser }, info) => {
    const a = await player(browser, info, `${CHESS}?seed=1`);
    await start(a.page); await ready(a.page);
    await expect(turn(a.page)).toHaveText('Your turn');
    await press(a.page, / on e2$/);
    await expect(spots(a.page).filter({ hasText: /^Move to e[34]$/ })).toHaveCount(2);
    await press(a.page, / on e2$/);
    await expect(spots(a.page).filter({ hasText: /^Move to/ })).toHaveCount(0);
    await move(a.page, 'e2e4');
    await expect(turn(a.page)).toHaveText(/\(computer\)'s turn/);
    await expect(turn(a.page)).toHaveText('Your turn', { timeout: 6000 });
    await expect(a.page.locator('#moveList li')).toHaveCount(2);
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('check is shown and only moves out of check are offered', async ({ browser }, info) => {
    const a = await player(browser, info, CHESS);
    await twoPeople(a.page);
    for (const mv of ['e2e4', 'f7f6', 'd1h5']) await move(a.page, mv);
    await expect(a.page.locator('#checkInfo')).toContainText('Check!');
    await expect(spots(a.page).filter({ hasText: / on / })).toHaveText([/Pawn on g7$/]); // only g6 blocks: the queen also covers f7
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test("checkmate ends a 2-player game (Fool's mate); Play again and Menu", async ({ browser }, info) => {
    const a = await player(browser, info, CHESS);
    await twoPeople(a.page);
    for (const mv of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) await move(a.page, mv);
    await expect(a.page.locator('#end')).toBeVisible({ timeout: 6000 });
    await expect(a.page.locator('#endText b')).toHaveText(/wins!/);
    await expect(a.page.locator('#endText')).toContainText('Checkmate');
    await expect(a.page.locator('#endText li')).toHaveCount(2);
    await expect(a.page.locator('#endText').getByRole('button', { name: 'Play again' })).toBeVisible();
    await a.page.locator('#endText').getByRole('button', { name: 'Menu' }).click();
    await expect(a.page.getByRole('heading', { name: 'Critter Chess' })).toBeVisible();
    await a.close();
  });

  test('a pawn reaching the last rank: the player picks what it becomes', async ({ browser }, info) => {
    const a = await player(browser, info, CHESS);
    await twoPeople(a.page);
    for (const mv of ['e2e4', 'd7d5', 'e4d5', 'c7c6', 'd5c6', 'g8f6', 'c6b7', 'h7h6']) await move(a.page, mv);
    await move(a.page, 'b7a8');
    await expect(a.page.locator('#promo button')).toHaveText(['Queen', 'Rook', 'Bishop', 'Knight', 'Cancel']);
    await a.page.keyboard.press('Escape'); // backing out: nothing moves, the picker can be opened again
    await expect(a.page.locator('#promo')).toBeHidden();
    await expect(a.page.locator('#moveList li')).toHaveCount(8);
    await press(a.page, / to a8$/);
    await expect(a.page.locator('#promo')).toBeVisible();
    await a.page.locator('#promo').getByRole('button', { name: 'Knight' }).click();
    await expect(a.page.locator('#moveList li').first()).toContainText('becomes a Knight');
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('Resign: out at once, the other player wins', async ({ browser }, info) => {
    const a = await player(browser, info, `${CHESS}?seed=1`);
    await start(a.page); await ready(a.page);
    await a.page.getByRole('button', { name: 'Resign' }).click();
    await expect(a.page.locator('#endText b')).toHaveText('You finished 2nd');
    await a.close();
  });

  test('keyboard only: arrows, Enter, Escape, Q/E and +/−', async ({ browser }, info) => {
    const a = await player(browser, info, `${CHESS}?seed=1`);
    await start(a.page); await ready(a.page);
    for (const k of ['KeyQ', 'KeyE', 'Equal', 'Minus']) await a.page.keyboard.press(k);
    await a.page.keyboard.press('ArrowRight');
    await expect(a.page.locator('#status')).toContainText(/Fire \w+ on [a-h][12]/);
    await a.page.keyboard.press('Escape');
    await a.page.keyboard.press('ArrowUp');
    // walk the cursor until it is on a piece that can move, then pick its first destination
    for (let i = 0; i < 16 && !/[1-9] moves/.test(await a.page.locator('#status').textContent() ?? ''); i++) await a.page.keyboard.press('ArrowRight');
    await a.page.keyboard.press('Enter');
    await a.page.keyboard.press('ArrowUp');
    await expect(a.page.locator('#status')).toContainText(/^(Move|Take|Castle)/);
    await a.page.keyboard.press('Enter');
    await expect(turn(a.page)).toHaveText(/\(computer\)'s turn/);
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('touch: tap a piece on the board to select it; fits a phone', async ({ browser }, info) => {
    const a = await player(browser, info, `${CHESS}?seed=1`, { hasTouch: true, viewport: { width: 390, height: 844 } });
    await start(a.page); await ready(a.page);
    await a.page.waitForTimeout(800); // the camera has turned to face us
    const b = spots(a.page).filter({ hasText: / on e2$/ });
    await a.page.touchscreen.tap(Number(await b.getAttribute('data-x')), Number(await b.getAttribute('data-y')));
    await expect(spots(a.page).filter({ hasText: /^Move to/ }).first()).toBeAttached();
    expect(await a.page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth)).toBe(true);
    await a.close();
  });

  test('a whole game to the end screen with H and Enter at fast pace', async ({ browser }, info) => {
    test.setTimeout(300_000);
    const a = await player(browser, info, `${CHESS}?seed=2`);
    await pick(a.page, 'Easy'); await pick(a.page, 'Fast pace');
    await start(a.page); await ready(a.page);
    const end = a.page.locator('#end');
    for (let i = 0; i < 600 && !(await end.isVisible()); i++) {
      if (await a.page.locator('#hintBtn').isVisible()) { await a.page.keyboard.press('KeyH'); await a.page.keyboard.press('Enter'); }
      else await a.page.waitForTimeout(40);
    }
    await expect(end).toBeVisible();
    await expect(a.page.locator('#endText li')).toHaveCount(2);
    expect(a.errors).toEqual([]);
    await a.close();
  });
});

test.describe('US2: 2, 4 or 6 on one device', () => {
  test('seats are Person or Computer, each person a different type; turns go round; a resigned player is out', async ({ browser }, info) => {
    const a = await player(browser, info, `${CHESS}?seed=3`);
    await pick(a.page, '2 Players'); await pick(a.page, '4');
    await expect(a.page.locator('#cSeats li')).toHaveCount(4);
    await expect(a.page.getByRole('button', { name: 'Seat 1 kind: Person' })).toBeDisabled();
    await a.page.getByRole('button', { name: /^Seat 2: / }).click();
    await typeCard(a.page, 'Grass').click();
    await a.page.getByRole('button', { name: /^Seat 1: / }).click();
    await expect(typeCard(a.page, 'Grass')).toBeDisabled();
    await typeCard(a.page, 'Water').click();
    await start(a.page); await ready(a.page);
    await expect(a.page.locator('.cc')).toHaveAttribute('data-board', 'cross-board');
    await expect(turn(a.page)).toHaveText("Water (Player 1)'s turn");
    await hinted(a.page);
    await expect(turn(a.page)).toHaveText("Grass (Player 2)'s turn", { timeout: 6000 });
    await a.page.getByRole('button', { name: 'Resign' }).click();
    await expect(a.page.locator('#seatList li.gone')).toHaveCount(1);
    await expect(turn(a.page)).toHaveText("Water (Player 1)'s turn", { timeout: 10_000 }); // two computers in between
    expect(a.errors).toEqual([]);
    await a.close();
  });
});

test.describe('US3: online', () => {
  test('unique types, the same board, moves on both screens, the move clock, a dropped player becomes a computer', async ({ browser }, info) => {
    const a = await player(browser, info, CHESS);
    await pick(a.page, 'Online');
    const code = await host(a.page, 4);
    await typeCard(a.page, 'Fire').click();
    const b = await player(browser, info, `${CHESS}?room=${code}`);
    await joined(b.page, '2/4 players');
    await expect(typeCard(b.page, 'Fire')).toBeDisabled({ timeout: 3000 });
    await typeCard(b.page, 'Rock').click();
    await expect(typeCard(a.page, 'Rock')).toBeDisabled({ timeout: 3000 });
    const c = await player(browser, info, CHESS); // another room of the same game sees nothing of this one
    await pick(c.page, 'Online');
    await host(c.page, 2);
    await start(a.page);
    for (const p of [a.page, b.page]) {
      await ready(p);
      await expect(p.locator('.cc')).toHaveAttribute('data-board', 'cross-board');
      await expect(p.locator('#seatList li', { hasText: '(computer)' })).toHaveCount(2);
    }
    await expect(turn(a.page)).toHaveText('Your turn');
    await expect(b.page.locator('#hintBtn')).toBeHidden();
    await hinted(a.page);
    await expect(turn(b.page)).toHaveText('Your turn', { timeout: 4000 });
    await expect(b.page.locator('#moveList li')).toHaveCount(1);
    // B thinks too long: the runner (A) plays a move for B after 60 s (wait for A's clock on B's turn to be running)
    await expect(a.page.locator('#timer')).toHaveText(/^(60|59|58)$/);
    await a.page.clock.fastForward(61_000);
    await expect(b.page.locator('#moveList li')).toHaveCount(2, { timeout: 5000 });
    await expect(count(c.page)).toHaveText('1/2 players');
    await b.close();
    await expect(a.page.locator('#msg')).toContainText('left: a computer takes over', { timeout: 5000 });
    expect([...a.errors, ...c.errors]).toEqual([]);
    await a.close(); await c.close();
  });

  test('relay unreachable: a plain message, and 1 Player still works', async ({ page }) => {
    await page.routeWebSocket(/\/relay\//, () => {});
    await page.goto(CHESS);
    await pick(page, 'Online');
    await page.getByRole('button', { name: 'Host a room' }).click();
    await expect(page.locator('#netInfo')).toHaveText(NetText.Unavailable, { timeout: 6000 });
    await page.getByRole('button', { name: 'Close' }).click();
    await start(page); await ready(page);
    await expect(turn(page)).toHaveText('Your turn');
  });
});

test.describe('US4: hints and the move list', () => {
  test('Hint shows a move without playing it; Enter plays it; the move list grows', async ({ browser }, info) => {
    const a = await player(browser, info, `${CHESS}?seed=1`);
    await start(a.page); await ready(a.page);
    await a.page.getByRole('button', { name: 'Hint' }).click();
    await expect(a.page.locator('#status')).toContainText('Hint shown');
    await expect(turn(a.page)).toHaveText('Your turn');
    await expect(a.page.locator('#moveList li')).toHaveCount(0);
    await a.page.keyboard.press('Enter');
    await expect(a.page.locator('#moveList li').first()).toContainText(/^Fire /);
    await a.close();
  });
});
