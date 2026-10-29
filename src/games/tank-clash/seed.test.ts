import { test } from 'node:test';
import assert from 'node:assert/strict';
import { values } from '../../shared/enum.ts';
import { Difficulty, Drop, MapId, Material, Phase, Side, TankType } from './enums.ts';
import { gameSetup, seeded } from './seed.ts';
import { activeTank, createBattle, NO_INPUT, startTurn, step, type Battle } from './sim.ts';
import { botInput, newMemory } from './bots.ts';

const take = (r: () => number, n = 5) => Array.from({ length: n }, r);

test('the same seed gives the same numbers, in [0, 1); different seeds differ', () => {
  assert.deepEqual(take(seeded(1)), take(seeded(1)));
  assert.notDeepEqual(take(seeded(1)), take(seeded(2)));
  for (const n of take(seeded(7), 1000)) assert.ok(n >= 0 && n < 1);
});

test('offline, ?seed= fixes the battlefield; online ignores it', () => {
  const page = 'https://example.com/games/tank-clash/';
  assert.deepEqual(take(gameSetup(`${page}?seed=42`, false).random), take(seeded(42)));
  assert.equal(gameSetup(`${page}?seed=42`, false).seed, 42);
  assert.deepEqual(take(gameSetup(`${page}?seed=42`, true, 5).random), take(seeded(5)));
  for (const bad of ['?seed=x', '?seed=-1', '?seed=1234567890', '']) // not a seed: the clock decides
    assert.deepEqual(take(gameSetup(page + bad, false, 9).random), take(seeded(9)), bad);
});

// the layouts the browser tests rely on (e2e/tank.spec.ts): the game builds 1 Player battles exactly like this

function solo(seed: number, map: MapId, r = seeded(seed)) {
  const type = values(TankType)[Math.floor(r() * values(TankType).length)];
  return createBattle(r, map, [{ side: Side.Left, owner: { player: 0 }, look: { name: 'Player 1', color: '#4caf50', type: TankType.Allrounder } },
    { side: Side.Right, owner: null, look: { name: 'CPU 1', color: '#8e8e93', type } }]);
}
function shot(b: Battle, angle: number, power: number) {
  Object.assign(activeTank(b), { angle, power });
  step(b, { ...NO_INPUT, fire: true }, 1 / 60);
  for (let i = 0; i < 3000 && !step(b, NO_INPUT, 1 / 60).settled; i++);
  return b;
}

test('seed 1, Green Hills: 45° at power 90–92 hits the computer Heavy for 1 heart', () => {
  for (const power of [90, 91, 92]) {
    const b = shot(solo(1, MapId.GreenHills), 45, power);
    assert.equal(b.tanks[1].type, TankType.Heavy);
    assert.equal(b.tanks[1].hearts, 40, `power ${power}`);
    assert.equal(b.tanks[0].hearts, 40);
  }
});

test('seed 7, Timber Gap: the computer tank is on a bridge; 30° at power 56 breaks it and wins', () => {
  const b = solo(7, MapId.TimberGap);
  assert.equal(b.tanks[1].on, Material.Wood);
  shot(b, 30, 56);
  assert.equal(b.phase, Phase.Over);
  assert.equal(b.winner, Side.Left);
  assert.deepEqual([b.tanks[1].alive, b.tanks[1].gone], [false, true], 'fell with no wreck');
});

test('seed 14, Timber Gap, 2 Players: player 2 is on a bridge; 30° at power 64 breaks it and player 1 wins', () => {
  const look = (name: string, color: string) => ({ name, color, type: TankType.Allrounder });
  const b = createBattle(seeded(14), MapId.TimberGap, [{ side: Side.Left, owner: { player: 0 }, look: look('Player 1', '#4caf50') },
    { side: Side.Right, owner: { player: 1 }, look: look('Player 2', '#e53935') }]);
  assert.equal(b.tanks[1].on, Material.Wood);
  shot(b, 30, 64);
  assert.equal(b.winner, Side.Left);
});

test('seed 15, Green Hills: after a timed-out turn the computer hits the player to 3.2; a repair kit lands to the right in reach', () => {
  const r = seeded(15), b = solo(15, MapId.GreenHills, r);
  while (!step(b, NO_INPUT, 1 / 60).settled);
  startTurn(b, r);
  const mem = newMemory();
  while (!step(b, b.phase === Phase.Aim ? botInput(b, activeTank(b), mem, Difficulty.Normal, r, 1 / 60) : NO_INPUT, 1 / 60).settled);
  const crate = startTurn(b, r)!;
  assert.equal(b.tanks[0].hearts, 32);
  assert.equal(crate.contents, Drop.Repair);
  assert.ok(crate.x > b.tanks[0].x && crate.x - b.tanks[0].x < 150);
  for (let i = 0; i < 300; i++) step(b, NO_INPUT, 1 / 60);
  let got: unknown[] = [];
  for (let i = 0; i < 1200 && !got.length; i++) got = step(b, { ...NO_INPUT, drive: 1 }, 1 / 60).got;
  assert.deepEqual(got, [[0, Drop.Repair]]);
  assert.equal(b.tanks[0].hearts, 40);
});
