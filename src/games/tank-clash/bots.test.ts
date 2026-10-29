import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOT_TURN_S, CELL, GRID_H, GRID_W, TURN_MS } from './constants.ts';
import { Difficulty, Drop, MapId, Material, Phase, Side, TankType } from './enums.ts';
import { seeded } from './seed.ts';
import { addCrate, newTank, step, type Battle } from './sim.ts';
import { aim, botInput, crateInReach, newMemory, predict, targetOf } from './bots.ts';

const TOP = 600, DT = 1 / 60;
function battle(tanks: [Side, number][]): Battle {
  const cells = new Uint8Array(GRID_W * GRID_H);
  cells.fill(Material.Earth, Math.floor(TOP / CELL) * GRID_W);
  const b: Battle = { terrain: { cells, map: MapId.GreenHills }, tanks: [], crates: [], round: 1, order: [], active: 0, phase: Phase.Aim,
    turnLeftMs: TURN_MS, wind: 0, shell: null, winner: null, settleT: 0, nextCrate: 0, boom: null };
  tanks.forEach(([side, x], i) => b.tanks.push(newTank(b, i, { side, look: { name: 'C', color: '#123456', type: TankType.Allrounder }, owner: null }, x)));
  return b;
}
const landedCrate = (b: Battle, x: number) => { const c = addCrate(b, b.nextCrate, x, Drop.Power); c.y = TOP; c.falling = false; return c; };

test('predict: where a shot lands, or null when it leaves the field', () => {
  const b = battle([[Side.Left, 200], [Side.Right, 1400]]);
  const hit = predict(b, b.tanks[0], 45, 50)!;
  assert.ok(hit.x > 400 && hit.x < 1000 && Math.abs(hit.y - TOP) < 6);
  b.tanks[0].x = 700;
  assert.equal(predict(b, b.tanks[0], 40, 100), null);
});

test('targets the nearest live enemy', () => {
  const b = battle([[Side.Left, 200], [Side.Right, 1400], [Side.Right, 1000]]);
  assert.equal(targetOf(b, b.tanks[0]).id, 2);
  b.tanks[2].alive = false;
  assert.equal(targetOf(b, b.tanks[0]).id, 1);
});

test('Hard aims close to the target; Easy misses by more on average; always inside the limits', () => {
  const b = battle([[Side.Left, 200], [Side.Right, 1200]]);
  const miss = (level: Difficulty, seed: number) => {
    const r = seeded(seed), shot = aim(b, b.tanks[0], level, r), hit = predict(b, b.tanks[0], shot.angle, shot.power);
    assert.ok(shot.angle >= 10 && shot.angle <= 75 && shot.power >= 0 && shot.power <= 100);
    return hit ? Math.abs(hit.x - 1200) : 2000;
  };
  let hard = 0, easy = 0;
  for (let s = 1; s <= 8; s++) { hard += miss(Difficulty.Hard, s); easy += miss(Difficulty.Easy, s); }
  assert.ok(hard / 8 < 40, `hard ${hard / 8}`);
  assert.ok(easy > hard * 2, `easy ${easy / 8}`);
});

test('never picks a shot that lands on a teammate when another will do', () => {
  const b = battle([[Side.Left, 200], [Side.Left, 700], [Side.Right, 1300]]);
  const shot = aim(b, b.tanks[0], Difficulty.Hard, seeded(1)), hit = predict(b, b.tanks[0], shot.angle, shot.power)!;
  assert.ok(Math.abs(hit.x - 700) > 60);
});

test('crates in reach: landed, in its own half, close enough', () => {
  const b = battle([[Side.Left, 200], [Side.Right, 1400]]);
  assert.equal(crateInReach(b, b.tanks[0]), null);
  landedCrate(b, 1000);
  addCrate(b, b.nextCrate, 260, Drop.Repair); // still falling
  assert.equal(crateInReach(b, b.tanks[0]), null);
  landedCrate(b, 302); landedCrate(b, 290);
  assert.equal(crateInReach(b, b.tanks[0]), 290, "the nearest");
  b.tanks[0].fuel = 10;
  assert.equal(crateInReach(b, b.tanks[0]), null);
});

test('a computer turn: thinks, drives to a crate, aims and fires within 3 s (SC-005)', () => {
  const b = battle([[Side.Left, 200], [Side.Right, 1200]]);
  landedCrate(b, 290);
  const mem = newMemory(), r = seeded(3);
  let fired = -1, drove = false;
  for (let i = 0; i < BOT_TURN_S * 60 + 30 && fired < 0; i++) {
    const input = botInput(b, b.tanks[0], mem, Difficulty.Normal, r, DT);
    drove ||= input.drive > 0;
    if (input.fire) fired = mem.elapsed;
    step(b, input, DT);
  }
  assert.ok(drove, 'went for the crate');
  assert.equal(b.crates.length, 0, 'and picked it up');
  assert.ok(fired > 0 && fired <= BOT_TURN_S, `fired at ${fired}`);

  const plain = battle([[Side.Left, 200], [Side.Right, 1200]]), m2 = newMemory();
  let f2 = -1;
  for (let i = 0; i < 300 && f2 < 0; i++) if (botInput(plain, plain.tanks[0], m2, Difficulty.Hard, r, DT).fire) f2 = m2.elapsed;
  assert.ok(f2 > 0 && f2 < 2, 'no crate: fires sooner');
});
