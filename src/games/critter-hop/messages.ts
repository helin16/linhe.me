// Critter Hop's online messages (specs/012-creature-checkers/contracts/messages.md): checking what arrives, who may send
// what, type picks in the waiting room, and a game turned into messages and back. Every device checks every move with
// the rules; the runner (first the host) speaks for computer seats, timeouts, drops and rejoins (research R5–R6).
import { isSlot } from '../../../relay/protocol.ts';
import { isMember } from '../../shared/enum.ts';
import type { SeatRow as Shared } from '../../shared/online/seats.ts';
import { boardFor } from './boards.ts';
import { MAX_SEED, PIECES, PLAYER_COUNTS, TURN_MS } from './constants.ts';
import { CritterType, Difficulty, GameState, HopMsg, SeatKind } from './enums.ts';
import { newGame, type Game, type SeatSpec } from './rules.ts';

export type SeatRow = Shared<CritterType>; // seat id, the slot playing it (−1: a computer), its type
export type TurnInfo = { seat: number; left: number; round: number; stall: number }; // round and stall: for a rejoiner
export type Msg =
  | { t: typeof HopMsg.Pick; from: number; type: CritterType }
  | { t: typeof HopMsg.Types; from: number; types: [number, CritterType][]; level: Difficulty }
  | { t: typeof HopMsg.Begin; from: number; seed: number; seats: SeatRow[] }
  | ({ t: typeof HopMsg.Turn; from: number } & TurnInfo)
  | { t: typeof HopMsg.Move; from: number; seat: number; piece: number; path: number[] }
  | { t: typeof HopMsg.Sync; from: number; seed: number; seats: SeatRow[]; now: number[]; holes: number[]; flags: number[]; order: number[];
      progress: number; turn: TurnInfo };

const MAX_SEATS = Math.max(...PLAYER_COUNTS);
const MAX_ROUND = 1e6;
const LEFT = 1, ARRIVED = 2; // sync flags per creature

const int = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) < hi;
const list = (v: unknown, max: number, ok: (x: unknown) => boolean): v is unknown[] => Array.isArray(v) && v.length <= max && v.every(ok);
const seatRows = (v: unknown): v is SeatRow[] => list(v, MAX_SEATS, r => Array.isArray(r) && r.length === 3 && int(r[0], 0, MAX_SEATS)
  && (r[1] === -1 || isSlot(r[1])) && isMember(CritterType, r[2])) && PLAYER_COUNTS.includes(v.length)
  && (v as SeatRow[]).every((r, i) => r[0] === i) && new Set((v as SeatRow[]).map(r => r[2])).size === v.length;
const holesOk = (v: unknown, seats: number) => list(v, seats * PIECES, h => int(h, 0, boardFor(seats).holes.length))
  && v.length === seats * PIECES && new Set(v).size === v.length;
const turnOk = (m: Record<string, unknown>, seats = MAX_SEATS) => int(m.seat, 0, seats) && typeof m.left === 'number' && m.left >= 0
  && m.left <= TURN_MS && int(m.round, 1, MAX_ROUND) && int(m.stall, 0, MAX_ROUND);
const pathOk = (v: unknown) => list(v, boardFor(PLAYER_COUNTS[0]).holes.length, h => int(h, 0, boardFor(PLAYER_COUNTS[0]).holes.length))
  && v.length >= 2 && new Set(v).size === v.length;
const orderOk = (v: unknown, seats: number) => list(v, seats, s => int(s, 0, seats)) && new Set(v).size === v.length;

/** Checks a message from another player; returns it or null if malformed. */
export function parseMessage(raw: unknown): Msg | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  if (!isSlot(m.from)) return null; // the relay stamps every player's message
  switch (m.t) {
    case HopMsg.Pick: return isMember(CritterType, m.type) ? raw as Msg : null;
    case HopMsg.Types: return list(m.types, 64, r => Array.isArray(r) && r.length === 2 && isSlot(r[0]) && isMember(CritterType, r[1]))
      && isMember(Difficulty, m.level) ? raw as Msg : null;
    case HopMsg.Begin: return int(m.seed, 0, MAX_SEED) && seatRows(m.seats) ? raw as Msg : null;
    case HopMsg.Turn: return turnOk(m) ? raw as Msg : null;
    case HopMsg.Move: return int(m.seat, 0, MAX_SEATS) && int(m.piece, 0, MAX_SEATS * PIECES) && pathOk(m.path) ? raw as Msg : null;
    case HopMsg.Sync: {
      if (!int(m.seed, 0, MAX_SEED) || !seatRows(m.seats) || !(list(m.now, MAX_SEATS, x => x === -1 || isSlot(x)) && (m.now as unknown[]).length === m.seats.length)) return null;
      const n = m.seats.length, t = m.turn as Record<string, unknown> | null;
      return holesOk(m.holes, n) && list(m.flags, n * PIECES, f => int(f, 0, 4)) && (m.flags as unknown[]).length === n * PIECES
        && orderOk(m.order, n) && (m.progress === 0 || m.progress === 1) && !!t && typeof t === 'object' && turnOk(t, n) ? raw as Msg : null;
    }
    default: return null;
  }
}

/** Who may send what: the host sets up the room, the runner runs the game, a seat's own player moves it (the runner
 *  moves computer seats and plays timeouts). `turnSlot`: the slot playing the seat in turn, or −1. */
export function allowedFrom(m: Msg, runner: number, host: number, turnSlot: number) {
  if (m.t === HopMsg.Pick) return true;
  if (m.t === HopMsg.Types) return m.from === host;
  if (m.t === HopMsg.Move) return m.from === turnSlot || m.from === runner;
  return m.from === runner;
}



/** The seats as the rules take them. */
export const seatSpecs = (rows: SeatRow[]): SeatSpec[] =>
  rows.map(([, slot, type]) => ({ kind: slot < 0 ? SeatKind.Computer : SeatKind.Person, type, slot }));

/** Everything so far, for a player rejoining mid-game. */
export function syncMsg(g: Game, seed: number, left: number, begun: SeatRow[]) { // the seats as the game began; who plays them now
  return {
    t: HopMsg.Sync, seed, seats: begun, now: g.seats.map(s => s.slot),
    holes: g.pieces.map(p => p.hole), flags: g.pieces.map(p => (p.left ? LEFT : 0) | (p.arrived ? ARRIVED : 0)),
    order: g.order, progress: +g.progress, turn: { seat: g.turn, left: Math.round(left), round: g.round, stall: g.stall },
  };
}
/** The game a sync describes. */
export function fromSync(m: Extract<Msg, { t: typeof HopMsg.Sync }>): Game {
  const g = newGame(seatSpecs(m.seats));
  g.seats.forEach((s, i) => { s.slot = m.now[i]; s.kind = m.now[i] < 0 ? SeatKind.Computer : SeatKind.Person; });
  g.occupant.fill(-1);
  g.pieces.forEach((p, i) => { p.hole = m.holes[i]; g.occupant[p.hole] = p.id; p.left = !!(m.flags[i] & LEFT); p.arrived = !!(m.flags[i] & ARRIVED); });
  m.order.forEach((s, i) => { g.seats[s].place = i + 1; }); // seats checked by parseMessage
  g.order = [...m.order];
  Object.assign(g, { turn: m.turn.seat, round: m.turn.round, stall: m.turn.stall, progress: !!m.progress, state: GameState.Playing });
  return g;
}
