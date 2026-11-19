// The rules (FR-003–FR-009, FR-022; research R2–R3): a new game, the legal moves of a creature (steps, hop chains,
// long hops over a type it beats, no hops over a type that beats it), applying a move, finishing, turn order, the
// stall rule and the final ranking. Pure and deterministic: every online device runs the same code on the same moves.
import { boardFor, homesFor, type Board } from './boards.ts';
import { PIECES, STALL_ROUNDS } from './constants.ts';
import { EndWhy, GameState, HopKind, SeatKind, type CritterType } from './enums.ts';
import { strong, weak } from './types.ts';

/** `slot`: online, the relay slot playing this seat (−1: a computer, or offline). */
export type Seat = { id: number; kind: SeatKind; type: CritterType; slot: number; home: number; target: number; place: number | null };
/** left: has ever left its home (the blocking rule); arrived: has ever been in its target (the stall rule). */
export type Piece = { id: number; seat: number; hole: number; leader: boolean; left: boolean; arrived: boolean };
export type Move = { piece: number; path: number[]; kinds: HopKind[] };
export type Game = {
  board: Board; seats: Seat[]; pieces: Piece[]; occupant: Int16Array;
  turn: number; round: number; stall: number; progress: boolean; hadPerson: boolean;
  state: GameState; order: number[]; why: EndWhy | null;
};
export type SeatSpec = { kind: SeatKind; type: CritterType; slot?: number };

/** A game for 2, 4 or 6 seats, in turn (clockwise) order; seat i starts in the i-th home this player count uses. */
export function newGame(specs: SeatSpec[]): Game {
  const board = boardFor(specs.length), homes = homesFor(specs.length);
  const seats: Seat[] = specs.map((s, id) => ({ id, kind: s.kind, type: s.type, slot: s.slot ?? -1, home: homes[id],
    target: board.opposite[homes[id]], place: null }));
  const occupant = new Int16Array(board.holes.length).fill(-1);
  const pieces: Piece[] = seats.flatMap(s => board.homes[s.home].map((hole, n) => {
    const id = s.id * PIECES + n;
    occupant[hole] = id;
    return { id, seat: s.id, hole, leader: n === 0, left: false, arrived: false };
  }));
  return { board, seats, pieces, occupant, turn: 0, round: 1, stall: 0, progress: false,
    hadPerson: seats.some(s => s.kind === SeatKind.Person), state: GameState.Playing, order: [], why: null };
}

const typeOf = (g: Game, piece: number) => g.seats[g.pieces[piece].seat].type;
const inHome = (g: Game, home: number, hole: number) => g.board.homes[home].includes(hole);

/** Every move a creature can make this turn, one per destination (a plain step when a hop could land there too). */
export function legalMoves(g: Game, pieceId: number): Move[] {
  const start = g.pieces[pieceId].hole, me = typeOf(g, pieceId), rays = g.board.rays;
  const occ = (h: number) => h !== start && g.occupant[h] >= 0; // the mover has left its hole
  const moves: Move[] = [], dests = new Set<number>([start]);
  for (const ray of rays[start]) if (ray.length && !occ(ray[0])) { moves.push({ piece: pieceId, path: [start, ray[0]], kinds: [HopKind.Step] }); dests.add(ray[0]); }
  const seen = new Set([start]), queue: Move[] = [{ piece: pieceId, path: [start], kinds: [] }];
  while (queue.length) {
    const cur = queue.shift()!, at = cur.path[cur.path.length - 1];
    for (const ray of rays[at]) {
      const i = ray.findIndex(occ);
      if (i < 0) continue;
      const other = typeOf(g, g.occupant[ray[i]]), d = i + 1;
      if (weak(me, other)) continue;                    // blocked hop (FR-009)
      const kind = d === 1 ? HopKind.Hop : strong(me, other) ? HopKind.LongHop : null;
      const land = 2 * d - 1;
      if (!kind || land >= ray.length || ray.slice(d, land + 1).some(occ) || seen.has(ray[land])) continue;
      seen.add(ray[land]);
      const next = { piece: pieceId, path: [...cur.path, ray[land]], kinds: [...cur.kinds, kind] };
      queue.push(next);
      if (!dests.has(ray[land])) { dests.add(ray[land]); moves.push(next); }
    }
  }
  return moves;
}

/** Every move of a seat's creatures. */
export const movesOf = (g: Game, seat: number) => g.pieces.filter(p => p.seat === seat).flatMap(p => legalMoves(g, p.id));

/** The move if it is legal for that seat now (its turn, its creature, a path the rules give), else null. */
export function findMove(g: Game, seat: number, piece: number, path: readonly number[]): Move | null {
  if (g.state !== GameState.Playing || g.turn !== seat || g.pieces[piece]?.seat !== seat) return null;
  return legalMoves(g, piece).find(m => m.path.length === path.length && m.path.every((h, i) => h === path[i])) ?? null;
}

/** Has a seat filled its target? Every hole taken, at least one by its own, the rest by creatures that never left. */
export function finished(g: Game, seat: number) {
  const s = g.seats[seat];
  let own = 0;
  for (const hole of g.board.homes[s.target]) {
    const id = g.occupant[hole];
    if (id < 0) return false;
    const p = g.pieces[id];
    if (p.seat === seat) own++; else if (p.left) return false;
  }
  return own > 0;
}

/** Rows still to go for a seat's creatures (less is better; ranks unfinished players). */
export const rowsLeft = (g: Game, seat: number) =>
  g.pieces.filter(p => p.seat === seat).reduce((sum, p) => sum + g.board.rows[g.seats[seat].target][p.hole], 0);
/** A seat's creatures in its target. */
export const inTarget = (g: Game, seat: number) =>
  g.pieces.filter(p => p.seat === seat && inHome(g, g.seats[seat].target, p.hole)).length;

function place(g: Game, seat: number) { g.seats[seat].place = g.order.length + 1; g.order.push(seat); }
function end(g: Game, why: EndWhy) {
  const rest = g.seats.filter(s => s.place === null)
    .sort((a, b) => inTarget(g, b.id) - inTarget(g, a.id) || rowsLeft(g, a.id) - rowsLeft(g, b.id) || a.id - b.id);
  for (const s of rest) place(g, s.id);
  g.state = GameState.Over; g.why = why;
}
/** "End game": rank everyone still playing as the stall rule does. */
export const endNow = (g: Game) => end(g, EndWhy.Ended);

/** After applying a move: who finished with it, and seats skipped because they had no move. */
export type Applied = { finished: boolean; skipped: number[] };

/** Plays a legal move (see findMove) and passes the turn on. */
export function applyMove(g: Game, m: Move): Applied {
  const p = g.pieces[m.piece], s = g.seats[p.seat], to = m.path[m.path.length - 1];
  g.occupant[p.hole] = -1; g.occupant[to] = p.id; p.hole = to;
  if (!inHome(g, s.home, to)) p.left = true;
  if (!p.arrived && inHome(g, s.target, to)) { p.arrived = true; g.progress = true; }
  const done = finished(g, s.id);
  if (done) place(g, s.id);
  const open = g.seats.filter(x => x.place === null);
  if (open.length <= 1 || (g.hadPerson && !open.some(x => x.kind === SeatKind.Person))) { end(g, EndWhy.Done); return { finished: done, skipped: [] }; }
  return { finished: done, skipped: advance(g) };
}

/** The next seat still playing that can move, clockwise; a full round ends each time the turn passes seat 0. */
function advance(g: Game): number[] {
  const skipped: number[] = [];
  let i = g.turn, wrapped = false;
  for (let k = 0; k < 2 * g.seats.length; k++) {
    i = (i + 1) % g.seats.length;
    if (i === 0 && !wrapped) { wrapped = true; if (endRound(g)) return skipped; } // one round per pass, however many seats skip
    if (g.seats[i].place !== null) continue;
    if (!movesOf(g, i).length) { skipped.push(i); continue; }
    g.turn = i;
    return skipped;
  }
  end(g, EndWhy.Stall); // nobody can move at all
  return skipped;
}
/** True if the stall rule ended the game. The count starts once any creature has reached its target (before that,
 *  every game is still on its way there). */
function endRound(g: Game) {
  const started = g.pieces.some(p => p.arrived);
  g.stall = g.progress || !started ? 0 : g.stall + 1;
  g.progress = false; g.round++;
  if (g.stall < STALL_ROUNDS) return false;
  end(g, EndWhy.Stall);
  return true;
}
