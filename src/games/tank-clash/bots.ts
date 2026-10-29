// Computer tanks (research R8; FR-012, FR-022, SC-005): think a moment, maybe drive to a crate in reach, then aim by
// trying shots with the real flight code (so ground and wrecks block them as they would) and fire, all within
// BOT_TURN_S. The difficulty adds an aiming error.
import {
  BLAST_R, BOT_DRIVE_S, BOT_THINK_S, DIFFICULTY, DRIVE_SPEED, STEP_HZ, TANK_W, WORLD_W,
} from './constants.ts';
import type { Difficulty } from './enums.ts';
import type { Random } from './seed.ts';
import { flyStep, Flying, makeShell, NO_INPUT, type Battle, type Input, type Tank } from './sim.ts';
import { TANKS } from './tanks.ts';

/** A computer tank's turn so far. Start each turn with `newMemory()`. */
export type Memory = { elapsed: number; moveTo: number | null; aimedAt: number | null };
export const newMemory = (): Memory => ({ elapsed: 0, moveTo: null, aimedAt: null });

const MAX_FLIGHT_STEPS = STEP_HZ * 12;
const ANGLE_STEP = 3, POWER_STEP = 4, POWER_MIN = 10;
const SHOW_AIM_S = 0.4;   // the cannon shows its new angle this long before firing
const MISS = 1e6;         // a shot that goes nowhere
const FRIENDLY = 1e4;     // a shot that would hit itself or a teammate

/** Where a shot from t would land (x, y), or null if it's lost. */
export function predict(b: Battle, t: Tank, angle: number, power: number) {
  const s = makeShell(t, angle, power, 0);
  for (let i = 0; i < MAX_FLIGHT_STEPS; i++) {
    const r = flyStep(b, s, 1 / STEP_HZ);
    if (r === Flying.Hit) return { x: s.x, y: s.y };
    if (r === Flying.Lost) return null;
  }
  return null;
}

/** The nearest live enemy. */
export const targetOf = (b: Battle, t: Tank) =>
  b.tanks.filter(o => o.alive && o.side !== t.side).sort((a, c) => Math.abs(a.x - t.x) - Math.abs(c.x - t.x))[0];

/** The best angle and power at the target, then the difficulty's error (always inside the type's limits). */
export function aim(b: Battle, t: Tank, level: Difficulty, random: Random) {
  const spec = TANKS[t.type], target = targetOf(b, t);
  const score = (a: number, p: number) => {
    const hit = predict(b, t, a, p);
    if (!hit) return MISS;
    const friendly = b.tanks.some(o => o.alive && o.side === t.side && Math.abs(o.x - hit.x) < BLAST_R + TANK_W / 2);
    return Math.abs(hit.x - (target?.x ?? WORLD_W / 2)) + (friendly ? FRIENDLY : 0);
  };
  let best = { a: t.angle, p: t.power, s: Infinity };
  const tryShot = (a: number, p: number) => {
    if (a < spec.minAngle || a > spec.maxAngle || p < 0 || p > 100) return;
    const s = score(a, p);
    if (s < best.s) best = { a, p, s };
  };
  for (let a = spec.minAngle; a <= spec.maxAngle; a += ANGLE_STEP) for (let p = POWER_MIN; p <= 100; p += POWER_STEP) tryShot(a, p);
  const coarse = best;
  for (let a = coarse.a - ANGLE_STEP; a <= coarse.a + ANGLE_STEP; a++) for (let p = coarse.p - POWER_STEP; p <= coarse.p + POWER_STEP; p++) tryShot(a, p);
  const err = DIFFICULTY[level];
  return {
    angle: Math.min(spec.maxAngle, Math.max(spec.minAngle, best.a + (random() * 2 - 1) * err.angleError)),
    power: Math.min(100, Math.max(0, best.p + (random() * 2 - 1) * err.powerError)),
  };
}

/** A landed crate in t's half that it can reach this turn, or null. */
export function crateInReach(b: Battle, t: Tank) {
  const reach = Math.min(t.fuel, DRIVE_SPEED * BOT_DRIVE_S);
  const mine = (x: number) => (x < WORLD_W / 2) === (t.x < WORLD_W / 2);
  return b.crates.filter(c => !c.falling && mine(c.x) && Math.abs(c.x - t.x) <= reach)
    .sort((a, c) => Math.abs(a.x - t.x) - Math.abs(c.x - t.x))[0]?.x ?? null;
}

/** One step of a computer tank's turn: wait, drive to a crate, aim (setting the cannon), fire. Think + drive + show
 *  aim fits in BOT_TURN_S. */
export function botInput(b: Battle, t: Tank, mem: Memory, level: Difficulty, random: Random, dt: number): Input {
  mem.elapsed += dt;
  if (mem.elapsed < BOT_THINK_S) { if (mem.moveTo === null) mem.moveTo = crateInReach(b, t); return NO_INPUT; }
  if (mem.aimedAt === null) {
    const to = mem.moveTo;
    if (to !== null && mem.elapsed < BOT_THINK_S + BOT_DRIVE_S && Math.abs(t.x - to) > 2 && t.fuel > 0 && b.crates.some(c => c.x === to))
      return { ...NO_INPUT, drive: Math.sign(to - t.x) };
    Object.assign(t, aim(b, t, level, random));
    mem.aimedAt = mem.elapsed;
    return NO_INPUT;
  }
  return mem.elapsed - mem.aimedAt >= SHOW_AIM_S ? { ...NO_INPUT, fire: true } : NO_INPUT;
}
