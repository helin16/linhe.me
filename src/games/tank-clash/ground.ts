// The 3D ground (specs/009-tank-semi-3d research R3): the breakable grid turned into smooth surfaces. Each piece of
// ground (a hill, a bridge, a crater's rim; water on its own) is traced as closed outlines with marching squares —
// inside exactly where the cells are, so what's drawn matches what the battle uses — then each outline is smoothed as
// a whole curve, so slopes are smooth lines whatever their steepness, not 4-unit steps. The outlines are filled for the
// faces towards the camera and pushed back through the ground's depth for its top strip and walls, shaded smoothly
// along them. Materials (earth, snow, ice, wood, the grass band) are painted on by the ground's shader (scene.ts).
// Pure (no DOM): three.js is used only for its polygon filler. Coordinates are three.js's: x as the field, y up from the
// field's bottom, z towards the camera.
import { ShapeUtils, Vector2 } from 'three';
import { CELL, GRID_H, GRID_W, GROUND_DEPTH, WORLD_H } from './constants.ts';
import { Material } from './enums.ts';

export type Surface = { positions: number[]; normals: number[]; uvs: number[] };
/** The ground's surfaces: the solid ground (front faces and walls), the back showing inside craters, and water. */
export type GroundMesh = { solid: Surface; back: Surface; water: Surface };

const FRONT = GROUND_DEPTH / 2, BACK = -GROUND_DEPTH / 2;
const CRATER_BACK = 0.2;   // the back of a crater: where ground was, just in front of the slab's back
const WATER_BACK = 0.2;    // water's front sits just behind the ground's
const UV_SCALE = 1 / 64;   // textures repeat every 64 units
const HALF = 0.5, INSIDE = 0.65, OUTSIDE = 0.35; // corner values: inside at or above a half; never closer to it than these
const SMOOTH_PASSES = 4;   // rounds of moving each outline point towards its neighbours
const SMOOTH_REACH = 1;    // ... but never further than this from where the cells put it: a one-cell wall's two sides
                           // (4 apart) never cross, and thin ledges keep their shape
const SHARP = 0.35;        // outline pieces meeting at a sharper corner than this (≈70°) keep their own wall normals

type P = [number, number];
type Grid = Uint8Array; // 1 where a cell is inside, 0 where it isn't
const solid = (m: number) => m !== Material.Air && m !== Material.Water;
const sx = (i: number) => (i + 0.5) * CELL;
const sy = (j: number) => WORLD_H - (j + 0.5) * CELL;
// outside the grid nothing is inside, so every outline closes (the sides and bottom close just past the field's edges,
// hidden by the ground carrying on beyond it: scene.ts)
const at = (g: Grid, i: number, j: number) => i < 0 || i >= GRID_W || j < 0 || j >= GRID_H ? 0 : g[j * GRID_W + i];

// each corner's value: how much of what's around it is inside, weighted towards the middle (1 2 1 / 2 4 2 / 1 2 1),
// kept on its own cell's side of a half; it only moves where the outline crosses between two corners
const BLEND: [number, number, number][] = [[-1, -1, 1], [0, -1, 2], [1, -1, 1], [-1, 0, 2], [0, 0, 4], [1, 0, 2], [-1, 1, 1], [0, 1, 2], [1, 1, 1]];
function value(g: Grid, i: number, j: number) {
  let v = 0;
  for (const [di, dj, w] of BLEND) v += at(g, i + di, j + dj) * w;
  return at(g, i, j) ? Math.max(v / 16, INSIDE) : Math.min(v / 16, OUTSIDE);
}

const CORNERS: P[] = [[0, 0], [1, 0], [1, 1], [0, 1]]; // top left, top right, bottom right, bottom left (rows go down)
/** The outlines of what's inside `g`: closed loops with the inside on their left (anticlockwise around ground). */
export function outlines(g: Grid): P[][] {
  const next = new Map<string, P[]>(), key = (p: P) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  for (let j = -1; j < GRID_H; j++) for (let i = -1; i < GRID_W; i++) {
    const inside = CORNERS.map(([di, dj]) => at(g, i + di, j + dj) === 1);
    if (inside.every(Boolean) || !inside.some(Boolean)) continue;
    const v = CORNERS.map(([di, dj]) => value(g, i + di, j + dj)), pos = (k: number): P => [sx(i + CORNERS[k][0]), sy(j + CORNERS[k][1])];
    // walking the square's edge (clockwise with y up), the filled part's crossings pair up into outline pieces
    const pts: { p: P; cross: boolean }[] = [];
    for (let k = 0; k < 4; k++) {
      const n = (k + 1) % 4, a = pos(k), b = pos(n);
      if (inside[k]) pts.push({ p: a, cross: false });
      if (inside[k] !== inside[n]) { const t = (HALF - v[k]) / (v[n] - v[k]); pts.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], cross: true }); }
    }
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      if (a.cross && b.cross) (next.get(key(a.p)) ?? next.set(key(a.p), []).get(key(a.p))!).push(b.p); // a → b, inside on the right
    }
  }
  const loops: P[][] = [];
  for (const [start, ends] of next) while (ends.length) { // follow each piece's end to the next piece's start
    const loop: P[] = [];
    let p = ends.pop()!, guard = 0;
    while (key(p) !== start && guard++ < 1e6) { loop.push(p); const more = next.get(key(p)); if (!more?.length) break; p = more.pop()!; }
    loop.push(p);
    if (loop.length >= 3) loops.push(loop.reverse()); // turned round: the inside on the left
  }
  return loops;
}

/** An outline smoothed as a curve: each point moves towards its neighbours, but no further than SMOOTH_REACH. */
export function smooth(loop: P[]): P[] {
  let pts = loop;
  for (let pass = 0; pass < SMOOTH_PASSES; pass++) pts = pts.map((p, k) => {
    const a = pts[(k + pts.length - 1) % pts.length], b = pts[(k + 1) % pts.length], o = loop[k];
    let x = p[0] * 0.5 + (a[0] + b[0]) * 0.25, y = p[1] * 0.5 + (a[1] + b[1]) * 0.25;
    const d = Math.hypot(x - o[0], y - o[1]);
    if (d > SMOOTH_REACH) { x = o[0] + (x - o[0]) * SMOOTH_REACH / d; y = o[1] + (y - o[1]) * SMOOTH_REACH / d; }
    return [x, y];
  });
  return pts;
}
const area = (loop: P[]) => loop.reduce((s, p, k) => { const q = loop[(k + 1) % loop.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
function contains(loop: P[], [x, y]: P) {
  let c = false;
  for (let k = 0, l = loop.length - 1; k < loop.length; l = k++) {
    const [xa, ya] = loop[k], [xb, yb] = loop[l];
    if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c;
  }
  return c;
}

const empty = (): Surface => ({ positions: [], normals: [], uvs: [] });
/** Fills the outlines at depth z, facing the camera: ground loops with the holes inside them (craters, tunnels). */
function fill(out: Surface, loops: P[][], z: number) {
  const outer = loops.filter(l => area(l) > 0), holes = loops.filter(l => area(l) < 0);
  const holesOf = new Map<P[], P[][]>(outer.map(l => [l, []]));
  for (const h of holes) { // each hole belongs to the smallest ground loop around it
    const around = outer.filter(l => contains(l, h[0])).sort((a, b) => area(a) - area(b))[0];
    if (around) holesOf.get(around)!.push(h);
  }
  for (const [l, hs] of holesOf) {
    const v = (loop: P[]) => loop.map(([x, y]) => new Vector2(x, y)), contour = v(l), inner = hs.map(v);
    const tris = ShapeUtils.triangulateShape(contour, inner); // (it may trim the arrays it is given: index into those)
    const flat = [contour, ...inner].flat().map((p): P => [p.x, p.y]);
    for (const tri of tris) {
      const [a, b, c] = tri.map(k => flat[k]), ccw = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0;
      for (const p of ccw ? [a, b, c] : [a, c, b]) { out.positions.push(p[0], p[1], z); out.normals.push(0, 0, 1); out.uvs.push(p[0] * UV_SCALE, p[1] * UV_SCALE); }
    }
  }
}
/** Pushes the outlines back through the ground's depth: its top strip and walls, facing out, normals smoothed along. */
function walls(out: Surface, loops: P[][]) {
  for (const loop of loops) {
    const n = loop.map((p, k): P => { // each piece's outward normal (the inside is on the left)
      const q = loop[(k + 1) % loop.length], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
      return [dy / len, -dx / len];
    });
    const at = (k: number, own: P): P => { // a point's normal: the average of the two pieces meeting there, unless sharp
      const a = n[(k + loop.length - 1) % loop.length], b = n[k % loop.length], s = [a[0] + b[0], a[1] + b[1]], len = Math.hypot(s[0], s[1]);
      return len > 1e-6 && (s[0] * own[0] + s[1] * own[1]) / len > SHARP ? [s[0] / len, s[1] / len] : own;
    };
    for (let k = 0; k < loop.length; k++) {
      const p = loop[k], q = loop[(k + 1) % loop.length], np = at(k, n[k]), nq = at(k + 1, n[k]);
      const quad = [[p[0], p[1], FRONT], [q[0], q[1], FRONT], [q[0], q[1], BACK], [p[0], p[1], BACK]], ns = [np, nq, nq, np];
      for (const v of [0, 2, 1, 0, 3, 2]) { // wound to face outwards
        out.positions.push(...quad[v]); out.normals.push(ns[v][0], ns[v][1], 0); out.uvs.push((quad[v][0] + quad[v][1]) * UV_SCALE, quad[v][2] * UV_SCALE);
      }
    }
  }
}

const grid = (cells: Uint8Array, inside: (m: number, k: number) => boolean) => { const g = new Uint8Array(cells.length); cells.forEach((m, k) => { g[k] = +inside(m, k); }); return g; };

const NEXT_TO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const near = (g: Grid, k: number) => NEXT_TO.some(([di, dj]) => at(g, k % GRID_W + di, Math.floor(k / GRID_W) + dj) === 1);

/** The ground's surfaces from the cells now and as the battle began (`original`: crater backs show where ground was,
 *  reaching a cell under the ground beside them, so no gap shows at a crater's edge). */
export function groundMesh(cells: Uint8Array, original: Uint8Array): GroundMesh {
  const mesh: GroundMesh = { solid: empty(), back: empty(), water: empty() };
  const now = outlines(grid(cells, solid)).map(smooth);
  fill(mesh.solid, now, FRONT);
  walls(mesh.solid, now);
  const gone = grid(cells, (m, k) => solid(original[k]) && !solid(m));
  fill(mesh.back, outlines(grid(cells, (m, k) => gone[k] === 1 || (solid(original[k]) && near(gone, k)))).map(smooth), BACK + CRATER_BACK);
  // water reaches a cell under the ground beside it, so its edge tucks under the ground's (which is drawn in front)
  const wet = grid(cells, m => m === Material.Water);
  const water = grid(cells, (m, k) => m === Material.Water || (solid(m) && near(wet, k)));
  fill(mesh.water, outlines(water).map(smooth), FRONT - WATER_BACK);
  return mesh;
}
