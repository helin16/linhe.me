// Tank Clash's online messages (specs/007-tank-artillery/contracts/messages.md): checking what arrives, who may send
// what, sides in the waiting room, and turning a battle into messages and back. The runner (first the host) settles
// every shot; the active tank's own device drives and aims it.
import { isSlot } from '../../../relay/protocol.ts';
import { isMember } from '../../shared/enum.ts';
import { TANK_COUNTS, TURN_MS, WORLD_H, WORLD_W } from './constants.ts';
import { Difficulty, Drop, MapId, Side, TankMsg } from './enums.ts';
import type { Random } from './seed.ts';
import { defaults, fixLook, type TankLook } from './settings.ts';
import { DRAW, type Battle, type Entry, type Winner } from './sim.ts';
import { specOf } from './tanks.ts';
import type { PlayableMap } from './terrain.ts';

export const MAX_TANKS = 10;
export const BLAST_CHUNK = 200;   // blasts per sync message (the relay caps a message at 8 KB)
const MAX_CRATES_SENT = 10;
const MAX_SEED = 2 ** 31;
const MAX_ROUND = 1e6;
const NO_GRIP = -1;               // gripUntil when the tank has no grip gear
const RUNNER_ONLY: string[] = [TankMsg.Begin, TankMsg.Turn, TankMsg.Settle, TankMsg.Drop, TankMsg.Over, TankMsg.Hand, TankMsg.Sync];

export type BeginRow = [number, number, Side, TankLook];
/** A turn as the runner has it (its aim flag: 1 while the tank is still aiming, 0 mid-shot). */
export type TurnInfo = { id: number; slot: number; left: number; round: number; rest: number[]; aim?: number };                    // id, slot (−1 computer), side, look
export type TankRow = [number, number, number, number, number, number, number, number, number, number]; // id, x, y, hearts, alive, gone, power shell, shield, gripUntil, missile
export type CrateRow = [number, number, number, number];                    // id, x, y, falling
export type Msg =
  | { t: typeof TankMsg.Look; from: number; p: TankLook }
  | { t: typeof TankMsg.Mode; from: number; map: MapId; tanks: number; level: Difficulty }
  | { t: typeof TankMsg.Begin; from: number; seed: number; map: PlayableMap; tanks: BeginRow[] }
  | ({ t: typeof TankMsg.Turn; from: number } & TurnInfo)
  | { t: typeof TankMsg.Pose; from: number; id: number; x: number; angle: number; power: number }
  | { t: typeof TankMsg.Fire; from: number; id: number; x: number; angle: number; power: number }
  | { t: typeof TankMsg.Settle; from: number; blasts: [number, number, number][]; tanks: TankRow[]; crates: CrateRow[]; got: [number, Drop][] }
  | { t: typeof TankMsg.Drop; from: number; id: number; x: number }
  | { t: typeof TankMsg.Over; from: number; winner: Exclude<Winner, null> }
  | { t: typeof TankMsg.Hand; from: number; to: number }
  | { t: typeof TankMsg.Sync; from: number; seed: number; map: PlayableMap; tanks: BeginRow[]; blasts: [number, number, number][]; first: boolean; turn: TurnInfo };

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const inX = (v: unknown) => num(v) && v >= 0 && v <= WORLD_W;
const inY = (v: unknown) => num(v) && v >= -WORLD_H && v <= WORLD_H * 2;
const bit = (v: unknown) => v === 0 || v === 1;
const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < MAX_TANKS;
const isCrateId = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 1e6;
const list = <T>(v: unknown, max: number, ok: (x: unknown) => boolean): v is T[] => Array.isArray(v) && v.length <= max && v.every(ok);
const isPlayable = (v: unknown): v is PlayableMap => isMember(MapId, v) && v !== MapId.Random;
const blastRow = (b: unknown) => Array.isArray(b) && b.length === 3 && inX(b[0]) && inY(b[1]) && num(b[2]) && b[2] > 0 && b[2] <= 200;
const beginRow = (r: unknown) => Array.isArray(r) && r.length === 4 && isId(r[0]) && (r[1] === -1 || isSlot(r[1])) && isMember(Side, r[2]);
const tankRow = (r: unknown) => Array.isArray(r) && r.length === 10 && isId(r[0]) && inX(r[1]) && inY(r[2]) && num(r[3]) && r[3] <= 50
  && bit(r[4]) && bit(r[5]) && bit(r[6]) && bit(r[7]) && Number.isInteger(r[8]) && (r[8] as number) >= NO_GRIP && bit(r[9]);
const crateRow = (r: unknown) => Array.isArray(r) && r.length === 4 && isCrateId(r[0]) && inX(r[1]) && inY(r[2]) && bit(r[3]);
const gotRow = (r: unknown) => Array.isArray(r) && r.length === 2 && isId(r[0]) && isMember(Drop, r[1]);
const turnOk = (v: unknown) => {
  const m = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return isId(m.id) && (m.slot === -1 || isSlot(m.slot)) && num(m.left) && m.left >= 0 && m.left <= TURN_MS
    && Number.isInteger(m.round) && (m.round as number) > 0 && (m.round as number) < MAX_ROUND && list(m.rest, MAX_TANKS, isId)
    && (m.aim === undefined || bit(m.aim));
};
const clean = (p: unknown) => fixLook(p, { ...defaults().players[0], name: '' });
const cleanRows = (rows: BeginRow[]) => rows.map(([id, slot, side, look]) => [id, slot, side, clean(look)] as BeginRow);

/** Checks a message from another player; returns it (looks cleaned like a saved look) or null if malformed. */
export function parseMessage(raw: unknown): Msg | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  if (!isSlot(m.from)) return null; // the relay stamps every player's message
  switch (m.t) {
    case TankMsg.Look: return { t: TankMsg.Look, from: m.from, p: clean(m.p) };
    case TankMsg.Mode: return isMember(MapId, m.map) && TANK_COUNTS.includes(m.tanks as number) && isMember(Difficulty, m.level) ? raw as Msg : null;
    case TankMsg.Begin: return Number.isInteger(m.seed) && (m.seed as number) >= 0 && (m.seed as number) < MAX_SEED && isPlayable(m.map)
      && list<BeginRow>(m.tanks, MAX_TANKS, beginRow) ? { ...m, tanks: cleanRows(m.tanks) } as Msg : null;
    case TankMsg.Turn: return turnOk(m) ? raw as Msg : null;
    case TankMsg.Pose: return isId(m.id) && inX(m.x) && num(m.angle) && num(m.power) ? raw as Msg : null;
    case TankMsg.Fire: return isId(m.id) && inX(m.x) && num(m.angle) && num(m.power) ? raw as Msg : null;
    case TankMsg.Settle: return list(m.blasts, BLAST_CHUNK, blastRow) && list(m.tanks, MAX_TANKS, tankRow)
      && list(m.crates, MAX_CRATES_SENT, crateRow) && list(m.got, MAX_TANKS, gotRow) ? raw as Msg : null;
    case TankMsg.Drop: return isCrateId(m.id) && inX(m.x) ? raw as Msg : null;
    case TankMsg.Over: return isMember(Side, m.winner) || m.winner === DRAW ? raw as Msg : null;
    case TankMsg.Hand: return isSlot(m.to) ? raw as Msg : null;
    case TankMsg.Sync: return Number.isInteger(m.seed) && (m.seed as number) >= 0 && (m.seed as number) < MAX_SEED && isPlayable(m.map)
      && list<BeginRow>(m.tanks, MAX_TANKS, beginRow) && list(m.blasts, BLAST_CHUNK, blastRow) && turnOk(m.turn)
      ? { ...m, tanks: cleanRows(m.tanks), first: !!m.first } as Msg : null;
    default: return null;
  }
}

/** Who may send what: the runner settles the battle, the host sets up the room, the active tank's player (or the
 *  runner, for a computer tank) drives and fires it. `activeSlot`: the slot playing the active tank, or null. */
export function allowedFrom(m: Msg, runner: number, host: number, activeSlot: number | null) {
  if (RUNNER_ONLY.includes(m.t)) return m.from === runner;
  if (m.t === TankMsg.Mode) return m.from === host;
  if (m.t === TankMsg.Pose || m.t === TankMsg.Fire) return m.from === (activeSlot ?? runner);
  return true;
}

/** The next runner: the same one while it's in the room, else the lowest slot (handing over moves it on purpose). */
export function nextRunner(runner: number, slots: number[], hand?: { to: number }) {
  if (hand && slots.includes(hand.to)) return hand.to;
  return slots.includes(runner) ? runner : slots[0] ?? -1;
}

/** How many players a side holds at most: half the tanks (FR-006). */
export const sideRoom = (tanks: number) => tanks / 2;
const count = (sides: (Side | undefined)[], side: Side) => sides.filter(s => s === side).length;
/** May a player switch to `side`? Only while it has a free place. */
export const sideFree = (sides: (Side | undefined)[], tanks: number, side: Side) => count(sides, side) < sideRoom(tanks);
/** A joining player's side: random, keeping the sides' player counts within one of each other. */
export function randomSide(sides: (Side | undefined)[], random: Random): Side {
  const left = count(sides, Side.Left), right = count(sides, Side.Right);
  if (left !== right) return left < right ? Side.Left : Side.Right;
  return random() < 0.5 ? Side.Left : Side.Right;
}
/** The tank count a room needs for its players: the host's pick, raised to the next even count where each side fits. */
export function tanksFor(picked: number, sides: Side[]) {
  const need = 2 * Math.max(count(sides, Side.Left), count(sides, Side.Right));
  return TANK_COUNTS.find(n => n >= Math.max(picked, need)) ?? TANK_COUNTS[TANK_COUNTS.length - 1];
}
/** Every side gets its players, then computer tanks up to half the tank count each, in a fixed order (all devices
 *  build the same battle from it). */
export function roomEntries(players: { slot: number; side: Side; look: TankLook }[], tanks: number, botLook: (n: number) => TankLook): Entry[] {
  const list: Entry[] = [];
  let bots = 0;
  for (const side of [Side.Left, Side.Right]) {
    const mine = players.filter(p => p.side === side).sort((a, b) => a.slot - b.slot);
    for (const p of mine) list.push({ side, look: { ...p.look, side: undefined }, owner: { slot: p.slot } });
    for (let i = mine.length; i < tanks / 2; i++) list.push({ side, look: botLook(++bots), owner: null });
  }
  return list;
}
export const beginRows = (entries: Entry[]): BeginRow[] =>
  entries.map((e, id) => [id, e.owner && 'slot' in e.owner ? e.owner.slot : -1, e.side, e.look]);
export const rowsToEntries = (rows: BeginRow[]): Entry[] => rows.map(([, slot, side, look]) => ({ side, look, owner: slot < 0 ? null : { slot } }));

/** The battle's state after a shot (or a pick-up), for everyone to copy. */
export function encodeSettle(b: Battle, blasts: [number, number, number][], got: [number, Drop][]) {
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    t: TankMsg.Settle, blasts: blasts.map(([x, y, rad]) => [r(x), r(y), rad]), got,
    tanks: b.tanks.map(t => [t.id, r(t.x), r(t.y), t.hearts, +t.alive, +t.gone, +t.powerShell, +t.shield, t.gripUntil ?? NO_GRIP, +t.missile]),
    crates: b.crates.map(c => [c.id, r(c.x), r(c.y), +c.falling]),
  };
}

/** Copies the runner's state onto this device's battle; crates it hasn't heard of appear (contents hidden). */
export function applySettle(b: Battle, m: Extract<Msg, { t: typeof TankMsg.Settle }>) {
  for (const [id, x, y, hearts, alive, gone, power, shield, grip, missile] of m.tanks) {
    const t = b.tanks[id];
    if (!t) continue;
    Object.assign(t, { x, y, hearts: Math.min(hearts, specOf(t.look).hearts), alive: !!alive, gone: !!gone, powerShell: !!power, shield: !!shield,
      gripUntil: grip === NO_GRIP ? null : grip, missile: !!missile, falling: false, vy: 0, slide: 0 });
  }
  b.crates = m.crates.map(([id, x, y, falling]) => ({ ...(b.crates.find(c => c.id === id) ?? { contents: null }), id, x, y, falling: !!falling }));
  b.nextCrate = Math.max(b.nextCrate, ...b.crates.map(c => c.id + 1));
}


/** Is a turn about tanks this battle has? (A message can only be checked against the battle on arrival.) */
export const turnFits = (t: TurnInfo, tanks: number) => t.id < tanks && t.rest.every(id => id < tanks);
