// The 3D ground (specs/009-tank-semi-3d research R3): the breakable grid turned into surfaces, one column chunk at a
// time. Marching squares over the cells' centres smooth the 4-unit steps; the outline of all solid ground is pushed
// back GROUND_DEPTH into the scene to make its top strip, its sides and the walls of craters. Craters are told from the
// ground's own surface by comparing with the cells as the battle started (`original`). Pure: no DOM, no three.js.
// Coordinates are three.js's: x as the field, y up from the field's bottom, z towards the camera.
import { CELL, CHUNK_CELLS, GRID_H, GRID_W, GROUND_DEPTH, WOOD_BLAST_FACTOR, WORLD_H, WORLD_W } from './constants.ts';
import { GroundPart, Material } from './enums.ts';

export type PartMesh = { positions: number[]; normals: number[]; uvs: number[] };
export type ChunkMesh = Partial<Record<GroundPart, PartMesh>>;

const GRASS_CELLS = 2;     // earth this close under an untouched surface is grass
const BASE_BACK = 0.4;     // the solid backing sits this far behind the front faces, filling seams between materials
const WATER_BACK = 0.2;    // water's front sits just behind the ground's
const CRATER_BACK = 0.2;   // the back of a crater: where ground was, just in front of the slab's back
const UP = 0.5;            // a wall facing up at least this much is a top (grass, on untouched earth)
const UV_SCALE = 1 / 64;   // textures repeat every 64 units
const FRONT = GROUND_DEPTH / 2, BACK = -GROUND_DEPTH / 2;
const SQUARES = GRID_W + 1; // squares between neighbouring cell centres, including the half cells at the field's sides
/** How many chunks the ground is built in. */
export const CHUNKS = Math.ceil(SQUARES / CHUNK_CELLS);

type Cells = Uint8Array;
type P = [number, number];
// beyond the grid: the sides and bottom carry on as their edge cells, the sky is air
const cell = (c: Cells, i: number, j: number) => j < 0 ? Material.Air : c[Math.min(GRID_H - 1, j) * GRID_W + Math.max(0, Math.min(GRID_W - 1, i))];
const sx = (i: number) => Math.max(0, Math.min(WORLD_W, (i + 0.5) * CELL));
const sy = (j: number) => WORLD_H - Math.max(0, Math.min(WORLD_H, (j + 0.5) * CELL));
const solid = (m: number) => m !== Material.Air && m !== Material.Water;

function add(mesh: ChunkMesh, part: GroundPart, pts: number[][], n: number[], uv: (p: number[]) => number[]) {
  const m = mesh[part] ??= { positions: [], normals: [], uvs: [] };
  for (const p of pts) { m.positions.push(...p); m.normals.push(...n); m.uvs.push(...uv(p)); }
}
const frontUv = (p: number[]) => [p[0] * UV_SCALE, p[1] * UV_SCALE];
const wallUv = (p: number[]) => [(p[0] + p[1]) * UV_SCALE, p[2] * UV_SCALE];

// a square's corners (top left, top right, bottom right, bottom left) and where its edges cross from filled to empty,
// walked clockwise on screen: the filled part is the convex polygon of the filled corners and crossings
const CORNERS: P[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
type Square = { pts: P[]; segs: [P, P][]; filled: boolean[] };
function square(i: number, j: number, inside: (i: number, j: number) => boolean): Square | null {
  const filled = CORNERS.map(([di, dj]) => inside(i + di, j + dj));
  if (!filled.some(Boolean)) return null;
  const at = (k: number): P => [sx(i + CORNERS[k][0]), sy(j + CORNERS[k][1])];
  const pts: P[] = [], mids: boolean[] = [];
  for (let k = 0; k < 4; k++) {
    const a = at(k), b = at((k + 1) % 4);
    if (filled[k]) { pts.push(a); mids.push(false); }
    if (filled[k] !== filled[(k + 1) % 4]) { pts.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); mids.push(true); }
  }
  // the outline inside the square: polygon edges between two crossings
  const segs: [P, P][] = [];
  for (let k = 0; k < pts.length; k++) if (mids[k] && mids[(k + 1) % pts.length]) segs.push([pts[k], pts[(k + 1) % pts.length]]);
  return { pts, segs, filled };
}

/** A polygon's triangles (a fan; the polygons here are convex), facing the camera. */
function front(mesh: ChunkMesh, part: GroundPart, pts: P[], z: number) {
  for (let k = 1; k + 1 < pts.length; k++) {
    let [a, b, c] = [pts[0], pts[k], pts[k + 1]];
    if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) [b, c] = [c, b];
    add(mesh, part, [[...a, z], [...b, z], [...c, z]], [0, 0, 1], frontUv);
  }
}

/** An outline segment's direction away from the filled side (whose centre is `mid`), or null if it has no length. */
function outward([p, q]: [P, P], mid: P): P | null {
  const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const n: P = [dy / len, -dx / len];
  return n[0] * ((p[0] + q[0]) / 2 - mid[0]) + n[1] * ((p[1] + q[1]) / 2 - mid[1]) < 0 ? [-n[0], -n[1]] : n;
}

/** An outline segment pushed back through the ground's depth, facing along n. */
function wall(mesh: ChunkMesh, part: GroundPart, [p, q]: [P, P], n: P) {
  const quad = [[p[0], p[1], FRONT], [q[0], q[1], FRONT], [q[0], q[1], BACK], [p[0], p[1], BACK]];
  // wind the two triangles so they face along n: (b − a) × (c − a) · n > 0
  const [a, b, c] = quad, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const facing = (u[1] * v[2] - u[2] * v[1]) * n[0] + (u[2] * v[0] - u[0] * v[2]) * n[1];
  const order = facing > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
  add(mesh, part, order.map(k => quad[k]), [n[0], n[1], 0], wallUv);
}

/** Is this earth cell within GRASS_CELLS under a surface that hasn't been blown open? */
function grassy(c: Cells, o: Cells, i: number, j: number) {
  for (let k = 1; k <= GRASS_CELLS; k++) {
    const m = cell(c, i, j - k);
    if (m === Material.Air) return cell(o, i, j - k) === Material.Air;
    if (m !== Material.Earth) return false;
  }
  return false;
}

const PART: Partial<Record<number, GroundPart>> = { [Material.Snow]: GroundPart.Snow, [Material.Ice]: GroundPart.Ice, [Material.Wood]: GroundPart.Wood };

/** Chunk `index`'s surfaces, per ground part: the faces towards the camera, the solid ground's walls and top strip,
 *  and water. `cells` is the ground now, `original` as the battle began. */
export function chunkMesh(cells: Cells, original: Cells, index: number): ChunkMesh {
  const mesh: ChunkMesh = {}, k0 = index * CHUNK_CELLS, k1 = Math.min(SQUARES, k0 + CHUNK_CELLS);
  // squares wholly inside one material are merged into runs along the row: one quad each, no backing needed
  let run: { part: GroundPart; i0: number; i1: number; j: number } | null = null;
  const flush = () => {
    if (!run) return;
    const { part, i0, i1, j } = run;
    front(mesh, part, [[sx(i0), sy(j)], [sx(i1 + 1), sy(j)], [sx(i1 + 1), sy(j + 1)], [sx(i0), sy(j + 1)]], FRONT);
    run = null;
  };
  for (let j = -1; j < GRID_H; j++) for (let k = k0; k < k1; k++) {
    const i = k - 1; // the square between cell centres i and i + 1
    if (k === k0) flush();
    const corners = CORNERS.map(([di, dj]) => cell(cells, i + di, j + dj)), m0 = corners[0];
    if (solid(m0) && corners.every(c => c === m0)) {
      const part = m0 !== Material.Earth ? PART[m0]! : CORNERS.some(([di, dj]) => grassy(cells, original, i + di, j + dj)) ? GroundPart.Grass : GroundPart.Soil;
      if (run && run.part === part && run.j === j && run.i1 === i - 1) run.i1 = i;
      else { flush(); run = { part, i0: i, i1: i, j }; }
      continue;
    }
    flush();
    // a crater's back: looking into a hole, you see soil where the ground was, not through to the scenery
    const was = square(i, j, (a, b) => solid(cell(original, a, b)));
    if (was && CORNERS.some(([di, dj]) => solid(cell(original, i + di, j + dj)) && !solid(cell(cells, i + di, j + dj))))
      front(mesh, GroundPart.Soil, was.pts, BACK + CRATER_BACK);
    const base = square(i, j, (a, b) => solid(cell(cells, a, b)));
    if (!base) {
      const water = square(i, j, (a, b) => cell(cells, a, b) === Material.Water);
      if (water) front(mesh, GroundPart.Water, water.pts, FRONT - WATER_BACK);
      continue;
    }
    front(mesh, GroundPart.Soil, base.pts, FRONT - BASE_BACK); // backing under every material
    for (const m of [Material.Earth, Material.Snow, Material.Ice, Material.Wood]) {
      const sq = square(i, j, (a, b) => cell(cells, a, b) === m);
      if (!sq) continue;
      const grass = m === Material.Earth && CORNERS.some(([di, dj], c) => sq.filled[c] && grassy(cells, original, i + di, j + dj));
      front(mesh, m === Material.Earth ? (grass ? GroundPart.Grass : GroundPart.Soil) : PART[m]!, sq.pts, FRONT);
    }
    const water = square(i, j, (a, b) => cell(cells, a, b) === Material.Water);
    if (water) front(mesh, GroundPart.Water, water.pts, FRONT - WATER_BACK);
    if (!base.segs.length) continue;
    // walls take the look of the square's highest solid corner; earth facing up onto untouched sky is grass
    const filledAt = CORNERS.map(([di, dj], c) => base.filled[c] ? [i + di, j + dj] : null).filter((p): p is number[] => !!p);
    const top = filledAt.reduce((a, b) => b[1] < a[1] ? b : a), m = cell(cells, top[0], top[1]);
    const mid: P = [filledAt.reduce((s, p) => s + sx(p[0]), 0) / filledAt.length, filledAt.reduce((s, p) => s + sy(p[1]), 0) / filledAt.length];
    const opened = CORNERS.some(([di, dj], c) => !base.filled[c] && solid(cell(original, i + di, j + dj)));
    for (const seg of base.segs) {
      const n = outward(seg, mid);
      if (!n) continue;
      const part = m === Material.Earth ? (n[1] > UP && !opened ? GroundPart.Grass : GroundPart.Soil) : PART[m]!;
      wall(mesh, part, seg, n);
    }
  }
  flush();
  return mesh;
}

/** The chunks a blast at x with radius r can change (wood breaks further: research R3, `carve`). */
export function dirtyChunks(x: number, r: number): number[] {
  const reach = r * WOOD_BLAST_FACTOR, col = (v: number) => Math.floor(v / CELL);
  const clamp = (k: number) => Math.max(0, Math.min(SQUARES - 1, k));
  const k0 = clamp(col(x - reach)), k1 = clamp(col(x + reach) + 1); // a cell touches squares i and i + 1
  const out: number[] = [];
  for (let c = Math.floor(k0 / CHUNK_CELLS); c <= Math.floor(k1 / CHUNK_CELLS); c++) out.push(c);
  return out;
}
