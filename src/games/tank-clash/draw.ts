// Drawing (research R1; spec Style): a bright cartoon side view fitted to the canvas — sky and scenery per map, the
// ground from the grid, chunky path-drawn tanks per type in the player's colour, wrecks, name and health bars, the
// active tank's arrow, bonuses on the tanks, the shell's fading trail, explosions and crates. All original art. The
// scenery fills the whole canvas; the field itself is scaled to fit, the ground carrying on beside and below it.
// The arcade style swaps in pixel art: banded skies and scenery drawn a cell to a pixel, a pixel palette for the
// ground, and pixel-art tank sprites (pixel.ts).
import { CELL, CRATE_SIZE, GRID_H, GRID_W, TANK_H, TANK_W, WORLD_H, WORLD_W } from './constants.ts';
import { Drop, MapId, Material, Phase, Style, TankType, Variant } from './enums.ts';
import { BUILD_GUN, GOLD, GOLD_BRIGHT, gunOf, KHAKI, METAL, ramp, OUTLINE as PIXEL_OUTLINE, SPRITE_GROUND, SPRITE_H, SPRITE_W, tankSprite, type Ramp } from './pixel.ts';
import { activeTank, facing, tiltOf, type Battle, type Tank } from './sim.ts';
import { groundBelow } from './terrain.ts';
import { specOf, variantOf } from './tanks.ts';
import type { Terrain } from './terrain.ts';
import type { TankLook } from './settings.ts';

const CHEER_S = 1.2;   // a repair kit's heart rises and fades this long
const SHINE_HZ = 3;    // gold bonuses glint this fast

type Ctx = CanvasRenderingContext2D;
type Scene = { skyTop: string; skyBottom: string; far: string; near: string; extra: 'farm' | 'forest' | 'lake' | 'peaks' };
const SCENES: Record<Terrain['map'], Scene> = {
  [MapId.GreenHills]: { skyTop: '#5ab4f0', skyBottom: '#cdeeff', far: '#9fd3a4', near: '#7cc184', extra: 'farm' },
  [MapId.TimberGap]: { skyTop: '#f2a65a', skyBottom: '#ffe3b3', far: '#c99a6b', near: '#a9805a', extra: 'forest' },
  [MapId.LakeValley]: { skyTop: '#4fa3e0', skyBottom: '#d8f1ff', far: '#8fc7c0', near: '#6fb0a8', extra: 'lake' },
  [MapId.FrostRidge]: { skyTop: '#8fb8de', skyBottom: '#eef6ff', far: '#c4d4e6', near: '#a9bfd8', extra: 'peaks' },
};
const OUTLINE = '#1d1d24';
const TRACK = '#3a3a42';
const WRECK = '#2e2b2b';
// cell colours (r, g, b)
const RGB: Record<number, [number, number, number]> = {
  [Material.Earth]: [150, 98, 58], [Material.Snow]: [246, 250, 255], [Material.Ice]: [182, 226, 245],
  [Material.Wood]: [168, 112, 60], [Material.Water]: [64, 150, 225],
};
const GRASS: [number, number, number] = [96, 186, 70];
const GRASS_EDGE: [number, number, number] = [206, 170, 92];

/** A colour lighter (f > 1) or darker (f < 1). */
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16), c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

// the ground layer: one pixel per cell, rebuilt when the terrain changes (a blast), drawn scaled up
type Layer = { canvas: HTMLCanvasElement; img: ImageData; version: number };
const layers: Record<Style, WeakMap<Terrain, Layer>> = { [Style.Normal]: new WeakMap(), [Style.Arcade]: new WeakMap() };
const versions = new WeakMap<Terrain, number>();
/** Call after the ground changes, so it is redrawn. */
export const groundChanged = (t: Terrain) => versions.set(t, (versions.get(t) ?? 0) + 1);

function groundLayer(t: Terrain, style: Style) {
  let layer = layers[style].get(t);
  const v = versions.get(t) ?? 0;
  if (layer && layer.version === v) return layer.canvas;
  if (!layer) {
    const canvas = document.createElement('canvas');
    canvas.width = GRID_W; canvas.height = GRID_H;
    layer = { canvas, img: canvas.getContext('2d')!.createImageData(GRID_W, GRID_H), version: -1 };
    layers[style].set(t, layer);
  }
  const d = layer.img.data;
  for (let gx = 0; gx < GRID_W; gx++) {
    let depth = 0; // cells since the last air above
    for (let gy = 0; gy < GRID_H; gy++) {
      const m = t.cells[gy * GRID_W + gx], i = (gy * GRID_W + gx) * 4;
      if (m === Material.Air) { d[i + 3] = 0; depth = 0; continue; }
      if (style === Style.Arcade) {
        d.set([...arcadeCell(m, depth, gx, gy), m === Material.Water ? 220 : 255], i);
        if (m !== Material.Water) depth++;
        continue;
      }
      let rgb = RGB[m], k = 1;
      if (m === Material.Earth) {
        rgb = depth < 2 ? GRASS : depth < 3 ? GRASS_EDGE : rgb;
        k = depth < 3 ? 1 : Math.max(0.55, 1 - (depth - 3) * 0.006);
      } else if (m === Material.Wood) k = gx % 4 === 0 ? 0.75 : 1; // planks
      else if (m === Material.Water) k = 1 - Math.min(0.35, depth * 0.03);
      d[i] = rgb[0] * k; d[i + 1] = rgb[1] * k; d[i + 2] = rgb[2] * k; d[i + 3] = m === Material.Water ? 215 : 255;
      if (m !== Material.Water) depth++;
    }
  }
  layer.canvas.getContext('2d')!.putImageData(layer.img, 0, 0);
  layer.version = v;
  return layer.canvas;
}

// the arcade ground: bright grass with a dark fringe over banded earth with pebbles; snow, ice, planks and water in
// flat pixel colours with a light top row
const hexRGB = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const ARC = {
  grass: ['#a6e05a', '#6fb83a', '#3f7f2a'].map(hexRGB), dirt: ['#9a6a3e', '#875b33', '#744d2b', '#5f3f24'].map(hexRGB), pebble: hexRGB('#b8a58e'),
  snow: ['#ffffff', '#e4edf7', '#c3d3e6'].map(hexRGB), ice: ['#eafaff', '#9fdcf5', '#6fbfe4'].map(hexRGB),
  wood: ['#d9a066', '#a8703e', '#6b4425'].map(hexRGB), water: ['#9fd4ff', '#3f86d6', '#2c63a8'].map(hexRGB),
};
const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
function arcadeCell(m: number, depth: number, gx: number, gy: number): [number, number, number] {
  if (m === Material.Earth) {
    if (depth < 1) return ARC.grass[0];
    if (depth < 2) return ARC.grass[1];
    if (depth < 3 + (hash(gx, 0) % 2)) return ARC.grass[2];
    if (hash(gx, gy) % 61 === 0) return ARC.pebble;
    return ARC.dirt[Math.min(3, Math.floor((depth + 2 * Math.sin(gx / 3)) / 12))];
  }
  const r = m === Material.Snow ? ARC.snow : m === Material.Ice ? ARC.ice : m === Material.Wood ? ARC.wood : ARC.water;
  if (m === Material.Wood && gx % 4 === 0) return r[2]; // plank seams
  return depth < 1 ? r[0] : m === Material.Water ? (hash(gx, gy) % 37 === 0 ? r[0] : r[1]) : r[depth < 3 ? 1 : 2];
}

// arcade scenery per map: a banded sky (dithered between bands), pixel clouds, a far range and a near ridge with trees
type ArcScene = { sky: string[]; far: [string, string]; near: [string, string]; trees: [string, string, string];
  farShape: 'round' | 'mesa' | 'peaks'; pines: boolean; snowy: boolean; lake: boolean };
const ARC_SCENES: Record<Terrain['map'], ArcScene> = {
  [MapId.GreenHills]: { sky: ['#3f7fd0', '#5f9be0', '#86b8ec', '#b6d8f4'], far: ['#7fa3c4', '#9bbad6'], near: ['#5d9150', '#79ad62'],
    trees: ['#7fc04a', '#4f8f2f', '#2f5e1d'], farShape: 'round', pines: false, snowy: false, lake: false },
  [MapId.TimberGap]: { sky: ['#e0703a', '#ee8e4a', '#f6b064', '#fcd590'], far: ['#b06a3e', '#c98450'], near: ['#7a5236', '#946543'],
    trees: ['#6f8a42', '#4a6a2e', '#2e4a1c'], farShape: 'mesa', pines: true, snowy: false, lake: false },
  [MapId.LakeValley]: { sky: ['#2f93c0', '#4eaed4', '#7fc8e2', '#b8e2f0'], far: ['#5f97a4', '#7fb0ba'], near: ['#4a8a64', '#62a27a'],
    trees: ['#7fc04a', '#4f8f2f', '#2f5e1d'], farShape: 'round', pines: false, snowy: false, lake: true },
  [MapId.FrostRidge]: { sky: ['#6f98cc', '#8fb4de', '#b8d2ee', '#e2eefa'], far: ['#93a9c4', '#ffffff'], near: ['#b8cade', '#d6e2ef'],
    trees: ['#6f9a86', '#4f7a66', '#2f5446'], farShape: 'peaks', pines: true, snowy: true, lake: false },
};
const SKY_BANDS = [220, 400, 560];    // world y where the sky's bands change
const DITHER = 16;                     // world units of checkerboard above each band change
const CLOUDS: [number, number, number][] = [[220, 120, 1], [640, 80, 0.8], [1080, 140, 1.1], [1420, 70, 0.8]];
const PUFFS: [number, number, number][] = [[0, 0, 26], [32, -12, 32], [66, 0, 26], [22, 9, 22], [50, 12, 22]];
const TREE_GAP = 150;
const SCENE_STEP = 64;                 // the arcade scenery covers the view rounded out to this many cells (resizes reuse it)
const tri = (x: number, period: number) => Math.abs(((x / period) % 1 + 1) % 1 - 0.5) * 2; // 0..1..0
function farTop(x: number, shape: ArcScene['farShape']) {
  if (shape === 'peaks') return 520 - 260 * tri(x + 120, 480) ** 1.4;
  if (shape === 'mesa') return 470 - (Math.sin(x / 140) > -0.2 ? 90 + 20 * Math.sign(Math.sin(x / 47)) : 0);
  return 470 - 150 * (0.5 + 0.5 * Math.sin(x * 0.004) * Math.cos(x * 0.0015));
}
const nearTop = (x: number) => 545 - 70 * (0.5 + 0.5 * Math.sin(x * 0.007) * Math.cos(x * 0.0026));
function inCloud(x: number, y: number) {
  const ox = Math.floor(x / WORLD_W) * WORLD_W;
  for (const o of [ox - WORLD_W, ox, ox + WORLD_W]) for (const [cx, cy, s] of CLOUDS)
    for (const [dx, dy, r] of PUFFS) { const px = (x - o - cx - dx * s) / (r * s), py = (y - cy - dy * s) * 1.6 / (r * s); if (px * px + py * py <= 1) return true; }
  return false;
}
function inTree(x: number, y: number, s: ArcScene) {
  const tx = Math.round(x / TREE_GAP) * TREE_GAP + (hash(Math.round(x / TREE_GAP), 1) % 40) - 20, base = nearTop(tx) + 8;
  if (s.pines) { const h = 56, w = 20 * (y - (base - h)) / h; return y < base && y > base - h && Math.abs(x - tx) < w; }
  const dx = x - tx, dy = y - (base - 26); return dx * dx + dy * dy * 1.4 < 22 * 22;
}
// props standing on the near ridge, in scenery pixels from their foot: [ellipse?, x0 or cx, y0 or cy, x1 or rx, y1 or ry, colours]
type Part = [boolean, number, number, number, number, Ramp];
const flat = (c: string) => ramp(c, c, c);
const STONE = ramp('#d8cdb8', '#aa9d86', '#73685a'), PLANK = ramp('#a8774a', '#7a5432', '#4a3320'), BAG = KHAKI;
const HOLE = flat('#2a2620'), WIRE = flat('#4b4b4b'), SNOWBAG = ramp('#ffffff', '#e4edf7', '#c3d3e6'), SNOW_CAP = hexRGB('#ffffff');
const ruin = (wall: Ramp): Part[] => [[false, 3, -21, 6, -16, wall], [false, 0, -17, 15, 0, wall], [false, 15, -12, 26, 0, wall],
  [false, 3, -12, 6, -7, HOLE], [false, 9, -12, 12, -7, HOLE], [false, 19, -8, 22, -4, HOLE], [false, -2, -18, 15, -17, PLANK]];
const sandbags = (bag: Ramp): Part[] => [0, 1, 2].flatMap(row => Array.from({ length: 4 - row }, (_, i): Part =>
  [true, i * 5 + row * 2.5, -2 - row * 3.2, 2.8, 1.9, bag]));
const fence = (w: number): Part[] => [[false, 0, -5, w, -4, WIRE], [false, 0, -3, w, -2, WIRE],
  ...Array.from({ length: Math.floor(w / 7) + 1 }, (_, i): Part => [false, i * 7, -7, i * 7 + 1, 0, PLANK])];
const logs: Part[] = [0, 1, 2].flatMap(row => Array.from({ length: 3 - row }, (_, i): Part => [true, i * 5 + row * 2.5, -2.5 - row * 4.2, 2.6, 2.6, PLANK]));
// props keep clear of the field's sides: propsNear doesn't look across the seam
const ARC_PROPS: Record<Terrain['map'], [number, Part[]][]> = {
  [MapId.GreenHills]: [[300, ruin(STONE)], [220, sandbags(BAG)], [1180, sandbags(BAG)], [1240, fence(42)]],
  [MapId.TimberGap]: [[420, logs], [1150, logs], [820, sandbags(BAG)], [180, fence(35)]],
  [MapId.LakeValley]: [[1000, ruin(PLANK)], [260, sandbags(BAG)], [1320, sandbags(BAG)], [560, fence(42)]],
  [MapId.FrostRidge]: [[350, sandbags(SNOWBAG)], [1220, sandbags(SNOWBAG)], [700, fence(42)], [980, ruin(STONE)]],
};
const inPart = ([round, a, b, c, d]: Part, x: number, y: number) =>
  round ? ((x - a) / c) ** 2 + ((y - b) / d) ** 2 <= 1 : x >= a && x < c && y >= b && y < d;
const partAt = (parts: Part[], x: number, y: number) => { for (let i = parts.length - 1; i >= 0; i--) if (inPart(parts[i], x, y)) return i; return -1; };
const PROP_REACH = 48; // scenery pixels: no prop is wider or taller
const NEXT_TO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** The colour of a prop at world (x, y), outlined and shaded like the sprites, or null where there's none. Each column
 *  of a prop stands on the ridge below it (`ridge`, nearTop(x)), so props follow the slope, beyond the field's sides too. */
const propsNear = (x: number, map: Terrain['map']) => {
  const wx = ((x % WORLD_W) + WORLD_W) % WORLD_W;
  return ARC_PROPS[map].filter(([px]) => wx >= px - 4 * CELL && wx <= px + PROP_REACH * CELL);
};
function propAt(x: number, y: number, ridge: number, near: [number, Part[]][], snowy: boolean) {
  const wx = ((x % WORLD_W) + WORLD_W) % WORLD_W, ly = (y - ridge) / CELL - 2;
  if (!near.length || ly < -PROP_REACH || ly > 2) return null;
  for (const [px, parts] of near) { // bodies first, so one prop's outline never cuts into another
    const lx = (wx - px) / CELL, i = partAt(parts, lx, ly);
    if (i < 0) continue;
    const r = parts[i][5], up = partAt(parts, lx, ly - 1);
    return snowy && up < 0 && r !== WIRE ? SNOW_CAP : up !== i ? r[0] : partAt(parts, lx, ly + 1) !== i ? r[2] : r[1];
  }
  for (const [px, parts] of near)
    if (NEXT_TO.some(([dx, dy]) => partAt(parts, (wx - px) / CELL + dx, ly + dy) >= 0)) return PIXEL_OUTLINE;
  return null;
}
const sceneCache = { key: '', canvas: null as HTMLCanvasElement | null };
/** The arcade scenery behind the field, one pixel per ground cell, built once per map and view. */
function arcadeScenery(ctx: Ctx, map: Terrain['map'], v: View) {
  const step = CELL * SCENE_STEP, x0 = Math.floor(v.x0 / step) * step, y0 = Math.floor(v.y0 / step) * step;
  const w = Math.ceil((v.x1 - x0) / step) * SCENE_STEP, h = Math.ceil((v.y1 - y0) / step) * SCENE_STEP, key = [map, x0, y0, w, h].join('|');
  if (sceneCache.key !== key) {
    const s = ARC_SCENES[map], cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c2 = cv.getContext('2d')!, img = c2.createImageData(w, h), sky = s.sky.map(hexRGB);
    const [far, farHi, near, nearHi] = [...s.far, ...s.near].map(hexRGB), trees = s.trees.map(hexRGB), white = SNOW_CAP;
    const cloud = ['#ffffff', '#f1f6fb', '#c9d8e8'].map(hexRGB), lake = ['#6cc0ea', '#d8f2ff'].map(hexRGB);
    const props = Array.from({ length: w }, (_, X) => propsNear(x0 + (X + 0.5) * CELL, map));
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) {
      const x = x0 + (X + 0.5) * CELL, y = y0 + (Y + 0.5) * CELL;
      let band = 0;
      while (band < SKY_BANDS.length && y >= SKY_BANDS[band]) band++;
      if (band < 3 && SKY_BANDS[band] - y < DITHER && (X + Y) % 2 === 0) band++;
      let col = sky[band];
      if (inCloud(x, y)) col = !inCloud(x, y - CELL) ? cloud[0] : !inCloud(x, y + 2 * CELL) ? cloud[2] : cloud[1];
      const ft = farTop(x, s.farShape);
      if (y >= ft) col = s.farShape === 'peaks' ? (y < ft + 36 && ft < 400 ? white : far) : y < ft + 2 * CELL ? farHi : far;
      if (s.lake && y >= 505 && y < 540) col = hash(X, Y) % 23 === 0 ? lake[1] : lake[0];
      const nt = nearTop(x);
      if (inTree(x, y, s)) {
        const up = inTree(x, y - CELL, s);
        col = s.snowy && !up ? white : !up ? trees[0] : !inTree(x, y + CELL, s) ? trees[2] : trees[1];
      }
      if (y >= nt) col = y < nt + 2 * CELL ? nearHi : near;
      col = propAt(x, y, nt, props[X], s.snowy) ?? col;
      const i = (Y * w + X) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
    c2.putImageData(img, 0, 0);
    sceneCache.key = key; sceneCache.canvas = cv;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sceneCache.canvas!, x0, y0, w * CELL, h * CELL);
}

type View = { x0: number; x1: number; y0: number; y1: number }; // the world area the canvas shows, beyond the field too
function scenery(ctx: Ctx, s: Scene, v: View) {
  const sky = ctx.createLinearGradient(0, v.y0, 0, WORLD_H);
  sky.addColorStop(0, s.skyTop); sky.addColorStop(1, s.skyBottom);
  ctx.fillStyle = sky; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; // clouds
  for (const [x, y, r] of [[220, 120, 34], [640, 80, 28], [1080, 140, 38], [1420, 70, 26]]) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x + r, y + 6, r * 0.8, 0, Math.PI * 2); ctx.arc(x - r, y + 8, r * 0.7, 0, Math.PI * 2); ctx.fill();
  }
  const hills = (color: string, base: number, amp: number, freq: number) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(v.x0, v.y1);
    for (let x = v.x0 - v.x0 % 20 - 20; x <= v.x1 + 20; x += 20) ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * freq) * Math.cos(x * freq * 0.37)));
    ctx.lineTo(v.x1, v.y1); ctx.fill();
  };
  if (s.extra === 'peaks') { // snowy mountains
    const repeats = [];  // the range repeats beyond the field's sides
    for (let o = Math.floor(v.x0 / WORLD_W) * WORLD_W; o < v.x1; o += WORLD_W) repeats.push(o);
    for (const o of repeats) {
      ctx.fillStyle = s.far; ctx.beginPath(); ctx.moveTo(o, 320);
      for (const [x, y] of [[180, 300], [380, 470], [620, 260], [880, 460], [1120, 280], [1380, 450], [1600, 320]]) ctx.lineTo(o + x, y);
      ctx.lineTo(o + WORLD_W, v.y1); ctx.lineTo(o, v.y1); ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (const [x, y] of [[180, 300], [620, 260], [1120, 280]]) { ctx.beginPath(); ctx.moveTo(o + x - 40, y + 40); ctx.lineTo(o + x, y); ctx.lineTo(o + x + 40, y + 40); ctx.fill(); }
    }
  } else hills(s.far, 460, 140, 0.004);
  hills(s.near, 540, 90, 0.007);
  if (s.extra === 'farm') for (const x of [300, 1240]) { // farmhouses
    ctx.fillStyle = '#d9534f'; ctx.fillRect(x, 470, 46, 30);
    ctx.fillStyle = '#7a3b2e'; ctx.beginPath(); ctx.moveTo(x - 6, 470); ctx.lineTo(x + 23, 448); ctx.lineTo(x + 52, 470); ctx.fill();
  }
  if (s.extra === 'forest') for (let x = v.x0 - v.x0 % 90 + 40; x < v.x1; x += 90) { // pines
    ctx.fillStyle = '#5c7a3e'; ctx.beginPath(); ctx.moveTo(x, 470); ctx.lineTo(x + 18, 410 - (Math.abs(x) % 3) * 10); ctx.lineTo(x + 36, 470); ctx.fill();
  }
  if (s.extra === 'lake') { ctx.fillStyle = 'rgba(120,190,240,0.6)'; ctx.fillRect(v.x0, 520, v.x1 - v.x0, 30); }
}

/** Bonuses shown on a tank (FR-021): grip gear gilds the wheels, a shield the outline, a missile rides on top. */
export type Gear = { wheels?: boolean; edge?: boolean; missile?: boolean; time?: number };
/** Shiny gold, glinting with time. */
const gold = (time: number) => `hsl(46, 95%, ${55 + 15 * Math.sin(time * SHINE_HZ * Math.PI * 2)}%)`;

type Look = Pick<TankLook, 'type' | 'variant' | 'color'>;
/** A tank drawn at its bottom centre (x, y), facing `dir` (1 right, −1 left), cannon at `angle` degrees from flat, the
 *  body tilted by `tilt` radians (clockwise) to sit on a slope. */
export function drawTank(ctx: Ctx, look: Look, x: number, y: number, dir: number, angle: number, wreck = false, tilt = 0, gear: Gear = {}, style: Style = Style.Normal) {
  const { type, color } = look, variant = variantOf(look);
  if (style === Style.Arcade) { pixelTank(ctx, type, variant, color, x, y, dir, angle, wreck, tilt, gear); return; }
  const [gunLen, gunThick] = BUILD_GUN[variant];
  const body = wreck ? WRECK : color, dark = wreck ? WRECK : shade(color, 0.7), light = wreck ? WRECK : shade(color, 1.25);
  const shine = gold(gear.time ?? 0);
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(dir, 1);
  angle += dir * tilt * 180 / Math.PI; // the cannon keeps its angle to flat ground, whatever the body's tilt
  ctx.lineWidth = gear.edge ? 2.8 : 1.6; ctx.strokeStyle = gear.edge ? shine : OUTLINE; ctx.lineJoin = 'round';
  const poly = (fill: string, pts: number[][]) => { ctx.fillStyle = fill; ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill(); ctx.stroke(); };
  const wheel = (cx: number, cy: number, r: number) => { ctx.fillStyle = wreck ? WRECK : gear.wheels ? shine : '#55555f'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = gear.wheels ? '#fff6c8' : '#9a9aa6'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2); ctx.fill(); };
  const cannon = (px: number, py: number, len: number, thick: number, twin = false) => {
    len *= gunLen; thick *= gunThick;
    ctx.save(); ctx.translate(px, py); ctx.rotate(-angle * Math.PI / 180);
    for (const off of twin ? [-thick * 0.8, thick * 0.8] : [0]) {
      ctx.fillStyle = dark; ctx.fillRect(0, off - thick / 2, len, thick); ctx.strokeRect(0, off - thick / 2, len, thick);
      ctx.fillStyle = OUTLINE; ctx.fillRect(len - 3, off - thick / 2 - 1, 3, thick + 2); // muzzle
    }
    ctx.restore();
  };
  const rivets = (pts: number[][]) => { ctx.fillStyle = OUTLINE; for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(px, py, 1, 0, Math.PI * 2); ctx.fill(); } };
  const W = TANK_W / 2;
  if (type === TankType.Scout) { // small, light, on big wheels
    cannon(2, -18, 22, 3);
    poly(body, [[-W + 4, -8], [-W + 8, -18], [W - 6, -18], [W - 2, -8]]);
    poly(light, [[-8, -18], [-5, -24], [8, -24], [10, -18]]);
    for (const cx of [-W + 9, 0, W - 9]) wheel(cx, -6, 6);
  } else {
    // tracks with road wheels
    ctx.fillStyle = TRACK; ctx.beginPath(); ctx.roundRect(-W, -11, TANK_W, 11, 5); ctx.fill(); ctx.stroke();
    for (let cx = -W + 6; cx <= W - 6; cx += 9) wheel(cx, -5.5, 3.6);
    if (type === TankType.Heavy) { // wide, armour-heavy, twin cannon
      cannon(4, -24, 24, 4, true);
      poly(body, [[-W, -11], [-W + 3, -21], [W - 3, -21], [W, -11]]);
      poly(dark, [[-W + 2, -15], [W - 2, -15], [W - 1, -12], [-W + 1, -12]]);
      poly(light, [[-12, -21], [-10, -28], [12, -28], [14, -21]]);
      rivets([[-18, -18], [-8, -18], [2, -18], [12, -18], [-6, -25], [6, -25]]);
    } else if (type === TankType.Artillery) { // a long barrel on a light body
      cannon(4, -18, 36, 3.4);
      poly(body, [[-W + 2, -11], [-W + 6, -17], [W - 4, -17], [W - 1, -11]]);
      poly(light, [[-2, -17], [0, -22], [9, -22], [11, -17]]);
      rivets([[-14, -14], [-4, -14], [6, -14], [16, -14]]);
    } else { // the Allrounder: one round turret
      cannon(3, -21, 26, 4);
      poly(body, [[-W + 1, -11], [-W + 5, -19], [W - 5, -19], [W - 1, -11]]);
      ctx.fillStyle = light; ctx.beginPath(); ctx.arc(2, -19, 9, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      rivets([[-14, -15], [-4, -15], [6, -15], [16, -15]]);
    }
  }
  poly(wreck ? WRECK : '#4a4a52', [[-W + 2, -TANK_H + 6], [-W + 6, -TANK_H + 6], [-W + 6, -TANK_H + 12], [-W + 2, -TANK_H + 12]]); // exhaust
  if (gear.missile) { ctx.translate(-4, -TANK_H - 6); missile(ctx); }
  ctx.restore();
}

const PIXEL_SCALE = TANK_W / 58; // world units per sprite design unit (the sprite's body is 58 units long)
const css = (c: number[]) => `rgb(${c.join(',')})`;
/** The arcade tank: its cannon (pixel colours, at the tank's angle) behind the pixel-art body sprite. */
function pixelTank(ctx: Ctx, type: TankType, variant: Variant, color: string, x: number, y: number, dir: number, angle: number, wreck: boolean, tilt: number, gear: Gear) {
  const S = PIXEL_SCALE, gun = gunOf(type, variant), shine = Math.sin((gear.time ?? 0) * SHINE_HZ * Math.PI * 2) > 0;
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(dir, 1);
  angle += dir * tilt * 180 / Math.PI;
  ctx.save(); ctx.translate((gun.x - SPRITE_W / 2) * S, (gun.y - SPRITE_GROUND) * S); ctx.rotate(-angle * Math.PI / 180);
  const metal: Ramp = wreck ? [[70, 66, 66], [52, 49, 49], [34, 32, 32]] : METAL;
  ctx.strokeStyle = css(PIXEL_OUTLINE); ctx.lineWidth = S * 0.8;
  const bar = (x0: number, y0: number, len: number, th: number) => {
    ctx.fillStyle = css(metal[1]); ctx.fillRect(x0, y0 - th / 2, len, th);
    ctx.fillStyle = css(metal[0]); ctx.fillRect(x0, y0 - th / 2, len, th * 0.3);
    ctx.fillStyle = css(metal[2]); ctx.fillRect(x0, y0 + th * 0.2, len, th * 0.3);
    ctx.strokeRect(x0, y0 - th / 2, len, th);
  };
  for (const [off, len, th] of gun.barrels) bar(0, off * S, len * S, th * S);
  const brake = gun.brake, muzzle = gun.barrels[0][1]; // on each full-length barrel
  if (brake) for (const [off, len] of gun.barrels) if (len === muzzle) bar((len - brake[0] / 2) * S, off * S, brake[0] * S, brake[1] * S);
  ctx.restore();
  const gold = shine ? GOLD_BRIGHT : GOLD;
  const sprite = tankSprite(type, variant, color, wreck, { wheels: gear.wheels ? gold : null, edge: gear.edge ? gold[1] : null });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sprite, -SPRITE_W / 2 * S, -SPRITE_GROUND * S, SPRITE_W * S, SPRITE_H * S);
  if (gear.missile) { ctx.translate(-4, -TANK_H - 4); missile(ctx); }
  ctx.restore();
}

/** A missile pointing right, centred on (0, 0): red body, white nose, fins. */
function missile(ctx: Ctx) {
  ctx.lineWidth = 1.4; ctx.strokeStyle = OUTLINE;
  ctx.fillStyle = '#e94b3c'; ctx.beginPath(); ctx.roundRect(-10, -3.5, 16, 7, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(6, -3.5); ctx.lineTo(13, 0); ctx.lineTo(6, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4a4a52'; ctx.beginPath(); ctx.moveTo(-10, -3.5); ctx.lineTo(-14, -7); ctx.lineTo(-6, -3.5); ctx.moveTo(-10, 3.5); ctx.lineTo(-14, 7); ctx.lineTo(-6, 3.5); ctx.fill(); ctx.stroke();
}

// repair kits' hearts rising from tanks: when each started (game time)
const cheers = new WeakMap<Battle, { id: number; at: number }[]>();
/** A heart rises from tank `id` and fades out above it (a repair kit picked up). */
export function cheer(b: Battle, id: number, time: number) { (cheers.get(b) ?? cheers.set(b, []).get(b)!).push({ id, at: time }); }

function heart(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
  ctx.fill(); ctx.stroke();
}

function crate(ctx: Ctx, x: number, y: number, falling: boolean) {
  const s = CRATE_SIZE;
  if (falling) { // a parachute
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y - s - 26, 22, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e94b3c'; ctx.beginPath(); ctx.arc(x, y - s - 26, 22, Math.PI, Math.PI * 1.33); ctx.lineTo(x, y - s - 26); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 22, y - s - 26); ctx.lineTo(x - s / 2, y - s); ctx.moveTo(x + 22, y - s - 26); ctx.lineTo(x + s / 2, y - s); ctx.stroke();
  }
  ctx.fillStyle = '#c8913e'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6;
  ctx.fillRect(x - s / 2, y - s, s, s); ctx.strokeRect(x - s / 2, y - s, s, s);
  ctx.beginPath(); ctx.moveTo(x - s / 2, y - s); ctx.lineTo(x + s / 2, y); ctx.moveTo(x + s / 2, y - s); ctx.lineTo(x - s / 2, y); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('?', x, y - s / 2 + 5);
}

/** The world → canvas transform for a w × h canvas: the whole field fits, centred. */
export const fit = (w: number, h: number) => { const k = Math.min(w / WORLD_W, h / WORLD_H); return { k, ox: (w - WORLD_W * k) / 2, oy: (h - WORLD_H * k) / 2 }; };

/** The whole battle. `time` (seconds) animates the arrow and smoke. */
export function drawBattle(ctx: Ctx, w: number, h: number, b: Battle, time: number, style: Style = Style.Normal) {
  const { k, ox, oy } = fit(w, h);
  const v: View = { x0: -ox / k, x1: (w - ox) / k, y0: -oy / k, y1: (h - oy) / k };
  ctx.setTransform(k, 0, 0, k, ox, oy);
  if (style === Style.Arcade) arcadeScenery(ctx, b.terrain.map, v); else scenery(ctx, SCENES[b.terrain.map], v);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, WORLD_W, WORLD_H); ctx.clip();
  ctx.imageSmoothingEnabled = style !== Style.Arcade; // arcade ground: crisp cells
  ctx.drawImage(groundLayer(b.terrain, style), 0, 0, GRID_W * CELL, GRID_H * CELL);
  for (const c of b.crates) crate(ctx, c.x, c.y, c.falling);
  const active = activeTank(b), aiming = b.phase !== Phase.Over && active.alive;
  for (const t of b.tanks) {
    if (t.gone) continue;
    if (t.alive && t.powerShell) { // a golden ring
      ctx.strokeStyle = gold(time); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(t.x, t.y - TANK_H / 2, TANK_W * 0.75, 0, Math.PI * 2); ctx.stroke();
    }
    const gear = t.alive ? { wheels: t.gripUntil !== null && t.gripUntil >= b.round, edge: t.shield, missile: t.missile, time } : {};
    drawTank(ctx, t.look, t.x, t.y, facing(t.side), t.angle, !t.alive, tiltOf(b, t), gear, style);
    if (!t.alive) { smoke(ctx, t.x, t.y - TANK_H, time); continue; }
    label(ctx, t, t === active && aiming, time, style);
  }
  if (b.shell) {
    const tr = b.shell.trail; // fading from the tank end to the shell (FR-004)
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 1; i < tr.length; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${(i / tr.length) * 0.9})`;
      ctx.beginPath(); ctx.moveTo(tr[i - 1][0], tr[i - 1][1]); ctx.lineTo(tr[i][0], tr[i][1]); ctx.stroke();
    }
    if (b.shell.missile) {
      ctx.save(); ctx.translate(b.shell.x, Math.max(6, b.shell.y)); ctx.rotate(Math.atan2(b.shell.vy, b.shell.vx));
      ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.moveTo(-14, -3); ctx.lineTo(-24 - Math.sin(time * 40) * 4, 0); ctx.lineTo(-14, 3); ctx.fill(); // flame
      ctx.scale(1.3, 1.3); missile(ctx); ctx.restore();
    } else { ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(b.shell.x, Math.max(6, b.shell.y), 5, 0, Math.PI * 2); ctx.fill(); }
    if (b.shell.y < 0) { ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.moveTo(b.shell.x, 2); ctx.lineTo(b.shell.x - 8, 16); ctx.lineTo(b.shell.x + 8, 16); ctx.fill(); }
  }
  if (b.boom && b.boom.t < 0.9) { // a cartoon explosion with smoke
    const { x, y, r, t } = b.boom, p = Math.min(1, t / 0.25);
    ctx.fillStyle = `rgba(80,70,70,${0.5 * (1 - t / 0.9)})`;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + Math.cos(i) * r * 0.6, y - t * 60 + Math.sin(i * 2) * r * 0.4, r * 0.5 * (0.6 + t), 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = `rgba(255,170,40,${1 - t / 0.9})`; ctx.beginPath(); ctx.arc(x, y, r * p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,240,120,${1 - t / 0.6})`; ctx.beginPath(); ctx.arc(x, y, r * p * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  const shown = cheers.get(b), live = shown?.filter(c => time - c.at < CHEER_S) ?? [];
  if (shown) { if (live.length) cheers.set(b, live); else cheers.delete(b); }
  for (const c of live) {
    const t = b.tanks[c.id], p = (time - c.at) / CHEER_S;
    ctx.globalAlpha = 1 - p; ctx.fillStyle = '#ff4d6d'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
    heart(ctx, t.x, t.y - TANK_H - 30 - p * 60, 10 + p * 4);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  edges(ctx, b.terrain, v, style);
}

/** The ground carrying on beside the field (at the height of its edge) and below it, so the scenery fills the canvas. */
function edges(ctx: Ctx, t: Terrain, v: View, style: Style) {
  const arcade = style === Style.Arcade;
  const earth = arcade ? css(ARC.dirt[3]) : `rgb(${RGB[Material.Earth].map(c => c * 0.6).join(',')})`;
  for (const [from, to, edgeX] of [[v.x0, 0, CELL / 2], [WORLD_W, v.x1, WORLD_W - CELL / 2]]) {
    if (to <= from) continue;
    const g = groundBelow(t, edgeX, 0), top = g ? g.y : WORLD_H;
    const rgb = arcade ? arcadeCell(g ? g.m : Material.Earth, 0, 0, 1) : !g || g.m === Material.Earth ? GRASS : RGB[g.m];
    ctx.fillStyle = earth; ctx.fillRect(from, top, to - from, v.y1 - top);
    ctx.fillStyle = `rgb(${rgb.join(',')})`; ctx.fillRect(from, top, to - from, CELL * 2);
  }
  if (v.y1 > WORLD_H) { ctx.fillStyle = earth; ctx.fillRect(v.x0, WORLD_H, v.x1 - v.x0, v.y1 - WORLD_H); }
}


function smoke(ctx: Ctx, x: number, y: number, time: number) {
  ctx.fillStyle = 'rgba(90,90,90,0.35)';
  for (let i = 0; i < 3; i++) {
    const p = (time * 0.6 + i / 3) % 1;
    ctx.beginPath(); ctx.arc(x + Math.sin(p * 6 + i) * 6, y - p * 40, 5 + p * 8, 0, Math.PI * 2); ctx.fill();
  }
}

// the name and health bar over a tank (FR-019), and the active tank's bobbing arrow (FR-023)
const LABEL_FONT: Record<Style, string> = { [Style.Normal]: 'bold 13px system-ui', [Style.Arcade]: "9px 'Press Start 2P', monospace" };
function label(ctx: Ctx, t: Tank, active: boolean, time: number, style: Style) {
  const bw = 44, bh = 6, by = t.y - TANK_H - 16, frac = Math.max(0, t.hearts) / specOf(t.look).hearts;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(t.x - bw / 2 - 1, by - 1, bw + 2, bh + 2);
  ctx.fillStyle = t.look.color; ctx.fillRect(t.x - bw / 2, by, bw * frac, bh);
  ctx.font = LABEL_FONT[style]; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(t.look.name, t.x, by - 5); ctx.fillStyle = '#ffffff'; ctx.fillText(t.look.name, t.x, by - 5);
  if (!active) return;
  const ay = by - 30 + Math.sin(time * 6) * 4;
  ctx.fillStyle = '#ffeb3b'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(t.x - 9, ay); ctx.lineTo(t.x + 9, ay); ctx.lineTo(t.x, ay + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
}

/** The garage preview: one tank, big, on a strip of grass. */
export function drawPreview(ctx: Ctx, look: Look, style: Style = Style.Normal) {
  const { width: w, height: h } = ctx.canvas, k = Math.min(w / (TANK_W * 2), h / (TANK_H * 2.2));
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = style === Style.Arcade ? css(ARC.grass[1]) : `rgb(${GRASS.join(',')})`; ctx.fillRect(0, h - 10, w, 10);
  ctx.setTransform(k, 0, 0, k, w / 2, h - 10);
  drawTank(ctx, look, 0, 0, 1, 35, false, 0, {}, style);
}

/** Icons for bonuses a tank holds, for the life panel. */
export const BONUS_ICON: Record<Drop, string> = { [Drop.Repair]: '🔧', [Drop.Power]: '💥', [Drop.GripGear]: '⛓️', [Drop.Shield]: '🛡️', [Drop.Missile]: '🚀' };
