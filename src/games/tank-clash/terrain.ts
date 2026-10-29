// The ground (research R2, R3): a grid of CELL-sized cells, each a Material. Built from a seed and a map with
// additions and multiplications only, so every device builds the same battlefield; blasts carve it, down to the bottom.
import {
  BRIDGE_CELLS, CELL, GAP_W, GAPS, GEN_TRIES, GRID_H, GRID_W, HILL_MAX_H, HILL_MIN_H, HILLS_MAX, HILLS_MIN, ICE_CELLS,
  ICE_CHANCE, LAKE_DEPTH, LAKES, SNOW_AREAS, SNOW_CELLS, SNOW_W, START_GAP, TANK_W, VALLEY_MAX_H, VALLEY_MIN_H, WOOD_BLAST_FACTOR,
  WORLD_H, WORLD_W,
} from './constants.ts';
import { MapId, Material } from './enums.ts';
import type { Random } from './seed.ts';

export type PlayableMap = Exclude<MapId, typeof MapId.Random>;
export const PLAYABLE_MAPS: PlayableMap[] = [MapId.GreenHills, MapId.TimberGap, MapId.LakeValley, MapId.FrostRidge];
export type Terrain = { cells: Uint8Array; map: PlayableMap };
/** The first non-air cell at or below a point: its top edge and what it is (water included). */
export type Ground = { y: number; m: Material };

const FLATTEN = 6;        // columns levelled either side of a gap, so the bridge meets the ground
const START_TRIES = 200;  // random spots tried per tank
const START_SLOPE = 0.5;  // a start spot's rise across a tank's length, at most
const between = (random: Random, [a, b]: number[]) => a + random() * (b - a);
const intBetween = (random: Random, [a, b]: number[]) => a + Math.floor(random() * (b - a + 1));

export const isSolid = (m: number) => m !== Material.Air && m !== Material.Water;
const col = (x: number) => Math.floor(x / CELL);
const at = (t: Terrain, gx: number, gy: number) =>
  gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H ? Material.Air : t.cells[gy * GRID_W + gx] as Material;

export const cellAt = (t: Terrain, x: number, y: number) => at(t, col(x), Math.floor(y / CELL));

/** The first non-air cell in x's column at or below `fromY`, or null if there's nothing down to the bottom. */
export function groundBelow(t: Terrain, x: number, fromY: number): Ground | null {
  const gx = col(x);
  if (gx < 0 || gx >= GRID_W) return null;
  for (let gy = Math.max(0, Math.floor(fromY / CELL)); gy < GRID_H; gy++) {
    const m = at(t, gx, gy);
    if (m !== Material.Air) return { y: gy * CELL, m };
  }
  return null;
}

/** The top of x's column (first non-air cell from the sky), or null if the column is empty. */
export const surfaceAt = (t: Terrain, x: number) => groundBelow(t, x, 0);

/** Clears every breakable cell within r of (x, y) (wood within a bigger radius); water stays. Returns the cell box
 *  that may have changed, for redrawing. */
export function carve(t: Terrain, x: number, y: number, r: number) {
  const reach = r * WOOD_BLAST_FACTOR;
  const box = { x0: Math.max(0, col(x - reach)), y0: Math.max(0, Math.floor((y - reach) / CELL)),
    x1: Math.min(GRID_W - 1, col(x + reach)), y1: Math.min(GRID_H - 1, Math.floor((y + reach) / CELL)) };
  for (let gy = box.y0; gy <= box.y1; gy++) for (let gx = box.x0; gx <= box.x1; gx++) {
    const i = gy * GRID_W + gx, m = t.cells[i];
    if (!isSolid(m)) continue;
    const dx = (gx + 0.5) * CELL - x, dy = (gy + 0.5) * CELL - y, d2 = dx * dx + dy * dy;
    if (d2 <= (m === Material.Wood ? reach * reach : r * r)) t.cells[i] = Material.Air;
  }
  return box;
}

// the ground's top row per column, from peaks and valleys joined by smoothstep curves (+ − × ÷ only: research R3)
function hills(random: Random) {
  const n = intBetween(random, [HILLS_MIN, HILLS_MAX]), points = 2 * n, xs: number[] = [], hs: number[] = [];
  for (let i = 0; i <= points; i++) {
    const jitter = i === 0 || i === points ? 0 : (random() - 0.5) * WORLD_W / (points * 2);
    xs.push(i * WORLD_W / points + jitter);
    hs.push(WORLD_H * (i % 2 ? between(random, [HILL_MIN_H, HILL_MAX_H]) : between(random, [VALLEY_MIN_H, VALLEY_MAX_H])));
  }
  const top = new Int16Array(GRID_W);
  let seg = 0;
  for (let gx = 0; gx < GRID_W; gx++) {
    const x = (gx + 0.5) * CELL;
    while (seg < points - 1 && x > xs[seg + 1]) seg++;
    const s = Math.min(1, Math.max(0, (x - xs[seg]) / (xs[seg + 1] - xs[seg]))), e = s * s * (3 - 2 * s);
    top[gx] = Math.floor((WORLD_H - (hs[seg] + (hs[seg + 1] - hs[seg]) * e)) / CELL);
  }
  const valleys = xs.filter((_, i) => i % 2 === 0 && i > 0 && i < points).map(col);
  return { top, valleys };
}

function fill(t: Terrain, top: Int16Array) {
  for (let gx = 0; gx < GRID_W; gx++) for (let gy = top[gx]; gy < GRID_H; gy++) t.cells[gy * GRID_W + gx] = Material.Earth;
}
const set = (t: Terrain, gx: number, gy: number, m: Material) => { if (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H) t.cells[gy * GRID_W + gx] = m; };

// Timber Gap: gaps cut to the bottom, each crossed by a wooden bridge on levelled ground
function gaps(t: Terrain, top: Int16Array, random: Random) {
  const count = intBetween(random, GAPS);
  const ranges = count === 1 ? [[0.3, 0.7]] : [[0.12, 0.38], [0.62, 0.88]];
  for (const range of ranges) {
    const w = between(random, GAP_W), x = between(random, range) * WORLD_W;
    const g0 = col(x - w / 2), g1 = col(x + w / 2);
    const level = Math.round((top[Math.max(0, g0 - 1)] + top[Math.min(GRID_W - 1, g1 + 1)]) / 2);
    for (let gx = Math.max(0, g0 - FLATTEN); gx <= Math.min(GRID_W - 1, g1 + FLATTEN); gx++) {
      for (let gy = 0; gy < GRID_H; gy++) set(t, gx, gy, gy < level || (gx >= g0 && gx <= g1) ? Material.Air : Material.Earth);
      top[gx] = level;
    }
    for (let gx = g0; gx <= g1; gx++) for (let k = 0; k < BRIDGE_CELLS; k++) set(t, gx, level + k, Material.Wood);
  }
}

// Lake Valley: water filling dips, never spilling off the field
function lakes(t: Terrain, top: Int16Array, valleys: number[], random: Random) {
  const picks = [...valleys];
  for (let n = intBetween(random, LAKES); n > 0 && picks.length; n--) {
    const c = picks.splice(Math.floor(random() * picks.length), 1)[0];
    const level = top[c] - Math.round(between(random, LAKE_DEPTH) / CELL);
    let a = c, b = c;
    while (a > 0 && top[a - 1] > level) a--;
    while (b < GRID_W - 1 && top[b + 1] > level) b++;
    if (a === 0 || b === GRID_W - 1) continue;
    for (let gx = a; gx <= b; gx++) for (let gy = level; gy < top[gx]; gy++) set(t, gx, gy, Material.Water);
  }
}

// Frost Ridge: snow on top of the ground, some areas with ice
function snow(t: Terrain, top: Int16Array, random: Random) {
  for (let n = intBetween(random, SNOW_AREAS); n > 0; n--) {
    const w = between(random, SNOW_W), x = random() * WORLD_W, ice = random() < ICE_CHANCE;
    for (let gx = Math.max(0, col(x - w / 2)); gx <= Math.min(GRID_W - 1, col(x + w / 2)); gx++) {
      const icy = ice && Math.abs((gx + 0.5) * CELL - x) < w * 0.2;
      for (let k = 0; k < SNOW_CELLS; k++) set(t, gx, top[gx] + k, icy && k < ICE_CELLS ? Material.Ice : Material.Snow);
    }
  }
}

/** A fresh battlefield for a map (random counts, heights and places each time). */
export function build(random: Random, map: PlayableMap): Terrain {
  const t: Terrain = { cells: new Uint8Array(GRID_W * GRID_H), map };
  const { top, valleys } = hills(random);
  fill(t, top);
  if (map === MapId.TimberGap) gaps(t, top, random);
  if (map === MapId.LakeValley) lakes(t, top, valleys, random);
  if (map === MapId.FrostRidge) snow(t, top, random);
  return t;
}

// no water under or within one tank width of x; solid, flat-enough ground under the tracks
function goodSpot(t: Terrain, x: number) {
  for (let cx = x - TANK_W * 1.5; cx <= x + TANK_W * 1.5; cx += CELL) {
    const s = surfaceAt(t, cx);
    if (s && s.m === Material.Water) return false;
  }
  const a = surfaceAt(t, x - TANK_W / 2), b = surfaceAt(t, x + TANK_W / 2), c = surfaceAt(t, x);
  return !!a && !!b && !!c && isSolid(a.m) && isSolid(b.m) && isSolid(c.m) && Math.abs(a.y - b.y) <= TANK_W * START_SLOPE;
}

/** Random start spots (x): the first count in the left half, the second in the right half, apart from each other and
 *  away from water; null if they don't all fit. */
export function startSpots(t: Terrain, random: Random, left: number, right: number): number[] | null {
  const spots: number[] = [];
  const place = (lo: number, hi: number) => {
    for (let i = 0; i < START_TRIES; i++) {
      const x = lo + random() * (hi - lo);
      if (goodSpot(t, x) && spots.every(s => Math.abs(s - x) >= TANK_W + START_GAP)) return spots.push(x) > 0;
    }
    return false;
  };
  const half = WORLD_W / 2;
  for (let i = 0; i < left; i++) if (!place(TANK_W, half - TANK_W)) return null;
  for (let i = 0; i < right; i++) if (!place(half + TANK_W, WORLD_W - TANK_W)) return null;
  return spots;
}

/** A battlefield and start spots that fit; after GEN_TRIES failures, Green Hills (and as a last resort, flat ground). */
export function generate(random: Random, map: PlayableMap, left: number, right: number) {
  for (const m of [map, MapId.GreenHills]) for (let i = 0; i < GEN_TRIES; i++) {
    const terrain = build(random, m), spots = startSpots(terrain, random, left, right);
    if (spots) return { terrain, spots };
  }
  const terrain: Terrain = { cells: new Uint8Array(GRID_W * GRID_H), map: MapId.GreenHills };
  fill(terrain, new Int16Array(GRID_W).fill(Math.floor(GRID_H * (1 - VALLEY_MAX_H))));
  const spread = (n: number, from: number) => Array.from({ length: n }, (_, i) => from + (i + 0.5) * (WORLD_W / 2) / n);
  return { terrain, spots: [...spread(left, 0), ...spread(right, WORLD_W / 2)] };
}
