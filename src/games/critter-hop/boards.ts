// The two boards as plain tables (research R1): the star (121 holes, 6 directions) for 2 and 6 players and the cross
// (105 holes, 8 directions) for 4. Rules, computer players, the keyboard cursor and the 3D scene only read these.
import { CROSS_ARM, CROSS_HALF, CROSS_HOME_ROWS, STAR_SIDE } from './constants.ts';
import { BoardKind } from './enums.ts';

export type Board = {
  kind: BoardKind;
  holes: [number, number][];      // star: axial (q, r); cross: (x, y)
  pos: [number, number][];        // flat layout, one unit between neighbours; y grows toward the near player
  dirs: [number, number][];
  rays: number[][][];             // rays[hole][dir]: the holes in that direction, nearest first
  homes: number[][];              // clockwise from the near side; each holds 10 holes
  opposite: number[];             // home → the home it races to
  rows: number[][];               // rows[home][hole]: rows still to go before reaching `home`'s outer row (0 = there)
  tips: number[];                 // each home's outermost (tip) hole
};

const key = (a: number, b: number) => `${a},${b}`;
const HEX_DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const SQUARE_DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];

function build(kind: BoardKind, holes: [number, number][], pos: [number, number][], dirs: [number, number][],
  homeOf: (h: [number, number]) => number, rowsTo: (home: number, h: [number, number]) => number, homeCount: number): Board {
  const index = new Map(holes.map((h, i) => [key(...h), i]));
  const rays = holes.map(([a, b]) => dirs.map(([da, db]) => {
    const ray: number[] = [];
    for (let k = 1, i = index.get(key(a + da * k, b + db * k)); i !== undefined; i = index.get(key(a + da * ++k, b + db * k))) ray.push(i);
    return ray;
  }));
  const raw = Array.from({ length: homeCount }, (_, n) => holes.map((h, i) => homeOf(h) === n ? i : -1).filter(i => i >= 0));
  // clockwise on screen (y toward the near player), starting with the nearest home
  const angle = (home: number[]) => {
    const x = home.reduce((s, i) => s + pos[i][0], 0), y = home.reduce((s, i) => s + pos[i][1], 0);
    return (Math.atan2(y, x) - Math.PI / 2 + 4 * Math.PI) % (2 * Math.PI);
  };
  const order = raw.map((_, n) => n).sort((a, b) => angle(raw[a]) - angle(raw[b]));
  const homes = order.map(n => raw[n]);
  const rows = order.map(n => holes.map(h => rowsTo(n, h)));
  // the tip: the outer-row hole nearest the home's centre line (the star's single tip; the cross's middle hole)
  const tips = homes.map((home, h) => home.filter(i => rows[h][i] === 0)
    .reduce((best, i) => lateral(pos, i, home) < lateral(pos, best, home) ? i : best));
  const half = homeCount / 2;
  return { kind, holes, pos, dirs, rays, homes, opposite: homes.map((_, h) => (h + half) % homeCount), rows, tips };
}
// how far a hole is from its home's centre line (tip choice on the cross, where the outer row has five holes)
function lateral(pos: [number, number][], i: number, home: number[]) {
  const cx = home.reduce((s, j) => s + pos[j][0], 0) / home.length, cy = home.reduce((s, j) => s + pos[j][1], 0) / home.length;
  const len = Math.hypot(cx, cy);
  return Math.abs(pos[i][0] * cy / len - pos[i][1] * cx / len);
}

/** The six-pointed star: every (q, r, s = −q−r) with all three ≥ −4 or all three ≤ 4. */
function star(): Board {
  const n = STAR_SIDE, far = 2 * n, holes: [number, number][] = [];
  for (let q = -far; q <= far; q++) for (let r = -far; r <= far; r++) {
    const c = [q, r, -q - r];
    if (c.every(v => v >= -n) || c.every(v => v <= n)) holes.push([q, r]);
  }
  const pos = holes.map(([q, r]) => [q + r / 2, r * Math.sqrt(3) / 2] as [number, number]);
  // homes 0–5 before sorting: coordinate (q, r, s) and sign; the point where that coordinate passes 4
  const axis = (h: number) => ({ c: h % 3, sign: h < 3 ? 1 : -1 });
  const coord = ([q, r]: [number, number], c: number) => [q, r, -q - r][c];
  const homeOf = (h: [number, number]) => { for (let n6 = 0; n6 < 6; n6++) { const { c, sign } = axis(n6); if (sign * coord(h, c) > n) return n6; } return -1; };
  const rowsTo = (home: number, h: [number, number]) => { const { c, sign } = axis(home); return far - sign * coord(h, c); };
  return build(BoardKind.Star, holes, pos, HEX_DIRS, homeOf, rowsTo, 6);
}

/** The cross: a 5 × 5 centre with four arms 5 wide and 4 deep; a home is an arm's outer 2 rows. */
function cross(): Board {
  const c = CROSS_HALF, end = CROSS_HALF + CROSS_ARM, holes: [number, number][] = [];
  for (let x = -end; x <= end; x++) for (let y = -end; y <= end; y++) if (Math.abs(x) <= c || Math.abs(y) <= c) holes.push([x, y]);
  const pos = holes.map(([x, y]) => [x, y] as [number, number]);
  const axis = (h: number) => ({ c: h % 2, sign: h < 2 ? 1 : -1 });
  const homeOf = (h: [number, number]) => { for (let n4 = 0; n4 < 4; n4++) { const { c: a, sign } = axis(n4); if (sign * h[a] > end - CROSS_HOME_ROWS) return n4; } return -1; };
  const rowsTo = (home: number, h: [number, number]) => { const { c: a, sign } = axis(home); return end - sign * h[a]; };
  return build(BoardKind.Cross, holes, pos, SQUARE_DIRS, homeOf, rowsTo, 4);
}

const cache = new Map<BoardKind, Board>();
/** The board of a kind, built once. */
export function boardOf(kind: BoardKind): Board {
  if (!cache.has(kind)) cache.set(kind, kind === BoardKind.Star ? star() : cross());
  return cache.get(kind)!;
}
/** The board a game of `players` uses: the cross for 4, the star otherwise (FR-003). */
export const boardFor = (players: number) => boardOf(players === 4 ? BoardKind.Cross : BoardKind.Star);
/** The homes a game of `players` uses, in turn order: 2 → opposite points, 4 and 6 → all. */
export const homesFor = (players: number) => players === 2 ? [0, 3] : Array.from({ length: players }, (_, i) => i);

/** Steps between two holes: hex distance on the star, king's-move distance on the cross. */
export function distance(board: Board, a: number, b: number) {
  const [a0, a1] = board.holes[a], [b0, b1] = board.holes[b], d0 = a0 - b0, d1 = a1 - b1;
  return board.kind === BoardKind.Star ? (Math.abs(d0) + Math.abs(d1) + Math.abs(d0 + d1)) / 2 : Math.max(Math.abs(d0), Math.abs(d1));
}
