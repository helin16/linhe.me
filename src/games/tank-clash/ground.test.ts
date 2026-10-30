import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CELL, GRID_H, GRID_W, GROUND_DEPTH, WORLD_H, WORLD_W } from './constants.ts';
import { MapId, Material } from './enums.ts';
import { groundMesh, outlines, smooth, type Surface } from './ground.ts';
import { carve, type Terrain } from './terrain.ts';

/** A grid with `m` from row `top` down. */
function slab(top: number, m: number = Material.Earth) {
  const c = new Uint8Array(GRID_W * GRID_H);
  for (let j = top; j < GRID_H; j++) c.fill(m, j * GRID_W, (j + 1) * GRID_W);
  return c;
}
/** A surface's triangles: nine position numbers then the first point's normal. */
const tris = (s: Surface) => Array.from({ length: s.positions.length / 9 }, (_, t) => [...s.positions.slice(t * 9, t * 9 + 9), ...s.normals.slice(t * 9, t * 9 + 3)]);
const fronts = (s: Surface) => tris(s).filter(t => t[11] === 1);
const walls = (s: Surface) => tris(s).filter(t => t[11] === 0);
const area = (t: number[]) => Math.abs((t[3] - t[0]) * (t[7] - t[1]) - (t[4] - t[1]) * (t[6] - t[0])) / 2;
const covered = (ts: number[][], x: number, y: number) => ts.some(t => { // is (x, three y) inside one of the triangles?
  const [ax, ay, , bx, by, , cx, cy] = t, d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const u = ((bx - x) * (cy - y) - (by - y) * (cx - x)) / d, v = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) / d;
  return u >= -1e-9 && v >= -1e-9 && 1 - u - v >= -1e-9;
});
const cellAt = (gx: number, gy: number): [number, number] => [(gx + 0.5) * CELL, WORLD_H - (gy + 0.5) * CELL];
const terrain = (cells: Uint8Array) => ({ cells, map: MapId.GreenHills }) as Terrain;

test('a flat field: the front covers the ground (to within its rounded corners), a top strip faces up through the depth', () => {
  const top = 150, m = groundMesh(slab(top), slab(top)), surface = WORLD_H - top * CELL;
  const a = fronts(m.solid).reduce((s, t) => s + area(t), 0);
  assert.ok(Math.abs(a - WORLD_W * surface) / (WORLD_W * surface) < 0.005, `front area ${a} vs ${WORLD_W * surface}`);
  const up = walls(m.solid).filter(t => t[10] > 0.99 && t[0] > 20 && t[0] < WORLD_W - 20); // away from the rounded corners
  assert.ok(up.length > 0 && up.every(t => [t[1], t[4], t[7]].every(y => Math.abs(y - surface) < 0.01)), 'the top strip, at the surface');
  assert.ok(up.some(t => [t[2], t[5], t[8]].includes(-GROUND_DEPTH / 2)), 'running back through the depth');
  assert.ok(covered(fronts(m.solid), 800, surface - 10) && !covered(fronts(m.solid), 800, surface + 10));
});

test('front faces face the camera and walls face away from the ground (winding agrees with the normal)', () => {
  const c = slab(150); carve(terrain(c), 800, 150 * CELL, 40);
  const m = groundMesh(c, slab(150));
  for (const s of [m.solid, m.back, m.water]) for (let t = 0; t < s.positions.length / 9; t++) {
    const v = [0, 1, 2].map(k => s.positions.slice(t * 9 + k * 3, t * 9 + k * 3 + 3)), n = s.normals.slice(t * 9, t * 9 + 3);
    const u = v[1].map((x, i) => x - v[0][i]), w = v[2].map((x, i) => x - v[0][i]);
    const cross = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    assert.ok(cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] > 0);
  }
});

test('no ground, no surfaces', () => {
  const m = groundMesh(new Uint8Array(GRID_W * GRID_H), new Uint8Array(GRID_W * GRID_H));
  assert.deepEqual([m.solid.positions.length, m.back.positions.length, m.water.positions.length], [0, 0, 0]);
});

test('what is drawn matches the cells: a one-row ledge and a single cell show; a one-cell gap stays open', () => {
  const c = new Uint8Array(GRID_W * GRID_H);
  c.fill(Material.Wood, 100 * GRID_W + 40, 100 * GRID_W + 80); // a one-row plank
  c[120 * GRID_W + 60] = Material.Earth;                       // a lone cell
  for (const j of [150, 152]) c.fill(Material.Earth, j * GRID_W + 40, j * GRID_W + 80); // two rows with a gap between
  const f = fronts(groundMesh(c, c).solid);
  assert.ok(covered(f, ...cellAt(60, 100)), 'the plank shows');
  assert.ok(covered(f, ...cellAt(60, 120)), 'the lone cell shows');
  assert.ok(!covered(f, ...cellAt(60, 151)), 'the gap between the two rows stays open');
});

test('slopes are smooth: a staircase of cells gives a smooth top edge, at any steepness', () => {
  for (const across of [1, 2, 3]) { // 45°, about 27°, about 18°
    const c = new Uint8Array(GRID_W * GRID_H);
    for (let i = 0; i < GRID_W; i++) for (let j = Math.max(60, 180 - Math.floor(i / across)); j < GRID_H; j++) c[j * GRID_W + i] = Material.Earth;
    const loop = outlines(c).map(smooth)[0], turns: number[] = [];
    for (let k = 1; k + 1 < loop.length; k++) { // the angle between neighbouring pieces along the slope
      const [a, b, d] = [loop[k - 1], loop[k], loop[k + 1]];
      if (a[0] < 60 || a[0] > 400 || a[1] < 300) continue;
      const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]), t2 = Math.atan2(d[1] - b[1], d[0] - b[0]);
      turns.push(Math.abs(((t2 - t1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI));
    }
    assert.ok(turns.length > 10 && Math.max(...turns) < 0.35, `${across} across: no corner sharper than 20° (${Math.max(...turns).toFixed(2)})`);
  }
});

test('outlines close, and smoothing never moves a point more than 1 unit from where the cells put it', () => {
  const c = slab(150); carve(terrain(c), 600, 150 * CELL, 40); c.fill(Material.Wood, 100 * GRID_W + 200, 100 * GRID_W + 260);
  for (const loop of outlines(c)) {
    const s = smooth(loop), last = loop[loop.length - 1];
    assert.ok(Math.hypot(last[0] - loop[0][0], last[1] - loop[0][1]) <= CELL * 1.5, 'closed');
    assert.ok(s.every((p, k) => Math.hypot(p[0] - loop[k][0], p[1] - loop[k][1]) <= 1 + 1e-9));
  }
});

test('a crater: a hole in the front, with soil behind it where the ground was', () => {
  const original = slab(150), cells = slab(150);
  carve(terrain(cells), 800, 150 * CELL, 40);
  const m = groundMesh(cells, original), centre: [number, number] = [800, WORLD_H - 150 * CELL - 10];
  assert.ok(!covered(fronts(m.solid), ...centre), 'the front is open there');
  assert.ok(covered(fronts(m.back), ...centre), 'the back shows soil');
  assert.ok(fronts(m.back).every(t => t[2] === -GROUND_DEPTH / 2 + 0.2), 'at the back');
  assert.ok(walls(m.solid).some(t => Math.abs(t[0] - 800) < 40 && t[10] > 0.5), 'its floor faces up');
});

test('water: its own front faces, a little behind the ground, tucked under the ground beside it', () => {
  const c = slab(150); for (let j = 150; j < 160; j++) c.fill(Material.Water, j * GRID_W + 100, j * GRID_W + 140);
  const m = groundMesh(c, c), w = fronts(m.water);
  assert.ok(w.length > 0 && w.every(t => t[2] === GROUND_DEPTH / 2 - 0.2));
  assert.ok(covered(w, ...cellAt(120, 155)), 'over the water');
  assert.ok(covered(w, ...cellAt(99, 155)), 'and a cell into the ground beside it, so no gap shows');
  assert.equal(walls(m.water).length, 0);
});

test('an air pocket inside the ground stays open in the front (a hole inside an outline)', () => {
  const c = slab(120);
  for (let j = 160; j < 170; j++) c.fill(Material.Air, j * GRID_W + 150, j * GRID_W + 170); // a pocket under the surface
  const f = fronts(groundMesh(c, c).solid);
  assert.ok(!covered(f, ...cellAt(160, 165)), 'open in the pocket');
  assert.ok(covered(f, ...cellAt(160, 140)) && covered(f, ...cellAt(160, 190)), 'ground above and below it');
  // an island in a bigger pocket, with its own pocket: that one belongs to the island, the smallest outline around it
  for (let j = 140; j < 200; j++) c.fill(Material.Air, j * GRID_W + 220, j * GRID_W + 300);
  for (let j = 150; j < 190; j++) c.fill(Material.Earth, j * GRID_W + 235, j * GRID_W + 285);
  for (let j = 165; j < 175; j++) c.fill(Material.Air, j * GRID_W + 255, j * GRID_W + 265);
  const g = fronts(groundMesh(c, c).solid);
  assert.ok(covered(g, ...cellAt(240, 160)), 'the island');
  assert.ok(!covered(g, ...cellAt(260, 170)) && !covered(g, ...cellAt(225, 170)), 'its pocket and the pocket around it');
});
