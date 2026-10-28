// The arena (research R2): snakes, orbs, boost and take-outs, stepped at a fixed rate. Pure and seeded, so it runs
// the same offline and on the device running an online game, and the unit tests cover every rule.
import {
  ARENA_RADIUS, BASE_RADIUS, BOOST_COST, BOOST_SPEED, MAX_LENGTH, MAX_MASS, MAX_RADIUS, ORB_RADIUS, ORB_TARGET, ORB_TOPUP,
  OUT_ORB_EVERY, OUT_ORB_SIZE, QUICK_MS, RADIUS_GROWTH, REJOIN_MS, SEGMENT, SPAWN_MARGIN, SPEED, START_LENGTH, TURN_RATE, WIN_ROUNDS,
} from './constants.ts';
import { MatchState, MatchType } from './enums.ts';
import type { Random } from './seed.ts';
import type { SnakeLook } from './settings.ts';

export type Pt = { x: number; y: number };
export type Orb = { id: number; x: number; y: number; size: number; color: string };
export type Snake = {
  id: number;
  slot: number | null;      // a player's slot (0/1 on one device, the relay slot online); null = computer snake
  look: SnakeLook;
  path: Pt[];               // path[0] is the head; the rest are body points SEGMENT apart
  heading: number;          // radians; 0 = +x
  mass: number;             // length in segments (fractional while eating and boosting)
  boost: boolean;
  alive: boolean;
  outAt: number;            // arena time (ms) it went out
  drop: number;             // boost mass not yet dropped as an orb
  still: boolean;           // a parked computer snake (?bots=0): never moves
};
/** Steering: a direction to turn toward (mouse, stick) or a turn rate in [-1, 1] (keys); hold boost to go fast. */
export type Input = { target?: number; turn?: number; boost?: boolean };
export type Arena = { time: number; snakes: Snake[]; orbs: Map<number, Orb>; nextId: number; random: Random };
/** What changed in a step (an online runner sends these on). */
export type Events = { eaten: number[]; added: Orb[]; out: number[] };

const ORB_COLORS = ['#ff5d73', '#ffb84d', '#ffe74d', '#7dff6b', '#4dfff0', '#6b8cff', '#d36bff'];
const LEAD_ORBS = 5;          // orbs in a line ahead of each player at the start
const LEAD_GAP = 60;
const DUO_GAP = 600;          // 2 Players: how far each starts from the centre
const RING = 900;             // online: players start on a ring this far out
const HEAD_HIT = 0.6;         // how much of the head's own width counts when it touches a body
const GRID = 64;              // spatial grid cell for collision checks

export const segments = (s: Snake) => Math.min(MAX_LENGTH, Math.floor(s.mass));
export const radius = (s: Snake) => Math.min(MAX_RADIUS, BASE_RADIUS + RADIUS_GROWTH * segments(s));
export const orbRadius = (o: Orb) => ORB_RADIUS * Math.sqrt(o.size);
const dist2 = (a: Pt, b: Pt) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const angleTo = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export const createArena = (random: Random): Arena => ({ time: 0, snakes: [], orbs: new Map(), nextId: 1, random });

/** A random point at least `margin` inside the edge, spread evenly over the area. */
export function randomPoint(arena: Arena, margin = 0): Pt {
  const r = (ARENA_RADIUS - margin) * Math.sqrt(arena.random()), a = arena.random() * Math.PI * 2;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

export function addOrb(arena: Arena, x: number, y: number, size: number, color: string, events?: Events) {
  const orb = { id: arena.nextId++, x, y, size, color };
  arena.orbs.set(orb.id, orb);
  events?.added.push(orb);
  return orb;
}

/** Where players start: 1 in the centre facing right; 2 facing each other; online, around a ring. */
export function playerStarts(count: number): { x: number; y: number; heading: number }[] {
  if (count === 1) return [{ x: 0, y: 0, heading: 0 }];
  if (count === 2) return [{ x: -DUO_GAP, y: 0, heading: 0 }, { x: DUO_GAP, y: 0, heading: Math.PI }];
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return { x: Math.cos(a) * RING, y: Math.sin(a) * RING, heading: a + Math.PI / 2 };
  });
}

/** A fresh snake (or a respawn of an old one) lying straight behind its head. */
export function placeSnake(snake: Snake, at: { x: number; y: number; heading: number }) {
  const back = { x: -Math.cos(at.heading) * SEGMENT, y: -Math.sin(at.heading) * SEGMENT };
  snake.path = Array.from({ length: START_LENGTH + 1 }, (_, i) => ({ x: at.x + back.x * i, y: at.y + back.y * i }));
  Object.assign(snake, { heading: at.heading, mass: START_LENGTH, boost: false, alive: true, drop: 0 });
  return snake;
}

export function addSnake(arena: Arena, slot: number | null, look: SnakeLook, at = spawnPoint(arena)) {
  const snake = placeSnake({ id: arena.nextId++, slot, look, path: [], heading: 0, mass: 0, boost: false, alive: true, outAt: 0, drop: 0, still: false }, at);
  arena.snakes.push(snake);
  return snake;
}

/** Somewhere open to (re)spawn: random, away from the edge, facing a random way. */
export function spawnPoint(arena: Arena) {
  return { ...randomPoint(arena, SPAWN_MARGIN), heading: arena.random() * Math.PI * 2 };
}

/** A short line of orbs ahead of a player at the start, to get them going. */
export function leadOrbs(arena: Arena, at: { x: number; y: number; heading: number }) {
  for (let i = 1; i <= LEAD_ORBS; i++)
    addOrb(arena, at.x + Math.cos(at.heading) * LEAD_GAP * i, at.y + Math.sin(at.heading) * LEAD_GAP * i, 1, ORB_COLORS[i % ORB_COLORS.length]);
}

/** Keeps the arena stocked with scattered orbs. */
export function topUp(arena: Arena, events?: Events) {
  for (let n = 0; n < ORB_TOPUP && arena.orbs.size < ORB_TARGET; n++) {
    const p = randomPoint(arena, ORB_RADIUS * 2);
    addOrb(arena, p.x, p.y, 1, ORB_COLORS[Math.floor(arena.random() * ORB_COLORS.length)], events);
  }
}

function move(s: Snake, input: Input, dt: number, arena: Arena, events: Events) {
  const turn = input.target !== undefined
    ? Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, angleTo(s.heading, input.target)))
    : Math.max(-1, Math.min(1, input.turn ?? 0)) * TURN_RATE * dt;
  s.heading += turn;
  s.boost = !!input.boost && s.mass > START_LENGTH;
  const step = (s.boost ? BOOST_SPEED : SPEED) * dt, head = s.path[0];
  head.x += Math.cos(s.heading) * step; head.y += Math.sin(s.heading) * step;
  const neck = s.path[1], d = Math.sqrt(dist2(head, neck));
  if (d >= SEGMENT) { // a new body point exactly SEGMENT on from the last, toward the head
    const f = SEGMENT / d;
    s.path.splice(1, 0, { x: neck.x + (head.x - neck.x) * f, y: neck.y + (head.y - neck.y) * f });
  }
  if (s.boost) { // boosting costs length, dropped behind as small orbs
    const cost = Math.min(BOOST_COST * dt, s.mass - START_LENGTH);
    s.mass -= cost; s.drop += cost;
    if (s.drop >= 1) { s.drop -= 1; const tail = s.path[s.path.length - 1]; addOrb(arena, tail.x, tail.y, 1, s.look.color, events); }
  }
  s.path.length = Math.min(s.path.length, segments(s) + 1);
}

function eat(s: Snake, arena: Arena, events: Events) {
  const head = s.path[0], r = radius(s);
  for (const orb of arena.orbs.values()) {
    if (dist2(head, orb) > (r + orbRadius(orb)) ** 2) continue;
    s.mass = Math.min(MAX_MASS, s.mass + orb.size); arena.orbs.delete(orb.id); events.eaten.push(orb.id);
  }
}

export type BodyGrid = Map<string, { s: Snake; p: Pt }[]>;
const cellKey = (gx: number, gy: number) => `${gx},${gy}`;

/** Every living snake's body points (not heads), bucketed for quick nearby checks. */
export function bodyGrid(arena: Arena): BodyGrid {
  const grid: BodyGrid = new Map();
  for (const s of arena.snakes) if (s.alive) for (let i = 1; i < s.path.length; i++) {
    const p = s.path[i], k = cellKey(Math.floor(p.x / GRID), Math.floor(p.y / GRID)), list = grid.get(k);
    if (list) list.push({ s, p }); else grid.set(k, [{ s, p }]);
  }
  return grid;
}

/** The first snake (other than `except`) whose body is within `r` (plus its own width) of `p`, or null. */
export function bodyAt(grid: BodyGrid, p: Pt, r: number, except?: Snake): Snake | null {
  const cx = Math.floor(p.x / GRID), cy = Math.floor(p.y / GRID);
  for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++)
    for (const { s, p: q } of grid.get(cellKey(gx, gy)) ?? []) if (s !== except && dist2(p, q) < (r + radius(s)) ** 2) return s;
  return null;
}

export const outside = (p: Pt, margin = 0) => p.x * p.x + p.y * p.y > (ARENA_RADIUS - margin) ** 2;

/** Which snakes are out after this step: past the edge, head on another's body, or head to head (both). */
function takeOuts(arena: Arena): Set<Snake> {
  const alive = arena.snakes.filter(s => s.alive), out = new Set<Snake>(), grid = bodyGrid(arena);
  for (const a of alive) {
    const head = a.path[0], ra = radius(a);
    if (outside(head)) { out.add(a); continue; }
    for (const b of alive) if (b !== a && dist2(head, b.path[0]) < (ra + radius(b)) ** 2) { out.add(a); out.add(b); }
    if (bodyAt(grid, head, ra * HEAD_HIT, a)) out.add(a);
  }
  return out;
}

/** An out snake's body breaks into orbs others can eat. */
export function knockOut(arena: Arena, s: Snake, events: Events) {
  s.alive = false; s.boost = false; s.outAt = arena.time;
  for (let i = 0; i < s.path.length; i += OUT_ORB_EVERY) addOrb(arena, s.path[i].x, s.path[i].y, OUT_ORB_SIZE, s.look.color, events);
  events.out.push(s.id);
}

/** One fixed step of `dt` seconds; `inputs` by snake id (snakes without one go straight). */
export function step(arena: Arena, inputs: Map<number, Input>, dt: number): Events {
  const events: Events = { eaten: [], added: [], out: [] };
  for (const s of arena.snakes) if (s.alive && !s.still) move(s, inputs.get(s.id) ?? {}, dt, arena, events);
  for (const s of arena.snakes) if (s.alive) eat(s, arena, events);
  for (const s of takeOuts(arena)) knockOut(arena, s, events);
  topUp(arena, events);
  arena.time += dt * 1000;
  return events;
}

// --- matches (FR-008): Deathmatch rounds to WIN_ROUNDS, or one Quick match of QUICK_MS with rejoins ---

export type Match = {
  type: MatchType; state: MatchState; round: number;
  wins: Map<number, number>;       // Deathmatch: rounds won, by slot
  timeLeft: number;                // Quick match: ms left
  rejoinAt: Map<number, number>;   // Quick match: arena time an out player comes back, by slot
  winner: number | null;           // once over: the winner's slot, or null for a draw
};
export type MatchEvent = { over: MatchState; winner: number | null } | null;

export const createMatch = (type: MatchType, slots: number[]): Match => ({
  type, state: MatchState.Playing, round: 1, wins: new Map(slots.map(s => [s, 0])), timeLeft: QUICK_MS, rejoinAt: new Map(), winner: null,
});

const playersIn = (arena: Arena) => arena.snakes.filter(s => s.slot !== null);

/** The longest player still in, or null if nobody is in or the longest are level. */
function longest(arena: Arena): number | null {
  const alive = playersIn(arena).filter(s => s.alive).sort((a, b) => b.mass - a.mass);
  if (!alive.length || (alive[1] && segments(alive[1]) === segments(alive[0]))) return null;
  return alive[0].slot;
}

/** Moves the match on by one step of `dtMs`; says when a round or the match ends, and who won. */
export function updateMatch(match: Match, arena: Arena, dtMs: number): MatchEvent {
  if (match.state !== MatchState.Playing) return null;
  const players = playersIn(arena), alive = players.filter(s => s.alive);
  if (match.type === MatchType.Quick) {
    match.timeLeft = Math.max(0, match.timeLeft - dtMs);
    for (const s of players) {
      if (s.alive) continue;
      const at = match.rejoinAt.get(s.slot!);
      if (at === undefined) match.rejoinAt.set(s.slot!, arena.time + REJOIN_MS);
      else if (arena.time >= at) { match.rejoinAt.delete(s.slot!); placeSnake(s, spawnPoint(arena)); }
    }
    if (match.timeLeft > 0) return null;
    match.winner = longest(arena);
    match.state = MatchState.MatchOver;
    return { over: match.state, winner: match.winner };
  }
  // Deathmatch: alone in the room, it ends when that player is out; otherwise when one (or none) is left
  if (players.length > 1 ? alive.length > 1 : alive.length > 0) return null;
  const winner = players.length > 1 && alive.length === 1 ? alive[0].slot : null;
  if (winner !== null) match.wins.set(winner, (match.wins.get(winner) ?? 0) + 1);
  const done = players.length === 1 || (winner !== null && match.wins.get(winner)! >= WIN_ROUNDS);
  match.winner = done ? winner : null;
  match.state = done ? MatchState.MatchOver : MatchState.RoundOver;
  return { over: match.state, winner };
}

/** Starts the next Deathmatch round (the arena is rebuilt by the caller). */
export function nextRound(match: Match) { match.round++; match.state = MatchState.Playing; }
