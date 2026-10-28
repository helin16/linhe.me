// Computer snakes (research R3, FR-006, FR-016): they head for orbs, look ahead and turn away from bodies and the
// edge, and boost now and then; Hard ones hunt players, Easy ones keep away from them. They fill the arena to 20.
import { ARENA_SNAKES, BOT_RESPAWN_MS, DIFFICULTY, SAFE_SPAWN, SEGMENT, SPAWN_TRIES } from './constants.ts';
import { Difficulty, SnakeEyes, SnakePattern } from './enums.ts';
import type { Random } from './seed.ts';
import type { SnakeLook } from './settings.ts';
import { addSnake, bodyAt, bodyGrid, outside, placeSnake, radius, spawnPoint, type Arena, type BodyGrid, type Input, type Snake } from './sim.ts';

export const BOT_THINK_STEPS = 6;  // decide again every 6 steps (10 times a second at 60 Hz)
const PROBES = [0, 0.45, -0.45, 0.9, -0.9, 1.5, -1.5, 2.4, -2.4]; // headings tried, nearest the wish first
const EDGE_MARGIN = 60;
const SEE_ORBS = 500;              // how far a bot notices orbs
const SEE_PLAYERS = 600;           // how far a Hard bot notices a player to hunt
const CUT_AHEAD = 160;             // a Hunt aims this far in front of the player's head
const HUNT_BOOST = 320;            // and boosts when this close
const KEEP_AWAY = 260;             // an Easy bot turns away from a player this close
const WANDER = 0.6;                // how much a wandering bot drifts per decision
const STEER_GAIN = 4;              // turn rate per radian off course (then clamped to the level's turn)

const BOT_NAMES = ['Noodle', 'Ziggy', 'Pebble', 'Sprout', 'Mochi', 'Twirl', 'Biscuit', 'Comet', 'Wasabi', 'Pickle',
  'Fizz', 'Bramble', 'Tango', 'Nimbus', 'Pip', 'Sorbet', 'Juniper', 'Rascal', 'Kiwi', 'Waffle'];
const BOT_COLORS = ['#ff7a59', '#ffd23f', '#c77dff', '#4cc9f0', '#f72585', '#80ed99', '#ff9f1c', '#e5e5e5'];
const patterns = Object.values(SnakePattern), eyes = Object.values(SnakeEyes);

/** A computer snake's look, picked from fixed lists. */
export function botLook(n: number): SnakeLook {
  return { name: BOT_NAMES[n % BOT_NAMES.length], color: BOT_COLORS[n % BOT_COLORS.length],
    accent: BOT_COLORS[(n + 3) % BOT_COLORS.length], pattern: patterns[n % patterns.length], eyes: eyes[n % eyes.length] };
}

const angleTo = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const headingTo = (s: Snake, x: number, y: number) => Math.atan2(y - s.path[0].y, x - s.path[0].x);

/** Is it safe to head this way for `distance`? (no body, no edge) */
function clear(grid: BodyGrid, s: Snake, heading: number, distance: number) {
  const head = s.path[0], r = radius(s);
  for (let d = SEGMENT * 2; d <= distance; d += SEGMENT * 2) {
    const p = { x: head.x + Math.cos(heading) * d, y: head.y + Math.sin(heading) * d };
    if (outside(p, EDGE_MARGIN) || bodyAt(grid, p, r, s)) return false;
  }
  return true;
}

/** Where a bot wants to go and whether it boosts. */
function wish(arena: Arena, s: Snake, level: Difficulty, random: Random): { heading: number; boost: boolean } {
  const cfg = DIFFICULTY[level], head = s.path[0];
  const players = arena.snakes.filter(p => p.alive && p.slot !== null);
  const nearest = players.map(p => ({ p, d: Math.hypot(p.path[0].x - head.x, p.path[0].y - head.y) })).sort((a, b) => a.d - b.d)[0];
  if (cfg.hunts && nearest && nearest.d < SEE_PLAYERS) { // cut across the player's path
    const t = nearest.p.path[0], ahead = { x: t.x + Math.cos(nearest.p.heading) * CUT_AHEAD, y: t.y + Math.sin(nearest.p.heading) * CUT_AHEAD };
    return { heading: headingTo(s, ahead.x, ahead.y), boost: nearest.d < HUNT_BOOST };
  }
  if (cfg.avoidsPlayers && nearest && nearest.d < KEEP_AWAY)
    return { heading: headingTo(s, nearest.p.path[0].x, nearest.p.path[0].y) + Math.PI, boost: false };
  let best: { x: number; y: number; score: number } | null = null;
  for (const o of arena.orbs.values()) {
    const d = Math.hypot(o.x - head.x, o.y - head.y);
    if (d > SEE_ORBS) continue;
    const score = o.size / (d + 1);
    if (!best || score > best.score) best = { x: o.x, y: o.y, score };
  }
  const boost = random() < cfg.boostChance;
  if (best) return { heading: headingTo(s, best.x, best.y), boost };
  return { heading: s.heading + (random() - 0.5) * WANDER, boost };
}

/** A computer snake's steering for the next few steps. */
export function botInput(arena: Arena, s: Snake, level: Difficulty, random: Random, grid = bodyGrid(arena)): Input {
  const cfg = DIFFICULTY[level], w = wish(arena, s, level, random);
  // the safe heading nearest what it wants; if nothing ahead is safe, turn hard
  const want = PROBES.map(off => w.heading + off).find(h => clear(grid, s, h, cfg.lookAhead)) ?? s.heading + Math.PI / 2;
  const turn = Math.max(-1, Math.min(1, angleTo(s.heading, want) * STEER_GAIN)) * cfg.turn;
  return { turn, boost: w.boost };
}

/** A spawn point at least SAFE_SPAWN from every player's head (or the best of SPAWN_TRIES if the arena is crowded). */
export function safeSpawn(arena: Arena) {
  const heads = arena.snakes.filter(s => s.alive && s.slot !== null).map(s => s.path[0]);
  let best = spawnPoint(arena), bestGap = -1;
  for (let i = 0; i < SPAWN_TRIES; i++) {
    const p = i ? spawnPoint(arena) : best, gap = Math.min(Infinity, ...heads.map(h => Math.hypot(h.x - p.x, h.y - p.y)));
    if (gap > bestGap) { best = p; bestGap = gap; }
    if (gap >= SAFE_SPAWN) break;
  }
  return best;
}

/** Keeps the arena at ARENA_SNAKES snakes and brings out computer snakes back after a while, never next to a player. */
export function fillBots(arena: Arena, still: boolean) {
  for (const s of arena.snakes) if (s.slot === null && !s.alive && arena.time - s.outAt >= BOT_RESPAWN_MS) placeSnake(s, safeSpawn(arena));
  while (arena.snakes.length < ARENA_SNAKES) addSnake(arena, null, botLook(arena.snakes.length), safeSpawn(arena)).still = still;
}

/** Steering for every computer snake; they think again every BOT_THINK_STEPS steps (`memory` keeps the last). */
export function driveBots(arena: Arena, level: Difficulty, random: Random, stepNo: number, memory: Map<number, Input>) {
  if (stepNo % BOT_THINK_STEPS === 0) {
    const grid = bodyGrid(arena);
    for (const s of arena.snakes) if (s.slot === null && s.alive && !s.still) memory.set(s.id, botInput(arena, s, level, random, grid));
  }
  return memory;
}
