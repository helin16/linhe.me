// Turbo Tumble's 3D look and speed (specs/010-turbo-3d-look): what each acceptance scenario shows, read from the test
// aids the game writes on its root under automated browsers (contracts/ui.md) and from page screenshots.
import { expect, test, type Page } from '@playwright/test';
import { GAME, garage, host, joined, player, race } from './helpers.ts';
import { decodePng, look, type Image } from './pixels.ts';

// SC-005: today's times (T000, before the new look), median of 5 in local Chromium; the new look may add at most 1 s
const OPEN_MS = 899, START_MS = 116;
const TRACKS = ['Meadow', 'Desert', 'Snow', 'Neon'];
const EFFECTS: Record<string, string> = { Meadow: 'birds', Desert: 'dust', Snow: 'snowfall', Neon: 'pulse' };

const root = (page: Page) => page.locator('.tt');
const data = (page: Page, name: string) => root(page).getAttribute(`data-${name}`);
const num = async (page: Page, name: string) => Number(await data(page, name));
const point = async (page: Page, name: string, n = 0) => (await data(page, name))!.split(';')[n].split(',').map(Number) as [number, number];
const lum = ([r, g, b]: [number, number, number]) => 0.3 * r + 0.59 * g + 0.11 * b;
const pick = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
type Hooks = Window & { __ttLowDetail?: () => void; __ttHoldDetail?: () => void };
const lowDetail = (page: Page) => page.evaluate(() => (window as Hooks).__ttLowDetail!());
/** Keeps full detail (the test browsers draw in software: the frame-rate check would drop it mid-test). */
const holdDetail = async (page: Page) => {
  await expect(page.getByRole('button', { name: 'Start race' })).toBeVisible(); // the game has loaded
  await page.evaluate(() => (window as Hooks).__ttHoldDetail!());
};
const fps = (page: Page) => page.evaluate(() => new Promise<number>(done => {
  let frames = 0; const t0 = performance.now();
  const count = (t: number) => { frames++; if (t - t0 < 3000) requestAnimationFrame(count); else done(frames / ((t - t0) / 1000)); };
  requestAnimationFrame(count);
}));
/** How much brightness varies around (x, y), less the smooth change across the area (light, fog): texture shows as
 *  detail, a flat colour as almost none. */
function detail(img: Image, x: number, y: number, r = 20) {
  const ls: number[] = [];
  for (let yy = y - r; yy < y + r; yy++) for (let xx = x - r; xx < x + r; xx++) ls.push(lum(img.at(xx, yy)) - lum(img.at(xx + 6, yy + 6)) / 2 - lum(img.at(xx - 6, yy - 6)) / 2);
  const mean = ls.reduce((a, b) => a + b, 0) / ls.length;
  return Math.sqrt(ls.reduce((a, b) => a + (b - mean) ** 2, 0) / ls.length);
}
/** Starts a race on `track` and waits for the countdown (karts on the grid, full detail until the race measures). */
async function grid(page: Page, track: string) {
  await pick(page, track);
  await race(page);
  await expect(page.locator('#msg')).toHaveText(/^[123]$/);
}
// the race starts after the countdown (slow software-rendered frames stretch it: the game caps each frame's step)
const go = (page: Page) => expect(page.locator('#msg')).toHaveText('GO!', { timeout: 15_000 });

test.describe('010 US1: karts look like solid toys with drivers', () => {
  test('each kart type, colour, helmet and skin looks different', async ({ browser }, info) => {
    const a = await player(browser, info), p = a.page;
    // on the grid, during the countdown, the camera stands still behind the kart: shots of the same kart match
    const shot = async () => {
      await race(p); await expect(p.locator('#msg')).toHaveText(/^[123]$/); await p.waitForTimeout(200);
      const [kx, ky] = await point(p, 'kart');
      const img = decodePng(await p.screenshot({ scale: 'css', clip: { x: kx - 100, y: ky - 100, width: 200, height: 160 } }));
      await garage(p); return img;
    };
    const differ = (x: Image, y: Image) => { let n = 0; for (let j = 0; j < x.h; j += 2) for (let i = 0; i < x.w; i += 2) if (Math.abs(lum(x.at(i, j)) - lum(y.at(i, j))) > 30) n++; return n; };
    const first = await shot(), same = differ(first, await shot());
    expect(same, 'the same kart twice').toBeLessThan(40);
    let last = first;
    for (const [what, act, min] of [
      ['Buggy', () => pick(p, 'Buggy'), 150], ['Rocket', () => pick(p, 'Rocket'), 150], ['Classic', () => pick(p, 'Classic'), 150],
      ['kart colour', () => p.getByLabel('Kart colour').fill('#2255ff'), 150], ['helmet', () => p.getByLabel('Helmet').fill('#ff00aa'), 40],
      ['skin', () => p.getByRole('button', { name: 'Skin tone #5c3a1e' }).click(), 4],
    ] as const) {
      await act(); const now = await shot();
      expect(differ(last, now), what).toBeGreaterThan(same + min);
      last = now;
    }
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('wheels turn, the driver steers both ways, drifts puff and the spark shows the charge', async ({ browser }, info) => {
    const a = await player(browser, info), p = a.page;
    await holdDetail(p);
    await grid(p, 'Meadow'); await go(p);
    await p.keyboard.down('ArrowUp');
    // past 15 m/s (drifting needs it) yet still on the start straight: a little over a wheel turn
    await expect.poll(() => num(p, 'wheels'), { timeout: 5000, intervals: [30] }).toBeGreaterThanOrEqual(2);
    expect(await num(p, 'puffs')).toBe(0); // no drift yet
    await p.keyboard.down('ArrowRight');
    // every frame of the drift, in the page: the spark's colour goes from white towards blue as the charge grows
    const sparks = p.evaluate(() => new Promise<string[]>(done => {
      const seen = new Set<string>(), t0 = performance.now(), root = document.querySelector<HTMLElement>('.tt')!;
      const look = () => { if (root.dataset.spark) seen.add(root.dataset.spark); if (performance.now() - t0 < 2500) requestAnimationFrame(look); else done([...seen]); };
      look();
    }));
    await p.keyboard.down('Space'); // drift to the right
    await expect.poll(() => num(p, 'puffs'), { timeout: 3000 }).toBeGreaterThan(0);
    expect((await sparks).length, 'spark colours').toBeGreaterThan(1);
    await p.keyboard.up('Space');
    await expect.poll(() => num(p, 'steer')).toBeLessThan(-0.5); // right
    await p.keyboard.up('ArrowRight'); await p.keyboard.down('ArrowLeft');
    await expect.poll(() => num(p, 'steer')).toBeGreaterThan(0.5); // left
    await p.keyboard.up('ArrowLeft');
    await lowDetail(p);
    await p.keyboard.down('ArrowLeft'); await p.keyboard.down('Space');
    await p.waitForTimeout(800);
    expect(await num(p, 'puffs')).toBe(0); // none in low detail
    await p.keyboard.up('Space'); await p.keyboard.up('ArrowLeft'); await p.keyboard.up('ArrowUp');
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('online: a kart steering on another screen steers here too', async ({ browser }, info) => {
    const a = await player(browser, info), code = await host(a.page);
    const b = await player(browser, info, `${GAME}?room=${code}`);
    await joined(b.page, '2/4 players');
    await a.page.getByRole('button', { name: 'Start race' }).click();
    await go(b.page);
    await b.page.keyboard.down('ArrowUp'); await b.page.waitForTimeout(1500); await b.page.keyboard.down('ArrowLeft');
    await expect.poll(() => num(a.page, 'steer-remote'), { timeout: 5000 }).toBeGreaterThan(0.2);
    await b.page.keyboard.up('ArrowLeft'); await b.page.keyboard.down('ArrowRight');
    await expect.poll(() => num(a.page, 'steer-remote'), { timeout: 5000 }).toBeLessThan(-0.2);
    await b.page.keyboard.up('ArrowRight'); await b.page.keyboard.up('ArrowUp');
    expect([...a.errors, ...b.errors]).toEqual([]);
    await b.close(); await a.close();
  });
});

test.describe('010 US2: tracks look detailed', () => {
  for (const track of TRACKS) test(`${track}: textured road and ground, a shadow under the kart, rounded kerbs, start-line props`, async ({ browser }, info) => {
    const a = await player(browser, info), p = a.page;
    await grid(p, track);
    await expect(root(p)).toHaveAttribute('data-kerbs', 'rounded');
    await expect(root(p)).toHaveAttribute('data-props', '3');
    const img = await look(p), [sx, sy] = await point(p, 'shadow'), [gx, gy] = await point(p, 'ground');
    const [kx, ky] = await point(p, 'kart');
    expect(detail(img, kx - 150, ky + 130), 'road').toBeGreaterThan(2); // behind and left of the player's kart, on the road
    expect(detail(img, gx, gy, 12), 'ground').toBeGreaterThan(2);
    const shade = lum(img.at(sx, sy)), open = lum(img.at(sx - 60, sy));
    expect(open - shade, `shadow at ${sx},${sy}`).toBeGreaterThan(track === 'Neon' ? 4 : 12);
    if (track === 'Neon') { // a dark sky between the towers along the top of the screen
      const xs = Array.from({ length: 64 }, (_, i) => Math.floor(i * img.w / 64)), dark = xs.filter(x => lum(img.at(x, 4)) < 45).length;
      expect(dark / xs.length, 'night sky').toBeGreaterThan(0.3);
    }
    await lowDetail(p);
    await expect(root(p)).toHaveAttribute('data-props', '0');
    expect(a.errors).toEqual([]);
    await a.close();
  });
});

test.describe('010 US4: smooth edges and steady speed', () => {
  test('edges are smoothed on graphics chips, not on software renderers', async ({ browser }, info) => {
    const a = await player(browser, info);
    const software = await a.page.evaluate(() => { // what this browser's WebGL says it draws with
      const gl = document.createElement('canvas').getContext('webgl'), info = gl?.getExtension('WEBGL_debug_renderer_info');
      return !gl || /swiftshader|llvmpipe|softpipe|software|basic render/i.test(info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '');
    });
    await expect(root(a.page)).toHaveAttribute('data-antialias', software ? 'off' : 'on');
    await a.close();
  });

  for (const [name, setup] of [
    ['a race', async (p: Page) => race(p)],
    ['split screen', async (p: Page) => { await pick(p, '2 Players'); await race(p); }],
    ['an eight-kart online room', async (p: Page) => { await host(p, 8); await race(p); }],
  ] as const) test(`${name} runs smoothly once the detail settles (SC-001)`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'frame timing is measured in Chromium');
    await page.goto(GAME);
    await setup(page);
    await expect(root(page)).toHaveAttribute('data-detail', 'probing', { timeout: 6000 });
    await expect(root(page)).toHaveAttribute('data-detail', /^(full|low)$/, { timeout: 15_000 }); // lowering detail is allowed (FR-009)
    await page.waitForTimeout(1000); // settled at the new detail
    expect(await fps(page)).toBeGreaterThanOrEqual(50);
  });

  test('low detail in split screen: both halves lose their shadows and the props go', async ({ browser }, info) => {
    const a = await player(browser, info), p = a.page;
    await pick(p, '2 Players');
    await holdDetail(p);
    await grid(p, 'Meadow');
    const shaded = async () => { const img = await look(p); return Promise.all([0, 1].map(async n => { const [x, y] = await point(p, 'shadow', n); return lum(img.at(x - 60, y)) - lum(img.at(x, y)); })); };
    for (const d of await shaded()) expect(d).toBeGreaterThan(12);
    await lowDetail(p);
    await expect(root(p)).toHaveAttribute('data-detail', 'low');
    await expect(root(p)).toHaveAttribute('data-props', '0');
    await p.waitForTimeout(300);
    for (const d of await shaded()) expect(d).toBeLessThan(8);
    expect(a.errors).toEqual([]);
    await a.close();
  });
});

test.describe('010 US3: the scenery has depth', () => {
  for (const track of TRACKS) test(`${track}: layered scenery, paler farther, its moving effect behind the karts and items`, async ({ browser }, info) => {
    const a = await player(browser, info), p = a.page;
    await holdDetail(p);
    await grid(p, track);
    const layers = (await data(p, 'layers'))!.split(';').map(l => l.split(':').map(Number));
    expect(layers.length).toBeGreaterThanOrEqual(2);
    layers.forEach(([dist, haze], i) => { if (i) { expect(dist).toBeGreaterThan(layers[i - 1][0]); expect(haze).toBeGreaterThan(layers[i - 1][1]); } });
    await expect(root(p)).toHaveAttribute('data-effect', EFFECTS[track]);
    // the effect never shows over a kart: the player's red kart body stays red, frame after frame
    const [kx, ky] = await point(p, 'kart');
    for (let i = 0; i < 8; i++) {
      const [r, g, b] = (await look(p)).at(kx, ky);
      expect(r > 40 && r > 2 * g && r > 2 * b, `kart body ${r},${g},${b}`).toBe(true); // red, lit or shaded, never washed over
    }
    await lowDetail(p);
    await expect(root(p)).toHaveAttribute('data-effect', '');
    expect(a.errors).toEqual([]);
    await a.close();
  });
});

test.describe('010: polish', () => {
  test('leaving for the garage and racing again does not pile up what was drawn (FR-012)', async ({ browser }, info) => {
    test.setTimeout(120_000);
    const a = await player(browser, info), p = a.page;
    // the renderer may hold no more geometries than the scene still uses: anything left behind would show as more
    const round = async () => { await race(p); await p.waitForTimeout(500); await garage(p); await p.waitForTimeout(500); };
    const extra = async () => (await num(p, 'geometries')) - (await num(p, 'used'));
    for (let i = 0; i < 4; i++) { await round(); expect(await extra(), `round ${i + 1}`).toBeLessThanOrEqual(0); }
    for (const t of ['Desert', 'Snow', 'Neon', 'Meadow']) { await pick(p, t); await p.waitForTimeout(500); expect(await extra(), t).toBeLessThanOrEqual(0); }
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('very light and very dark colours stay visible on the shaded kart', async ({ browser }, info) => {
    const a = await player(browser, info), p = a.page;
    await expect(p.getByRole('button', { name: 'Start race' })).toBeVisible();
    await p.waitForTimeout(500);
    await p.clock.pauseAt(await p.evaluate(() => Date.now()) + 500);
    const shot = async () => { await p.clock.runFor(40); return decodePng(await p.screenshot({ scale: 'css', clip: { x: 420, y: 220, width: 520, height: 380 } })); };
    for (const c of ['#000000', '#ffffff']) {
      for (const label of ['Kart colour', 'Helmet']) await p.getByLabel(label).fill(c);
      const img = await shot(); let lo = 255, hi = 0;
      for (let j = 0; j < img.h; j += 4) for (let i = 0; i < img.w; i += 4) { const l = lum(img.at(i, j)); lo = Math.min(lo, l); hi = Math.max(hi, l); }
      expect(hi - lo, `${c}: shading shows the kart's shape`).toBeGreaterThan(80);
    }
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('fills a phone screen upright and sideways', async ({ browser }, info) => {
    const a = await player(browser, info), p = a.page;
    await race(p);
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await p.setViewportSize(size);
      await expect.poll(() => p.locator('.tt canvas').first().evaluate(c => `${c.clientWidth}x${c.clientHeight}`)).toBe(`${size.width}x${size.height}`);
    }
    expect(a.errors).toEqual([]);
    await a.close();
  });

  test('SC-005: a race opens within 1 s of the old look', async ({ browser, browserName }, info) => {
    test.skip(browserName !== 'chromium', 'timed in Chromium');
    const a = await player(browser, info), runs: number[][] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      await a.page.goto(GAME);
      await expect(a.page.getByRole('button', { name: 'Start race' })).toBeVisible();
      await a.page.evaluate(() => new Promise(requestAnimationFrame));
      const open = Date.now() - t0, t1 = Date.now();
      await a.page.getByRole('button', { name: 'Start race' }).click();
      await expect(a.page.locator('#msg')).toHaveText('3', { timeout: 5000 });
      runs.push([open, Date.now() - t1]);
    }
    const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[xs.length >> 1], open = median(runs.map(r => r[0])), start = median(runs.map(r => r[1]));
    expect(open, 'garage drawn (ms)').toBeLessThan(OPEN_MS + 1000);
    expect(start, 'countdown after Start (ms)').toBeLessThan(START_MS + 1000);
    expect(a.errors).toEqual([]);
    await a.close();
  });
});
