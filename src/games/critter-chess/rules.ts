// The rules (FR-004–FR-009; research R4): legal moves on any board (a move may never leave its own king attacked by any
// player still in), castling, en passant (2 players), promotion, check, checkmate (out, or the end in 2 players),
// stalemate (a draw in 2 players, a skipped turn in 4/6), king captures in 4/6, resigning, the draw rules, and the
// places. Pure and deterministic: every online device plays the same moves to the same result.
import { BACK_RANK, boardFor, type Board, type Castle } from './boards.ts';
import { NO_PROGRESS_PLIES, NO_PROGRESS_ROUNDS, REPEATS } from './constants.ts';
import { EndWhy, GameState, PieceKind, SeatKind, SeatState, type CritterType } from './enums.ts';

/** slot: online, the relay slot playing the seat (−1: a computer, or offline). */
export type Seat = { id: number; kind: SeatKind; type: CritterType; slot: number; state: SeatState; place: number | null };
/** cell −1: off the board (captured, or its player is out). moved: for castling. */
export type Piece = { id: number; seat: number; kind: PieceKind; cell: number; moved: boolean };
export type Move = { piece: number; from: number; to: number; capture: number; promo?: PieceKind; castle?: Castle; ep?: boolean };
export type Game = {
  board: Board; seats: Seat[]; pieces: Piece[]; at: Int16Array; turn: number;
  ep: number; epPawn: number;     // en passant (2 players): the cell passed over and the pawn that passed it
  quiet: number;                  // plies since a capture or a pawn move
  keys: Map<string, number>;      // positions seen (threefold repetition, 2 players)
  state: GameState; why: EndWhy | null; order: number[];
};
export type SeatSpec = { kind: SeatKind; type: CritterType; slot?: number };
export type PieceSpec = { seat: number; kind: PieceKind; cell: number; moved?: boolean };
/** What a move (or a resignation) did: who went out (mated, king taken, resigned), who was skipped (stalemate, 4/6). */
export type Events = { outs: number[]; skipped: number[] };

export const PROMOTIONS = [PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight];
const SLIDES: Partial<Record<PieceKind, ('straight' | 'diagonal')[]>> = {
  [PieceKind.Rook]: ['straight'], [PieceKind.Bishop]: ['diagonal'], [PieceKind.Queen]: ['straight', 'diagonal'],
};
const playing = (g: Game) => g.seats.filter(s => s.state === SeatState.Playing);

/** A new game for 2, 4 or 6 seats in turn (clockwise) order; seat i plays army i of the board for that count. */
export function newGame(specs: SeatSpec[]): Game {
  const board = boardFor(specs.length);
  const g: Game = {
    board, seats: specs.map((s, id) => ({ id, kind: s.kind, type: s.type, slot: s.slot ?? -1, state: SeatState.Playing, place: null })),
    pieces: [], at: new Int16Array(board.cells.length), turn: 0, ep: -1, epPawn: -1, quiet: 0, keys: new Map(),
    state: GameState.Playing, why: null, order: [],
  };
  setPieces(g, specs.flatMap((_, seat) => [
    ...board.armies[seat].back.map((cell, i) => ({ seat, kind: BACK_RANK[i], cell })),
    ...board.armies[seat].pawns.map(cell => ({ seat, kind: PieceKind.Pawn, cell })),
  ]));
  return g;
}
/** Puts exactly these pieces on the board (a new game, a rejoiner's sync, or a test position). */
export function setPieces(g: Game, list: PieceSpec[]) {
  g.at.fill(-1);
  g.pieces = list.map((p, id) => ({ id, seat: p.seat, kind: p.kind, cell: p.cell, moved: !!p.moved }));
  for (const p of g.pieces) g.at[p.cell] = p.id;
  g.keys = new Map([[positionKey(g), 1]]);
}

const enemyAt = (g: Game, cell: number, seat: number) => cell >= 0 && g.at[cell] >= 0 && g.pieces[g.at[cell]].seat !== seat;
const kingOf = (g: Game, seat: number) => g.pieces.find(p => p.seat === seat && p.kind === PieceKind.King && p.cell >= 0);

/** Is a cell attacked by any piece whose seat passes `by`? */
export function attackedBy(g: Game, cell: number, by: (seat: number) => boolean) {
  const b = g.board, who = (c: number) => g.pieces[g.at[c]];
  const hits = (rays: number[][], kinds: PieceKind[]) => rays.some(ray => {
    for (const c of ray) if (g.at[c] >= 0) { const p = who(c); return by(p.seat) && kinds.includes(p.kind); }
    return false;
  });
  if (hits(b.straight[cell], [PieceKind.Rook, PieceKind.Queen]) || hits(b.diagonal[cell], [PieceKind.Bishop, PieceKind.Queen])) return true;
  if (b.knight[cell].some(c => g.at[c] >= 0 && by(who(c).seat) && who(c).kind === PieceKind.Knight)) return true;
  return b.king[cell].some(c => {
    if (g.at[c] < 0) return false;
    const p = who(c);
    return by(p.seat) && (p.kind === PieceKind.King || (p.kind === PieceKind.Pawn && b.armies[p.seat].pawnCaptures[c].includes(cell)));
  });
}
/** Is a cell attacked by any piece not belonging to `seat`? */
export const attacked = (g: Game, cell: number, seat: number) => attackedBy(g, cell, s => s !== seat);
export const inCheck = (g: Game, seat: number) => { const k = kingOf(g, seat); return !!k && attacked(g, k.cell, seat); };

/** A piece's moves by how pieces move, before checking that its own king stays safe. */
function pseudoMoves(g: Game, p: Piece): Move[] {
  const b = g.board, army = b.armies[p.seat], out: Move[] = [], from = p.cell;
  const push = (to: number, capture = -1) => out.push({ piece: p.id, from, to, capture });
  const pawnTo = (to: number, capture = -1) => {
    if (army.promote[to]) for (const promo of PROMOTIONS) out.push({ piece: p.id, from, to, capture, promo });
    else push(to, capture);
  };
  const target = (to: number) => { if (g.at[to] < 0) push(to); else if (enemyAt(g, to, p.seat)) push(to, g.at[to]); };
  if (p.kind === PieceKind.Pawn) {
    const step = army.pawnStep[from], double = army.pawnDouble[from];
    if (step >= 0 && g.at[step] < 0) {
      pawnTo(step);
      if (double >= 0 && g.at[double] < 0) push(double);
    }
    for (const c of army.pawnCaptures[from]) {
      if (enemyAt(g, c, p.seat)) pawnTo(c, g.at[c]);
      else if (c === g.ep && g.pieces[g.epPawn].seat !== p.seat) out.push({ piece: p.id, from, to: c, capture: g.epPawn, ep: true });
    }
  } else if (p.kind === PieceKind.Knight) b.knight[from].forEach(target);
  else if (p.kind === PieceKind.King) {
    b.king[from].forEach(target);
    if (!p.moved) for (const cs of army.castles) {
      const rook = g.at[cs.rook] >= 0 ? g.pieces[g.at[cs.rook]] : null;
      if (rook?.seat === p.seat && rook.kind === PieceKind.Rook && !rook.moved && cs.empty.every(c => g.at[c] < 0)
        && cs.safe.every(c => !attacked(g, c, p.seat))) out.push({ piece: p.id, from, to: cs.kingTo, capture: -1, castle: cs });
    }
  } else for (const set of SLIDES[p.kind]!) for (const ray of b[set][from]) for (const c of ray) {
    if (g.at[c] < 0) { push(c); continue; }
    if (enemyAt(g, c, p.seat)) push(c, g.at[c]);
    break;
  }
  return out;
}

/** Runs `fn` with the move made on the board (pieces and cells only), then puts everything back. */
export function tryMove<T>(g: Game, m: Move, fn: () => T): T {
  const p = g.pieces[m.piece], cap = m.capture >= 0 ? g.pieces[m.capture] : null, capCell = cap?.cell ?? -1;
  const rook = m.castle ? g.pieces[g.at[m.castle.rook]] : null, kind = p.kind;
  g.at[m.from] = -1;
  if (cap) { g.at[capCell] = -1; cap.cell = -1; }
  g.at[m.to] = p.id; p.cell = m.to;
  if (m.promo) p.kind = m.promo;
  if (rook && m.castle) { g.at[m.castle.rook] = -1; g.at[m.castle.rookTo] = rook.id; rook.cell = m.castle.rookTo; }
  try { return fn(); } finally {
    if (rook && m.castle) { g.at[m.castle.rookTo] = -1; g.at[m.castle.rook] = rook.id; rook.cell = m.castle.rook; }
    p.kind = kind; g.at[m.to] = -1; p.cell = m.from; g.at[m.from] = p.id;
    if (cap) { cap.cell = capCell; g.at[capCell] = cap.id; }
  }
}

/** A piece's legal moves: those that leave its own king safe. */
export function movesFrom(g: Game, pieceId: number): Move[] {
  const p = g.pieces[pieceId];
  if (p.cell < 0 || g.seats[p.seat].state !== SeatState.Playing) return [];
  return pseudoMoves(g, p).filter(m => tryMove(g, m, () => !inCheck(g, p.seat)));
}
/** Every legal move of a seat. */
export const legalMoves = (g: Game, seat: number) => g.pieces.filter(p => p.seat === seat && p.cell >= 0).flatMap(p => movesFrom(g, p.id));

/** The move if it is legal for that seat now (its turn, its piece, a move the rules give), else null. */
export function findMove(g: Game, seat: number, from: number, to: number, promo?: PieceKind): Move | null {
  if (g.state !== GameState.Playing || g.turn !== seat || g.at[from] < 0 || g.pieces[g.at[from]].seat !== seat) return null;
  return movesFrom(g, g.at[from]).find(m => m.to === to && m.promo === promo) ?? null;
}

/** A position for repetition (every piece, whose turn, castling rights, the en passant cell), as a short hash so the
 *  history fits in a rejoiner's sync message. */
function positionKey(g: Game) {
  // the en passant cell only matters when a pawn of the side to move could take on it (as in standard chess)
  const army = g.board.armies[g.turn];
  const ep = g.ep >= 0 && g.pieces.some(p => p.seat === g.turn && p.kind === PieceKind.Pawn && p.cell >= 0 && army.pawnCaptures[p.cell].includes(g.ep)) ? g.ep : -1;
  let k = `${g.turn}|${ep}|`;
  g.at.forEach((id, c) => {
    if (id < 0) return;
    const p = g.pieces[id], rights = p.kind === PieceKind.King || p.kind === PieceKind.Rook; // only they carry castling rights
    k += `${c}${p.kind[0]}${p.kind[1]}${p.seat}${rights ? +p.moved : ''},`;
  });
  let h = 0x811c9dc5; // FNV-1a, 32 bits
  for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}
/** Not enough to mate: only kings, plus at most one bishop or knight. */
function insufficient(g: Game) {
  const rest = g.pieces.filter(p => p.cell >= 0 && p.kind !== PieceKind.King);
  return rest.length === 0 || (rest.length === 1 && (rest[0].kind === PieceKind.Bishop || rest[0].kind === PieceKind.Knight));
}

function seatOut(g: Game, seat: number, ev: Events) {
  const s = g.seats[seat];
  if (s.state === SeatState.Out) return;
  s.state = SeatState.Out;
  s.place = playing(g).length + 1;
  for (const p of g.pieces) if (p.seat === seat && p.cell >= 0) { g.at[p.cell] = -1; p.cell = -1; }
  ev.outs.push(seat);
}
/** The end: everyone still in shares the top place. */
function end(g: Game, why: EndWhy) {
  for (const s of playing(g)) s.place = 1;
  g.state = GameState.Over; g.why = why;
  g.order = g.seats.map(s => s.id).sort((a, b) => g.seats[a].place! - g.seats[b].place! || a - b);
}
const next = (g: Game, from: number) => {
  for (let k = 1; k <= g.seats.length; k++) { const i = (from + k) % g.seats.length; if (g.seats[i].state === SeatState.Playing) return i; }
  return from;
};
const twoPlayers = (g: Game) => g.seats.length === 2;

/** The start of a turn: a seat with no legal move is mated (out) if in check, else stalemated (a draw in 2 players, a
 *  skipped turn in 4/6); this repeats until someone can move or the game is over. */
function startTurn(g: Game, ev: Events) {
  let stuck = 0;
  while (g.state === GameState.Playing) {
    const seat = g.turn;
    if (legalMoves(g, seat).length) return;
    if (inCheck(g, seat)) {
      seatOut(g, seat, ev);
      if (twoPlayers(g)) return end(g, EndWhy.Mate);
      if (playing(g).length === 1) return end(g, EndWhy.LastStanding);
    } else {
      if (twoPlayers(g)) return end(g, EndWhy.Draw);
      ev.skipped.push(seat);
      if (++stuck >= playing(g).length) return end(g, EndWhy.NoProgress); // nobody can move at all
    }
    g.turn = next(g, seat);
  }
}
/** After a move: the turn passes on; a player left with no move is mated or stalemated first (startTurn), and only if
 *  they can move do the draw rules apply — a mate on the 100th quiet move is still a mate. */
function afterMove(g: Game, ev: Events) {
  const left = playing(g).length;
  if (left <= 1) return end(g, EndWhy.LastStanding);
  g.turn = next(g, g.turn);
  if (twoPlayers(g)) { // repetition counts every position, even one that ends the game another way
    const k = positionKey(g), n = (g.keys.get(k) ?? 0) + 1;
    g.keys.set(k, n);
    if (legalMoves(g, g.turn).length && (n >= REPEATS || g.quiet >= NO_PROGRESS_PLIES || insufficient(g))) return end(g, EndWhy.Draw);
  } else if (legalMoves(g, g.turn).length && (g.quiet >= NO_PROGRESS_ROUNDS * left || (left === 2 && insufficient(g)))) return end(g, EndWhy.NoProgress);
  startTurn(g, ev);
}

/** Plays a legal move (see findMove) and passes the turn on. */
export function applyMove(g: Game, m: Move): Events {
  const ev: Events = { outs: [], skipped: [] }, p = g.pieces[m.piece];
  const pawn = p.kind === PieceKind.Pawn;
  if (m.capture >= 0) {
    const cap = g.pieces[m.capture];
    g.at[cap.cell] = -1; cap.cell = -1;
    if (cap.kind === PieceKind.King) seatOut(g, cap.seat, ev); // a king left exposed and taken (4/6)
  }
  g.at[m.from] = -1; g.at[m.to] = p.id; p.cell = m.to; p.moved = true;
  if (m.promo) p.kind = m.promo;
  if (m.castle) {
    const rook = g.pieces[g.at[m.castle.rook]];
    g.at[m.castle.rook] = -1; g.at[m.castle.rookTo] = rook.id; rook.cell = m.castle.rookTo; rook.moved = true;
  }
  const army = g.board.armies[p.seat], double = pawn && army.pawnDouble[m.from] === m.to;
  g.ep = double && twoPlayers(g) ? army.pawnStep[m.from] : -1;
  g.epPawn = g.ep >= 0 ? p.id : -1;
  g.quiet = pawn || m.capture >= 0 ? 0 : g.quiet + 1;
  if (!g.quiet) g.keys.clear(); // a pawn move or capture can't be undone: earlier positions can't come back
  afterMove(g, ev);
  return ev;
}

/** A player gives up: out; the game goes on without them (or ends). */
export function resign(g: Game, seat: number): Events {
  const ev: Events = { outs: [], skipped: [] };
  if (g.state !== GameState.Playing || g.seats[seat].state !== SeatState.Playing) return ev;
  seatOut(g, seat, ev);
  if (playing(g).length <= 1) { end(g, EndWhy.LastStanding); return ev; }
  if (g.turn === seat) { g.turn = next(g, seat); startTurn(g, ev); }
  return ev;
}

/** A copy that can be played on without touching the original (perft, look-ahead). `history: false` leaves out the
 *  repetition history (look-ahead doesn't need it, and copying it at every searched position is slow). */
export function cloneGame(g: Game, history = true): Game {
  return { ...g, seats: g.seats.map(s => ({ ...s })), pieces: g.pieces.map(p => ({ ...p })), at: g.at.slice(),
    keys: history ? new Map(g.keys) : new Map(), order: [...g.order] };
}
