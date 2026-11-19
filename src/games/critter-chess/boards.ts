// The three boards as tables (research R1–R3): cells, straight and diagonal rays, knight jumps, king steps, and each
// army's starting cells, pawn moves, promotion cells and castling. The rules, computer players and scene only read these.
import { CROSS_CORNER, CROSS_SIZE, HEX_BACK_Q, HEX_PAWN_Q, HEX_SIDE, PROMOTE_ROW, SQUARE } from './constants.ts';
import { BoardKind, PieceKind } from './enums.ts';

type V = [number, number];
/** One way to castle: where the king and rook end up, the cells that must be empty, and those that must not be attacked. */
export type Castle = { rook: number; kingTo: number; rookTo: number; empty: number[]; safe: number[] };
export type Army = {
  back: number[];                 // R N B Q K B N R, left to right as the army sees it
  pawns: number[];
  pawnStep: Int16Array;           // per cell: where a pawn of this army steps (−1: nowhere)
  pawnDouble: Int16Array;         // per cell: the two-step target from a starting cell (−1: none)
  pawnCaptures: number[][];       // per cell: where a pawn of this army captures
  promote: Uint8Array;            // per cell: 1 if a pawn of this army promotes on arriving there
  castles: Castle[];              // empty on the hexagon
};
export type Board = {
  kind: BoardKind; cells: V[]; pos: V[];
  straight: number[][][]; diagonal: number[][][]; knight: number[][]; king: number[][];
  armies: Army[];                 // clockwise from the near side
};
/** The back rank, left to right as the army sees it. */
export const BACK_RANK: PieceKind[] = [PieceKind.Rook, PieceKind.Knight, PieceKind.Bishop, PieceKind.Queen, PieceKind.King,
  PieceKind.Bishop, PieceKind.Knight, PieceKind.Rook];
const KING_AT = BACK_RANK.indexOf(PieceKind.King);

const key = ([a, b]: V) => `${a},${b}`;
const add = ([a, b]: V, [c, d]: V, k = 1): V => [a + c * k, b + d * k];

function tables(cells: V[], straightDirs: V[], diagonalDirs: V[], knightJumps: V[]) {
  const index = new Map(cells.map((c, i) => [key(c), i]));
  const at = (v: V) => index.get(key(v)) ?? -1;
  const rays = (dirs: V[]) => cells.map(c => dirs.map(d => {
    const ray: number[] = [];
    for (let k = 1, i = at(add(c, d)); i >= 0; i = at(add(c, d, ++k))) ray.push(i);
    return ray;
  }));
  const jumps = (list: V[]) => cells.map(c => list.map(d => at(add(c, d))).filter(i => i >= 0));
  return { at, straight: rays(straightDirs), diagonal: rays(diagonalDirs), knight: jumps(knightJumps), king: jumps([...straightDirs, ...diagonalDirs]) };
}

/** An army described by vectors: its back rank from a starting cell along its right, pawns one step forward (square boards). */
function squareArmy(n: number, at: (v: V) => number, start: V, right: V, forward: V, promoteAt: (c: V) => boolean, cells: V[]): Army {
  const back = BACK_RANK.map((_, i) => at(add(start, right, i)));
  const pawnRow = BACK_RANK.map((_, i) => add(add(start, right, i), forward));
  const step = new Int16Array(n).fill(-1), double = new Int16Array(n).fill(-1), promote = new Uint8Array(n);
  const captures: number[][] = cells.map(() => []);
  cells.forEach((c, i) => {
    step[i] = at(add(c, forward));
    captures[i] = [at(add(add(c, forward), right)), at(add(add(c, forward), right, -1))].filter(x => x >= 0);
    promote[i] = +promoteAt(c);
  });
  for (const c of pawnRow) if (at(add(c, forward)) >= 0) double[at(c)] = at(add(c, forward, 2));
  const king = back[KING_AT], castles: Castle[] = [];
  for (const [rookAt, dir] of [[back[BACK_RANK.length - 1], 1], [back[0], -1]] as const) {
    const between: number[] = [];
    for (let k = 1, c = at(add(start, right, KING_AT + dir)); c !== rookAt; c = at(add(start, right, KING_AT + dir * ++k))) between.push(c);
    const kingTo = at(add(start, right, KING_AT + 2 * dir)), rookTo = at(add(start, right, KING_AT + dir));
    castles.push({ rook: rookAt, kingTo, rookTo, empty: between, safe: [king, rookTo, kingTo] });
  }
  return { back, pawns: pawnRow.map(at), pawnStep: step, pawnDouble: double, pawnCaptures: captures, promote, castles };
}

const SQUARE_STRAIGHT: V[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const SQUARE_DIAGONAL: V[] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
const SQUARE_KNIGHT: V[] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

/** 2 players: the standard board; y = 0 is the near (first) army's back rank. */
function square(): Board {
  const cells: V[] = [];
  for (let y = 0; y < SQUARE; y++) for (let x = 0; x < SQUARE; x++) cells.push([x, y]);
  const t = tables(cells, SQUARE_STRAIGHT, SQUARE_DIAGONAL, SQUARE_KNIGHT), last = SQUARE - 1;
  const mid = last / 2;
  // both queens on the d-file (standard chess), so both armies list their back rank from the a-file
  const armies = [
    squareArmy(cells.length, t.at, [0, 0], [1, 0], [0, 1], c => c[1] === last, cells),
    squareArmy(cells.length, t.at, [0, last], [1, 0], [0, -1], c => c[1] === 0, cells),
  ];
  return { kind: BoardKind.Square, cells, pos: cells.map(([x, y]) => [x - mid, mid - y]), ...t, armies };
}

/** 4 players: 14 × 14 without the 3 × 3 corners; armies south, west, north, east (clockwise on screen). */
function cross(): Board {
  const n = CROSS_SIZE, c = CROSS_CORNER, last = n - 1, cells: V[] = [];
  const corner = (v: number) => v < c || v > last - c;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!(corner(x) && corner(y))) cells.push([x, y]);
  const t = tables(cells, SQUARE_STRAIGHT, SQUARE_DIAGONAL, SQUARE_KNIGHT), mid = last / 2;
  // each army sees its back rank left to right: queen on its own left of the king (research R2)
  const sides: [V, V, V, (v: V) => boolean][] = [
    [[c, 0], [1, 0], [0, 1], v => v[1] === PROMOTE_ROW],                       // south, facing north
    [[0, last - c], [0, -1], [1, 0], v => v[0] === PROMOTE_ROW],               // west, facing east
    [[last - c, last], [-1, 0], [0, -1], v => v[1] === last - PROMOTE_ROW],    // north, facing south
    [[last, c], [0, 1], [-1, 0], v => v[0] === last - PROMOTE_ROW],            // east, facing west
  ];
  const armies = sides.map(([start, right, forward, promote]) => squareArmy(cells.length, t.at, start, right, forward, promote, cells));
  return { kind: BoardKind.Cross, cells, pos: cells.map(([x, y]) => [x - mid, mid - y]), ...t, armies };
}

// the hexagon in axial coordinates (q, r); s = −q − r
const HEX_STRAIGHT: V[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const HEX_DIAGONAL: V[] = HEX_STRAIGHT.map((d, i) => add(d, HEX_STRAIGHT[(i + 1) % 6]));
const hexDist = ([q, r]: V) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
// the knight: the 12 cells three steps away that are on no straight line
const HEX_KNIGHT: V[] = [];
for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) if (hexDist([q, r]) === 3 && q !== 0 && r !== 0 && q + r !== 0) HEX_KNIGHT.push([q, r]);
/** Turns a hex vector 60° about the centre. */
const turn60 = ([q, r]: V): V => [-r, q + r];

/** 6 players: a hexagon of side 12. Army 0 sits on the near side (r = 9); the others are it turned by 60° steps. */
function hex(): Board {
  const R = HEX_SIDE - 1, cells: V[] = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (hexDist([q, r]) <= R) cells.push([q, r]);
  const t = tables(cells, HEX_STRAIGHT, HEX_DIAGONAL, HEX_KNIGHT), n = cells.length;
  const pos = cells.map(([q, r]) => [q + r / 2, r * Math.sqrt(3) / 2] as V);
  // army 0 on the near side (r = R): the back rank along that side, the pawns two rows in (r = R − 2). Two rows in,
  // because a hex diagonal skips a row: pawns one row in would leave each king facing the opposite queen down an open
  // diagonal. The offsets were searched so that no king starts in check and every capture possible on the first move
  // can be taken back. Pawns step straight ahead (1, −2) and capture on (1, −1) and (0, −1). (research R3)
  const back0: V[] = BACK_RANK.map((_, i) => [HEX_BACK_Q + i, R]);
  const pawns0: V[] = BACK_RANK.map((_, i) => [HEX_PAWN_Q + i, R - 2]);
  let vec = { step: [1, -2] as V, capA: [1, -1] as V, capB: [0, -1] as V }, back = back0, pawns = pawns0;
  const armies: Army[] = [];
  for (let a = 0; a < 6; a++) {
    const step = new Int16Array(n).fill(-1), double = new Int16Array(n).fill(-1), promote = new Uint8Array(n);
    const captures = cells.map(c => [t.at(add(c, vec.capA)), t.at(add(c, vec.capB))].filter(x => x >= 0));
    cells.forEach((c, i) => { step[i] = t.at(add(c, vec.step)); promote[i] = +(step[i] < 0); }); // no step ahead left: promote
    armies.push({ back: back.map(t.at), pawns: pawns.map(t.at), pawnStep: step, pawnDouble: double, pawnCaptures: captures, promote, castles: [] });
    back = back.map(turn60); pawns = pawns.map(turn60);
    vec = { step: turn60(vec.step), capA: turn60(vec.capA), capB: turn60(vec.capB) };
  }
  // clockwise on screen from the near side
  const angle = (army: Army) => {
    const x = army.back.reduce((s, i) => s + pos[i][0], 0), y = army.back.reduce((s, i) => s + pos[i][1], 0);
    return (Math.atan2(y, x) - Math.PI / 2 + 4 * Math.PI) % (2 * Math.PI);
  };
  armies.sort((a, b) => angle(a) - angle(b));
  return { kind: BoardKind.Hex, cells, pos, ...t, armies };
}

const cache = new Map<BoardKind, Board>();
export function boardOf(kind: BoardKind): Board {
  if (!cache.has(kind)) cache.set(kind, kind === BoardKind.Square ? square() : kind === BoardKind.Cross ? cross() : hex());
  return cache.get(kind)!;
}
/** The board for a player count: 2 → 8 × 8, 4 → cross, 6 → hexagon (FR-002). */
export const boardFor = (players: number) => boardOf(players === 2 ? BoardKind.Square : players === 4 ? BoardKind.Cross : BoardKind.Hex);
