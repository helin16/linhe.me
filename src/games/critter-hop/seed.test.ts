import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameSetup, seeded } from './seed.ts';

const take = (r: () => number, n = 5) => Array.from({ length: n }, r);

test('the same seed gives the same numbers, in [0, 1); different seeds differ', () => {
  assert.deepEqual(take(seeded(1)), take(seeded(1)));
  assert.notDeepEqual(take(seeded(1)), take(seeded(2)));
  for (const n of take(seeded(7), 1000)) assert.ok(n >= 0 && n < 1);
});

test('offline, ?seed= fixes the game; online ignores it; junk falls back to the clock', () => {
  const page = 'https://example.com/games/critter-hop/';
  assert.deepEqual(take(gameSetup(`${page}?seed=42`, false).random), take(seeded(42)));
  assert.equal(gameSetup(`${page}?seed=42`, false).seed, 42);
  assert.deepEqual(take(gameSetup(`${page}?seed=42`, true, 5).random), take(seeded(5)));
  for (const bad of ['?seed=x', '?seed=-1', '?seed=1234567890', ''])
    assert.deepEqual(take(gameSetup(page + bad, false, 9).random), take(seeded(9)), bad);
});
