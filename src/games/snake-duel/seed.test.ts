import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameSetup, seeded } from './seed.ts';

const take = (r: () => number, n = 5) => Array.from({ length: n }, r);

test('the same seed gives the same numbers, in [0, 1); different seeds differ', () => {
  assert.deepEqual(take(seeded(1)), take(seeded(1)));
  assert.notDeepEqual(take(seeded(1)), take(seeded(2)));
  for (const n of take(seeded(7), 1000)) assert.ok(n >= 0 && n < 1);
});

test('offline, ?seed= fixes the arena and ?bots=0 keeps bots still; online ignores both', () => {
  const page = 'https://example.com/games/snake-duel/';
  assert.deepEqual(take(gameSetup(`${page}?seed=42`, false).random), take(seeded(42)));
  assert.equal(gameSetup(`${page}?bots=0`, false).stillBots, true);
  assert.equal(gameSetup(`${page}?bots=1`, false).stillBots, false);
  assert.deepEqual(take(gameSetup(`${page}?seed=42`, true, 5).random), take(seeded(5)));
  assert.equal(gameSetup(`${page}?bots=0`, true).stillBots, false);
  for (const bad of ['?seed=x', '?seed=-1', '?seed=1234567890', '']) // not a seed: the clock decides
    assert.deepEqual(take(gameSetup(page + bad, false, 9).random), take(seeded(9)), bad);
  assert.equal(typeof gameSetup(page, false).random(), 'number');
});
