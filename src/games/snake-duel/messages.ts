// Snake Duel's online messages (specs/006-snake-duel/contracts/messages.md): checking what arrives, who may send
// what, who runs the arena, and turning the arena into snapshots and back.
import { isSlot } from '../../../relay/protocol.ts';
import { isMember } from '../../shared/enum.ts';
import { ARENA_RADIUS, ARENA_SNAKES, INTERP_MS, MAX_MASS, NET_HZ, SEGMENT } from './constants.ts';
import { Difficulty, MatchType, SnakeMsg } from './enums.ts';
import { defaults, fixLook, type SnakeLook } from './settings.ts';
import { segments, type Arena, type Events, type Orb, type Snake } from './sim.ts';

export const ORB_CHUNK = 150;      // orbs per orb-list message (the relay caps a message at 8 KB)
const MAX_ID = 1e9;
const MAX_ORB_SIZE = 50;
const MAX_LIST = 600;              // eaten/added orbs in one snapshot
const R = 2;                       // decimals kept for positions and angles
const RUNNER_ONLY: string[] = [SnakeMsg.Orbs, SnakeMsg.Snap, SnakeMsg.Round, SnakeMsg.Clock, SnakeMsg.Match, SnakeMsg.Hand];
const HOST_OR_RUNNER: string[] = [SnakeMsg.Mode, SnakeMsg.Begin]; // the host sets up a match; the runner starts rounds

export type OrbRow = [number, number, number, number, string];
export type SnakeRow = [number, number, number, number, number, number, number]; // id, x, y, heading, mass, boost, alive
export type BeginRow = [number, number, number, number, number, number, SnakeLook]; // id, slot (-1 bot), x, y, heading, mass, look
export type Msg =
  | { t: typeof SnakeMsg.Look; from: number; p: SnakeLook }
  | { t: typeof SnakeMsg.Input; from: number; h?: number; r?: number; b: boolean }
  | { t: typeof SnakeMsg.Orbs; from: number; o: OrbRow[]; first: boolean }
  | { t: typeof SnakeMsg.Mode; from: number; type: MatchType; level: Difficulty }
  | { t: typeof SnakeMsg.Begin; from: number; type: MatchType; round: number; snakes: BeginRow[] }
  | { t: typeof SnakeMsg.Snap; from: number; s: SnakeRow[]; eat: number[]; add: OrbRow[]; out: number[] }
  | { t: typeof SnakeMsg.Round; from: number; winner: number | null; wins: [number, number][] }
  | { t: typeof SnakeMsg.Clock; from: number; left: number }
  | { t: typeof SnakeMsg.Match; from: number; winner: number | null }
  | { t: typeof SnakeMsg.Hand; from: number; to: number };

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const inArena = (v: unknown) => num(v) && Math.abs(v) <= ARENA_RADIUS * 2;
const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) < MAX_ID;
const winnerOk = (v: unknown) => v === null || isSlot(v);
const list = <T>(v: unknown, max: number, ok: (x: unknown) => boolean): v is T[] => Array.isArray(v) && v.length <= max && v.every(ok);
const orbRow = (o: unknown) => Array.isArray(o) && o.length === 5 && isId(o[0]) && inArena(o[1]) && inArena(o[2])
  && num(o[3]) && o[3] > 0 && o[3] <= MAX_ORB_SIZE && typeof o[4] === 'string' && /^#[0-9a-f]{6}$/i.test(o[4]);
const snakeRow = (s: unknown) => Array.isArray(s) && s.length === 7 && isId(s[0]) && inArena(s[1]) && inArena(s[2]) && num(s[3])
  && num(s[4]) && s[4] > 0 && s[4] <= MAX_MASS && (s[5] === 0 || s[5] === 1) && (s[6] === 0 || s[6] === 1);
const beginRow = (s: unknown) => Array.isArray(s) && s.length === 7 && isId(s[0]) && (s[1] === -1 || isSlot(s[1]))
  && inArena(s[2]) && inArena(s[3]) && num(s[4]) && num(s[5]) && s[5] > 0 && s[5] <= MAX_MASS;

/** Checks a message from another player; returns it (looks cleaned like a saved look) or null if malformed. */
export function parseMessage(raw: unknown): Msg | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  if (!isSlot(m.from)) return null; // the relay stamps every player's message
  const clean = (p: unknown) => fixLook(p, { ...defaults().players[0], name: '' });
  switch (m.t) {
    case SnakeMsg.Look: return { ...m, p: clean(m.p) } as Msg;
    case SnakeMsg.Input: return (m.h === undefined || num(m.h)) && (m.r === undefined || (num(m.r) && Math.abs(m.r) <= 1))
      ? { t: SnakeMsg.Input, from: m.from, h: m.h as number | undefined, r: m.r as number | undefined, b: !!m.b } : null;
    case SnakeMsg.Orbs: return list(m.o, ORB_CHUNK, orbRow) ? { ...m, first: !!m.first } as Msg : null;
    case SnakeMsg.Mode: return isMember(MatchType, m.type) && isMember(Difficulty, m.level) ? raw as Msg : null;
    case SnakeMsg.Begin: return isMember(MatchType, m.type) && Number.isInteger(m.round) && list(m.snakes, ARENA_SNAKES, beginRow)
      ? { ...m, snakes: (m.snakes as BeginRow[]).map(s => [...s.slice(0, 6), clean(s[6])] as BeginRow) } as Msg : null;
    case SnakeMsg.Snap: return list(m.s, ARENA_SNAKES, snakeRow) && list(m.eat, MAX_LIST, isId) && list(m.add, MAX_LIST, orbRow)
      && list(m.out, ARENA_SNAKES, isId) ? raw as Msg : null;
    case SnakeMsg.Round: return winnerOk(m.winner) && list(m.wins, ARENA_SNAKES, w => Array.isArray(w) && w.length === 2 && isSlot(w[0]) && Number.isInteger(w[1]))
      ? raw as Msg : null;
    case SnakeMsg.Clock: return num(m.left) && m.left >= 0 ? raw as Msg : null;
    case SnakeMsg.Match: return winnerOk(m.winner) ? raw as Msg : null;
    case SnakeMsg.Hand: return isSlot(m.to) ? raw as Msg : null;
    default: return null;
  }
}

/** Who may send what: arena messages only from the runner, match set-up from the host or the runner, looks and
 *  steering from anyone in the room. */
export const allowedFrom = (m: Msg, runner: number, host: number) =>
  RUNNER_ONLY.includes(m.t) ? m.from === runner : HOST_OR_RUNNER.includes(m.t) ? m.from === runner || m.from === host : true;

/** Who runs the arena next: the slot it was handed to, or the lowest remaining slot if the runner left. */
export function nextRunner(runner: number, slots: Iterable<number>, hand?: Msg): number {
  if (hand?.t === SnakeMsg.Hand && hand.from === runner) return hand.to;
  const all = [...slots];
  return all.includes(runner) ? runner : Math.min(...all);
}

const r = (v: number) => Math.round(v * 10 ** R) / 10 ** R;
export const orbRow0 = (o: Orb): OrbRow => [o.id, r(o.x), r(o.y), o.size, o.color];

/** The arena now, plus what changed since the last snapshot: one snapshot, then any extra new orbs (two big snakes
 *  out at once leave hundreds) in relay-sized orb-list chunks that add without clearing. */
export function encodeSnaps(arena: Arena, ev: Events): object[] {
  const added = ev.added.map(orbRow0), extra = [];
  for (let i = ORB_CHUNK; i < added.length; i += ORB_CHUNK) extra.push({ t: SnakeMsg.Orbs, o: added.slice(i, i + ORB_CHUNK), first: 0 });
  return [{
    t: SnakeMsg.Snap, s: arena.snakes.map(s => [s.id, r(s.path[0].x), r(s.path[0].y), r(s.heading), r(s.mass), +s.boost, +s.alive] as SnakeRow),
    eat: ev.eaten, add: added.slice(0, ORB_CHUNK), out: ev.out,
  }, ...extra];
}

/** A mirror's next new id comes after every id it was sent, so a runner taking over never reuses one. */
export const bumpId = (arena: Arena, id: number) => { arena.nextId = Math.max(arena.nextId, id + 1); };

/** The full orb list, in relay-sized chunks. */
export function orbChunks(arena: Arena) {
  const rows = [...arena.orbs.values()].map(orbRow0), out = [];
  for (let i = 0; i < rows.length || i === 0; i += ORB_CHUNK) out.push({ t: SnakeMsg.Orbs, o: rows.slice(i, i + ORB_CHUNK), first: +(i === 0) });
  return out;
}

export const encodeBegin = (arena: Arena, type: MatchType, round: number) => ({
  t: SnakeMsg.Begin, type, round,
  snakes: arena.snakes.map(s => [s.id, s.slot ?? -1, r(s.path[0].x), r(s.path[0].y), r(s.heading), r(s.mass), s.look] as BeginRow),
});

/** Moves a mirrored snake's head to where a snapshot says, laying body points SEGMENT apart along the way. */
function moveTo(s: Snake, x: number, y: number) {
  const head = s.path[0];
  for (;;) {
    const neck = s.path[1] ?? head, d = Math.hypot(x - neck.x, y - neck.y);
    if (d < SEGMENT) break;
    const f = SEGMENT / d;
    s.path.splice(1, 0, { x: neck.x + (x - neck.x) * f, y: neck.y + (y - neck.y) * f });
  }
  head.x = x; head.y = y;
  s.path.length = Math.min(s.path.length, segments(s) + 1);
}

/** Adds orbs a runner sent to a mirror. */
export function addOrbs(arena: Arena, rows: OrbRow[]) {
  for (const [id, x, y, size, color] of rows) { arena.orbs.set(id, { id, x, y, size, color }); bumpId(arena, id); }
}

/** Applies a snapshot to a guest's mirror of the arena. */
export function applySnap(arena: Arena, m: Omit<Extract<Msg, { t: typeof SnakeMsg.Snap }>, 'from'>) {
  for (const id of m.eat) arena.orbs.delete(id);
  addOrbs(arena, m.add);
  const byId = new Map(arena.snakes.map(s => [s.id, s]));
  for (const [id, x, y, heading, mass, boost, alive] of m.s) {
    bumpId(arena, id);
    const s = byId.get(id);
    if (!s) continue;
    const back = !s.alive && alive === 1; // respawned (Quick match rejoin, a bot back): start a fresh body there
    Object.assign(s, { heading, mass, boost: !!boost, alive: !!alive });
    if (back) s.path = [{ x, y }, { x: x - Math.cos(heading) * SEGMENT, y: y - Math.sin(heading) * SEGMENT }];
    moveTo(s, x, y);
  }
}

/** Between snapshots a guest moves each snake straight on at its speed, so the view stays smooth (the next snapshot
 *  corrects it). */
export function coast(arena: Arena, dt: number, speed: (s: Snake) => number) {
  for (const s of arena.snakes) if (s.alive) moveTo(s, s.path[0].x + Math.cos(s.heading) * speed(s) * dt, s.path[0].y + Math.sin(s.heading) * speed(s) * dt);
}

/** Guests draw this long behind the newest snapshot; with snapshots every 1000/NET_HZ ms the view lags at most this
 *  much before the network (SC-004: well under 0.5 s). */
export const VIEW_LAG_MS = INTERP_MS + 1000 / NET_HZ;
