// Seeded randomness (research R12): the same seed gives the same battlefield, so offline games can be replayed and the
// browser tests can set up exact situations without any test-only code in the build.
import { SEED_QUERY } from './constants.ts';

/** A random source: numbers in [0, 1). */
export type Random = () => number;

const MAX_SEED_DIGITS = 9;

/** A small, fast seeded generator (mulberry32). */
export function seeded(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Offline, `?seed=<number>` fixes the battlefield, wind, start spots and air drops; online it's ignored. */
export function gameSetup(url: string, online: boolean, now = Date.now()) {
  const q = new URL(url).searchParams, seed = q.get(SEED_QUERY);
  const fixed = !online && seed !== null && new RegExp(`^\\d{1,${MAX_SEED_DIGITS}}$`).test(seed);
  return { random: seeded(fixed ? Number(seed) : now), seed: fixed ? Number(seed) : now };
}
