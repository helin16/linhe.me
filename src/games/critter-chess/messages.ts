// Critter Chess's online messages (specs/013-creature-chess/contracts/messages.md): checking what arrives, who may send
// what, type picks in the waiting room, and a game turned into a sync message and back. The runner (first the host)
// orders every move, as in Critter Hop (research R6).
import { isSlot, MAX_SLOT } from '../../../relay/protocol.ts';
import { isMember } from '../../shared/enum.ts';
import type { SeatRow as Shared } from '../../shared/online/seats.ts';
import { BACK_RANK, boardFor } from './boards.ts';
import { MAX_SEED, NO_PROGRESS_PLIES, NO_PROGRESS_ROUNDS, PLAYER_COUNTS, REPEATS, TURN_MS } from './constants.ts';
import { ChessMsg, CritterType, Difficulty, PieceKind, SeatKind, SeatState } from './enums.ts';
import { newGame, PROMOTIONS, setPieces, type Game, type SeatSpec } from './rules.ts';

export type SeatRow = Shared<CritterType>; // seat id, the slot playing it (−1: a computer), its type
/** A piece as sent: cell, kind, seat, moved (0/1). */
export type PieceRow = [number, PieceKind, number, number];
type SyncMsg = {
  t: typeof ChessMsg.Sync; from: number; seed: number; seats: SeatRow[]; now: number[]; pieces: PieceRow[]; places: (number | null)[];
  turn: number; left: number; ep: [number, number] | null; quiet: number; keys: [string, number][];
};
export type Msg =
  | { t: typeof ChessMsg.Pick; from: number; type: CritterType }
  | { t: typeof ChessMsg.Types; from: number; types: [number, CritterType][]; level: Difficulty }
  | { t: typeof ChessMsg.Begin; from: number; seed: number; seats: SeatRow[] }
  | { t: typeof ChessMsg.Turn; from: number; seat: number; left: number }
  | { t: typeof ChessMsg.Move; from: number; seat: number; at: number; to: number; promo?: PieceKind }
  | SyncMsg;

const MAX_SEATS = Math.max(...PLAYER_COUNTS);
const MAX_PIECES = MAX_SEATS * BACK_RANK.length * 2;   // a back rank and as many pawns per army
const MAX_KEYS = NO_PROGRESS_PLIES + 1;                // the history is cleared at every pawn move or capture
const MAX_KEY_CHARS = 7;                               // a 32-bit hash in base 36
const MAX_QUIET = NO_PROGRESS_ROUNDS * MAX_SEATS;      // the game ends before more quiet plies than this
const MAX_CELLS = boardFor(MAX_SEATS).cells.length; // the biggest board

const int = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) < hi;
const list = (v: unknown, max: number, ok: (x: unknown) => boolean): v is unknown[] => Array.isArray(v) && v.length <= max && v.every(ok);
const seatRows = (v: unknown): v is SeatRow[] => list(v, MAX_SEATS, r => Array.isArray(r) && r.length === 3 && int(r[0], 0, MAX_SEATS)
  && (r[1] === -1 || isSlot(r[1])) && isMember(CritterType, r[2])) && PLAYER_COUNTS.includes(v.length)
  && (v as SeatRow[]).every((r, i) => r[0] === i) && new Set((v as SeatRow[]).map(r => r[2])).size === v.length;
const left = (v: unknown) => typeof v === 'number' && v >= 0 && v <= TURN_MS;

function syncOk(m: Record<string, unknown>) {
  if (!int(m.seed, 0, MAX_SEED) || !seatRows(m.seats) || !(list(m.now, MAX_SEATS, x => x === -1 || isSlot(x)) && (m.now as unknown[]).length === m.seats.length)) return false;
  const n = m.seats.length, cells = boardFor(n).cells.length;
  const pieces = m.pieces, ep = m.ep;
  const shapeOk = list(pieces, MAX_PIECES, p => Array.isArray(p) && p.length === 4 && int(p[0], 0, cells) && isMember(PieceKind, p[1])
      && int(p[2], 0, n) && (p[3] === 0 || p[3] === 1)) && new Set((pieces as PieceRow[]).map(p => p[0])).size === pieces.length
    && list(m.places, n, p => p === null || int(p, 1, n + 1)) && (m.places as unknown[]).length === n
    && int(m.turn, 0, n) && left(m.left) && int(m.quiet, 0, MAX_QUIET + 1)
    && (ep === null || (Array.isArray(ep) && ep.length === 2 && int(ep[0], 0, cells) && int(ep[1], 0, cells)));
  if (!shapeOk) return false;
  // and consistent: a game still on (two or more seats in), the turn with a seat that is in, a king for every seat in and
  // no pieces for seats out, and the en passant pawn really a pawn of another seat
  const rows = pieces as PieceRow[], places = m.places as (number | null)[], inSeats = places.flatMap((p, i) => p === null ? [i] : []);
  const pawnAt = ep && rows.find(r => r[0] === (ep as number[])[1]);
  return inSeats.length >= 2 && places[m.turn as number] === null
    && inSeats.every(s => rows.filter(r => r[2] === s && r[1] === PieceKind.King).length === 1)
    && rows.every(r => places[r[2]] === null)
    && (ep === null || (!!pawnAt && pawnAt[1] === PieceKind.Pawn && pawnAt[2] !== m.turn))
    && list(m.keys, MAX_KEYS, k => Array.isArray(k) && k.length === 2 && typeof k[0] === 'string' && k[0].length <= MAX_KEY_CHARS && int(k[1], 1, REPEATS + 1));
}

/** Checks a message from another player; returns it or null if malformed. */
export function parseMessage(raw: unknown): Msg | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  if (!isSlot(m.from)) return null; // the relay stamps every player's message
  switch (m.t) {
    case ChessMsg.Pick: return isMember(CritterType, m.type) ? raw as Msg : null;
    case ChessMsg.Types: return list(m.types, MAX_SLOT, r => Array.isArray(r) && r.length === 2 && isSlot(r[0]) && isMember(CritterType, r[1]))
      && isMember(Difficulty, m.level) ? raw as Msg : null;
    case ChessMsg.Begin: return int(m.seed, 0, MAX_SEED) && seatRows(m.seats) ? raw as Msg : null;
    case ChessMsg.Turn: return int(m.seat, 0, MAX_SEATS) && left(m.left) ? raw as Msg : null;
    case ChessMsg.Move: return int(m.seat, 0, MAX_SEATS) && int(m.at, 0, MAX_CELLS) && int(m.to, 0, MAX_CELLS)
      && (m.promo === undefined || (PROMOTIONS as unknown[]).includes(m.promo)) ? raw as Msg : null;
    case ChessMsg.Sync: return syncOk(m) ? raw as Msg : null;
    default: return null;
  }
}

/** Who may send what: the host sets up the room; the runner starts, times and syncs the game; a move comes from the
 *  player in turn (a request to the runner) or from the runner (the move itself). `turnSlot`: the slot in turn, or −1. */
export function allowedFrom(m: Msg, runner: number, host: number, turnSlot: number) {
  if (m.t === ChessMsg.Pick) return true;
  if (m.t === ChessMsg.Types) return m.from === host;
  if (m.t === ChessMsg.Move) return m.from === turnSlot || m.from === runner;
  return m.from === runner;
}


/** The seats as the rules take them. */
export const seatSpecs = (rows: SeatRow[]): SeatSpec[] =>
  rows.map(([, slot, type]) => ({ kind: slot < 0 ? SeatKind.Computer : SeatKind.Person, type, slot }));

/** Everything so far, for a player rejoining mid-game: the seats as the game began (so the rejoiner can hand seats back
 *  to other players who return later) and who plays each seat now. */
export function syncMsg(g: Game, seed: number, leftMs: number, begun: SeatRow[]) {
  const ep: [number, number] | null = g.ep >= 0 ? [g.ep, g.pieces[g.epPawn].cell] : null;
  return {
    t: ChessMsg.Sync, seed, seats: begun, now: g.seats.map(s => s.slot),
    pieces: g.pieces.filter(p => p.cell >= 0).map(p => [p.cell, p.kind, p.seat, +p.moved] as PieceRow),
    places: g.seats.map(s => s.place), turn: g.turn, left: Math.max(0, Math.round(leftMs)), ep, quiet: g.quiet, keys: [...g.keys],
  };
}
/** The game a sync describes. */
export function fromSync(m: SyncMsg): Game {
  const g = newGame(seatSpecs(m.seats));
  g.seats.forEach((s, i) => { s.slot = m.now[i]; s.kind = m.now[i] < 0 ? SeatKind.Computer : SeatKind.Person; });
  setPieces(g, m.pieces.map(([cell, kind, seat, moved]) => ({ cell, kind, seat, moved: !!moved })));
  m.places.forEach((place, i) => { g.seats[i].place = place; g.seats[i].state = place === null ? SeatState.Playing : SeatState.Out; });
  g.turn = m.turn; g.quiet = m.quiet; g.keys = new Map(m.keys);
  if (m.ep && g.at[m.ep[1]] >= 0) { g.ep = m.ep[0]; g.epPawn = g.at[m.ep[1]]; }
  return g;
}
