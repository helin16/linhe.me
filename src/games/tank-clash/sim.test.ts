import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANNON_H, CELL, GRID_H, GRID_W, MAX_CRATES, POWER_SCALE, GRAVITY, SETTLE_MIN, TANK_H, TANK_W, TURN_MS, WORLD_H, WORLD_W } from './constants.ts';
import { Drop, Grip, MapId, Material, Phase, Side, TankType } from './enums.ts';
import { seeded } from './seed.ts';
import {
  activeTank, addCrate, blast, buildOrder, createBattle, DRAW, fire, newTank, NO_INPUT, pickUp, rollDrop, setPose, setTurn,
  makeShell, startTurn, step, tankOf, tiltOf, winnerOf, type Battle, type Events, type Input,
} from './sim.ts';
import { surfaceAt } from './terrain.ts';
import { TANKS } from './tanks.ts';

const DT = 1 / 60;
const TOP = 600; // the flat test field's surface
const look = (type: TankType = TankType.Allrounder) => ({ name: 'T', color: '#ff0000', type });
const events = (): Events => ({ fired: false, blasts: [], landed: [], got: [], destroyed: [], settled: false, timeout: false });

/** A flat earth field (rows from `top` down), with tanks [side, x, type] in order; the first tank is active. */
function battle(tanks: [Side, number, TankType?][], top = TOP): Battle {
  const cells = new Uint8Array(GRID_W * GRID_H);
  cells.fill(Material.Earth, Math.floor(top / CELL) * GRID_W);
  const b: Battle = { terrain: { cells, map: MapId.GreenHills }, tanks: [], crates: [], round: 1, order: [], active: 0, phase: Phase.Aim,
    turnLeftMs: TURN_MS, shell: null, winner: null, settleT: 0, nextCrate: 0, boom: null };
  tanks.forEach(([side, x, type], i) => b.tanks.push(newTank(b, i, { side, look: look(type), owner: null }, x)));
  return b;
}
const setRows = (b: Battle, x0: number, x1: number, y0: number, y1: number, m: Material) => {
  for (let gy = Math.floor(y0 / CELL); gy < Math.floor(y1 / CELL); gy++)
    for (let gx = Math.floor(x0 / CELL); gx < Math.floor(x1 / CELL); gx++) b.terrain.cells[gy * GRID_W + gx] = m;
};
const run = (b: Battle, input: Input, s: number) => { const all = events(); for (let i = 0; i < s * 60; i++) { const e = step(b, input, DT); for (const k of ['blasts', 'landed', 'got', 'destroyed'] as const) (all[k] as unknown[]).push(...e[k]); all.fired ||= e.fired; all.settled ||= e.settled; all.timeout ||= e.timeout; } return all; };
const untilSettled = (b: Battle) => { const all = events(); for (let i = 0; i < 1200 && !all.settled; i++) { const e = step(b, NO_INPUT, DT); all.settled = e.settled; all.blasts.push(...e.blasts); all.destroyed.push(...e.destroyed); all.landed.push(...e.landed); } return all; };

test('a new battle: sides in their halves on the ground, the first Left tank to play, wind set', () => {
  const entries = [Side.Left, Side.Right, Side.Left, Side.Right].map(side => ({ side, look: look(), owner: null }));
  const b = createBattle(seeded(1), MapId.Random, entries);
  assert.equal(b.tanks.length, 4);
  for (const t of b.tanks) {
    assert.ok(t.side === Side.Left ? t.x < WORLD_W / 2 : t.x > WORLD_W / 2);
    assert.equal(t.hearts, 40);
    assert.ok(t.y <= surfaceAt(b.terrain, t.x)!.y && !t.falling, 'rests on the ground');
  }
  assert.equal(b.tanks[b.active].side, Side.Left);
  assert.equal(b.round, 1);
  assert.equal(createBattle(seeded(1), MapId.LakeValley, entries).terrain.map, MapId.LakeValley);
});

test('turn order: alternate sides, then the bigger side’s rest (L1 vs R3 → L, R, R, R); destroyed tanks skipped', () => {
  const b = battle([[Side.Left, 200], [Side.Right, 900], [Side.Right, 1100], [Side.Right, 1300]]);
  assert.deepEqual(buildOrder(b), [0, 1, 2, 3]);
  const c = battle([[Side.Right, 900], [Side.Right, 1100], [Side.Left, 200], [Side.Right, 1300]]);
  assert.deepEqual(buildOrder(c), [2, 0, 1, 3]);
  c.tanks[1].alive = false;
  assert.deepEqual(buildOrder(c), [2, 0, 3]);
});

test('each round every live tank plays once; a crate drops after each round, at most 3 on the field', () => {
  const b = battle([[Side.Left, 200], [Side.Right, 1200]]);
  b.round = 0; b.order = [];
  const r = seeded(2);
  assert.equal(startTurn(b, r), null, 'no crate before the first round');
  assert.equal(b.round, 1); assert.equal(b.active, 0);
  startTurn(b, r); assert.equal(b.active, 1); assert.equal(b.round, 1);
  const crate = startTurn(b, r);
  assert.ok(crate && crate.falling && crate.contents, 'a crate after the round');
  assert.equal(b.round, 2); assert.equal(b.active, 0);
  for (let i = 0; i < 10; i++) startTurn(b, r);
  assert.equal(b.crates.length, MAX_CRATES);
  assert.equal(b.turnLeftMs, TURN_MS);
});

test('drop chances follow the table, the shield rarest', () => {
  const r = seeded(5), n: Record<string, number> = {};
  for (let i = 0; i < 10000; i++) { const d = rollDrop(r); n[d] = (n[d] ?? 0) + 1; }
  assert.ok(Math.abs(n[Drop.Repair] - 3500) < 300 && Math.abs(n[Drop.Shield] - 500) < 150 && Math.abs(n[Drop.Missile] - 1000) < 200, JSON.stringify(n));
  assert.equal(rollDrop(() => 0.999999), Drop.Missile);
});

test('aiming stays within the type’s limits; power from 0 to its top power (Heavy 89)', () => {
  const b = battle([[Side.Left, 200, TankType.Heavy], [Side.Right, 1200]]);
  run(b, { ...NO_INPUT, aim: 1, power: 1 }, 3);
  assert.equal(activeTank(b).angle, TANKS[TankType.Heavy].maxAngle);
  assert.equal(activeTank(b).power, 89);
  run(b, { ...NO_INPUT, aim: -1, power: -1 }, 4);
  assert.equal(activeTank(b).angle, 30);
  assert.equal(activeTank(b).power, 0);
});

test('driving: as far as the turn allows, at the type’s speed; crosses the middle, stops at the screen edge, other tanks and wrecks, steep walls, water and gaps', () => {
  const b = battle([[Side.Left, 700], [Side.Right, 1200]]);
  run(b, { ...NO_INPUT, drive: 1 }, 5);
  assert.ok(activeTank(b).x > WORLD_W / 2, 'into the other half');
  const edge = battle([[Side.Left, 60], [Side.Right, 1200]]);
  run(edge, { ...NO_INPUT, drive: -1 }, 2);
  assert.equal(activeTank(edge).x, TANK_W / 2, 'the screen edge');

  const c = battle([[Side.Left, 200], [Side.Left, 280], [Side.Right, 1200]]);
  c.tanks[1].alive = false; // a wreck still blocks
  run(c, { ...NO_INPUT, drive: 1 }, 3);
  assert.ok(activeTank(c).x <= 280 - TANK_W + 2);

  const speed = (type: TankType) => { const t = battle([[Side.Left, 100, type], [Side.Right, 1500]]); run(t, { ...NO_INPUT, drive: 1 }, 2); return activeTank(t).x - 100; };
  assert.ok(Math.abs(speed(TankType.Heavy) - TANKS[TankType.Heavy].speed * 2) < 2, 'the Heavy drives at its speed');
  assert.ok(speed(TankType.Scout) > speed(TankType.Allrounder) && speed(TankType.Allrounder) > speed(TankType.Heavy), 'lighter is faster');
  const far = battle([[Side.Left, 100, TankType.Scout], [Side.Right, 1500]]);
  run(far, { ...NO_INPUT, drive: 1 }, 6);
  assert.ok(activeTank(far).x > 500, 'no limit but the clock');

  const wall = battle([[Side.Left, 200], [Side.Right, 1200]]);
  setRows(wall, 260, 300, TOP - 100, TOP, Material.Earth);
  run(wall, { ...NO_INPUT, drive: 1 }, 3);
  assert.ok(activeTank(wall).x < 260 - TANK_W / 2 + 4, 'too steep');

  const lake = battle([[Side.Left, 200], [Side.Right, 1200]]);
  setRows(lake, 280, 400, TOP, TOP + 40, Material.Water);
  run(lake, { ...NO_INPUT, drive: 1 }, 3);
  assert.ok(activeTank(lake).x < 280, 'water');

  const gap = battle([[Side.Left, 200], [Side.Right, 1200]]);
  setRows(gap, 280, 400, TOP, WORLD_H, Material.Air);
  run(gap, { ...NO_INPUT, drive: 1 }, 3);
  assert.ok(activeTank(gap).x < 280 && !activeTank(gap).falling, 'the edge of a gap');

  const hill = battle([[Side.Left, 200], [Side.Right, 1200]]);
  for (let x = 240; x < 600; x += CELL) setRows(hill, x, x + CELL, TOP - (x - 240) * 0.3, TOP, Material.Earth);
  run(hill, { ...NO_INPUT, drive: 1 }, 2);
  assert.ok(activeTank(hill).y < TOP, 'climbs a gentle slope');
});

test('grip: low grip rolls on after letting go (further on snow and ice) and kicks back on snow and ice; never while parked', () => {
  const slid = (type: TankType, m: Material, gear = false) => {
    const b = battle([[Side.Left, 300, type], [Side.Right, 1200]]);
    setRows(b, 0, WORLD_W / 2, TOP, TOP + 12, m);
    b.tanks[0].on = m;
    if (gear) b.tanks[0].gripUntil = b.round;
    run(b, { ...NO_INPUT, drive: 1 }, 0.5);
    const stop = activeTank(b).x;
    run(b, NO_INPUT, 1);
    const after = activeTank(b).x - stop;
    activeTank(b).power = 1;
    const before = activeTank(b).x;
    fire(b); run(b, NO_INPUT, 1);
    return { after, back: before - activeTank(b).x };
  };
  assert.deepEqual(slid(TankType.Scout, Material.Snow), { after: 0, back: 0 }, 'High grip');
  const heavy = slid(TankType.Heavy, Material.Snow), medium = slid(TankType.Allrounder, Material.Snow), ice = slid(TankType.Heavy, Material.Ice);
  assert.ok(heavy.after > 20 && heavy.back > 20, JSON.stringify(heavy));
  assert.ok(Math.abs(medium.after - heavy.after / 2) < 2);
  assert.ok(ice.after > heavy.after && ice.after <= TANK_W);
  assert.deepEqual(slid(TankType.Heavy, Material.Snow, true), { after: 0, back: 0 }, 'grip gear');
  const earth = slid(TankType.Heavy, Material.Earth);
  assert.ok(earth.after > 0 && earth.after < heavy.after && earth.back === 0, 'on earth: rolls on a little, no kick-back');
  assert.deepEqual(slid(TankType.Scout, Material.Earth), { after: 0, back: 0 }, 'high grip stops dead');

  const parked = battle([[Side.Left, 300, TankType.Heavy], [Side.Right, 1200]]);
  for (let x = 0; x < 800; x += CELL) setRows(parked, x, x + CELL, TOP - x * 0.2, TOP, Material.Snow);
  parked.tanks[0] = newTank(parked, 0, { side: Side.Left, look: look(TankType.Heavy), owner: null }, 300);
  const x0 = parked.tanks[0].x;
  run(parked, NO_INPUT, 2);
  assert.equal(parked.tanks[0].x, x0);
});

test('a shot flies in an arc, leaves a trail and blows a hole', () => {
  const b = battle([[Side.Left, 200], [Side.Right, 1500]]);
  Object.assign(activeTank(b), { angle: 45, power: 50 });
  fire(b);
  assert.equal(b.phase, Phase.Flight);
  run(b, NO_INPUT, 0.3);
  assert.ok(b.shell && b.shell.trail.length > 5 && b.shell.y < TOP);
  const ev = untilSettled(b);
  const range = (50 * POWER_SCALE) ** 2 / GRAVITY;
  assert.equal(ev.blasts.length, 1);
  assert.ok(Math.abs(ev.blasts[0][0] - (200 + range)) < 60, `${ev.blasts[0][0]} vs ${200 + range}`);
  assert.ok(surfaceAt(b.terrain, ev.blasts[0][0])!.y > TOP, 'a hole');

});

test('shells: off the side or into water do nothing; above the top they keep flying', () => {
  const side = battle([[Side.Left, 700], [Side.Right, 1500]]);
  Object.assign(activeTank(side), { angle: 20, power: 100 });
  fire(side);
  assert.equal(untilSettled(side).blasts.length, 0);

  const lake = battle([[Side.Left, 200], [Side.Right, 1500]]);
  setRows(lake, 300, 1400, TOP - 20, TOP, Material.Water);
  Object.assign(activeTank(lake), { angle: 45, power: 50 });
  fire(lake);
  assert.equal(untilSettled(lake).blasts.length, 0);

  const high = battle([[Side.Left, 200], [Side.Right, 1500]]);
  Object.assign(activeTank(high), { angle: 75, power: 100 });
  fire(high);
  let above = false;
  for (let i = 0; i < 600 && high.shell; i++) { step(high, NO_INPUT, DT); above ||= !!high.shell && high.shell.y < 0; }
  assert.ok(above);
  assert.equal(high.phase, Phase.Settle);

  const crate = battle([[Side.Left, 200], [Side.Right, 1500]]);
  addCrate(crate, 0, 290, Drop.Repair);
  crate.crates[0] = { ...crate.crates[0], y: TOP, falling: false };
  Object.assign(activeTank(crate), { angle: 0, power: 40 });
  fire(crate);
  const ev = untilSettled(crate);
  assert.ok(ev.blasts.length === 1 && Math.abs(ev.blasts[0][0] - 290) <= 12, 'explodes on a crate');
  assert.equal(crate.crates.length, 0);
});

test('damage in tenths, teammates and the firer included; 0 hearts → a wreck; shields take one hit', () => {
  const b = battle([[Side.Left, 300], [Side.Left, 360], [Side.Right, 1200, TankType.Heavy]]);
  const ev = events();
  blast(b, 330, TOP, 40, 15, ev);
  assert.deepEqual([b.tanks[0].hearts, b.tanks[1].hearts, b.tanks[2].hearts], [25, 25, 50]);
  b.tanks[1].shield = true;
  blast(b, 330, TOP, 40, 30, ev);
  assert.equal(b.tanks[0].alive, false, 'destroyed');
  assert.equal(b.tanks[0].gone, false, 'a wreck stays');
  assert.equal(b.tanks[1].hearts, 25); assert.equal(b.tanks[1].shield, false);
  assert.deepEqual(ev.destroyed, [0]);
  const hearts = b.tanks[0].hearts;
  blast(b, 300, TOP - 10, 40, 30, ev);
  assert.equal(b.tanks[0].hearts, hearts, 'a wreck takes no damage');
  assert.equal(b.tanks[0].x, 300, 'and is never pushed');
});

test('a power shell does 1.5× damage, halves rounding up (Heavy 1.5 → 2.3), then normal', () => {
  const b = battle([[Side.Left, 200, TankType.Heavy], [Side.Right, 1200]]);
  activeTank(b).powerShell = true;
  fire(b);
  assert.equal(b.shell!.damage, 23);
  assert.equal(activeTank(b).powerShell, false);
  setTurn(b, 0, TURN_MS, 1); fire(b);
  assert.equal(b.shell!.damage, 15);
});

test('a missile doubles the damage and flies 1.5× as fast, then is used up; with a power shell, 3×', () => {
  const b = battle([[Side.Left, 200, TankType.Heavy], [Side.Right, 1200]]), t = activeTank(b);
  fire(b); const plain = b.shell!;
  setTurn(b, 0, TURN_MS, 1); t.missile = true; fire(b);
  assert.deepEqual([b.shell!.damage, b.shell!.missile, t.missile], [30, true, false]);
  assert.equal(Math.round(b.shell!.vx / plain.vx * 10) / 10, 1.5);
  setTurn(b, 0, TURN_MS, 2); t.missile = true; t.powerShell = true; fire(b);
  assert.equal(b.shell!.damage, 46);
});

test('shells explode on wrecks; wrecks fall when the ground goes and leave the screen if nothing is below', () => {
  const b = battle([[Side.Left, 200], [Side.Right, 900], [Side.Right, 1300]]);
  b.tanks[1].alive = false;
  Object.assign(activeTank(b), { angle: 0, power: 60 });
  fire(b);
  const ev = untilSettled(b);
  assert.equal(ev.blasts.length, 1);
  assert.ok(ev.blasts[0][0] < 900, 'hit the wreck, not the ground beyond');

  const fall = battle([[Side.Left, 200], [Side.Right, 900]]);
  fall.tanks[1].alive = false;
  setRows(fall, 860, 940, TOP, TOP + 60, Material.Air);
  fall.phase = Phase.Settle;
  untilSettled(fall);
  assert.equal(fall.tanks[1].y, TOP + 60, 'dropped onto what is left');
  assert.equal(fall.tanks[1].gone, false);
  setRows(fall, 860, 940, 0, WORLD_H, Material.Air);
  fall.phase = Phase.Settle;
  untilSettled(fall);
  assert.equal(fall.tanks[1].gone, true, 'fell off the screen');
});

test('falls: onto ground (no damage); off the bottom, into water or off wood → destroyed with no wreck', () => {
  const drop = battle([[Side.Left, 200], [Side.Right, 900]]);
  setRows(drop, 160, 240, TOP, TOP + 80, Material.Air);
  drop.phase = Phase.Settle;
  untilSettled(drop);
  assert.deepEqual([drop.tanks[0].y, drop.tanks[0].hearts, drop.tanks[0].alive], [TOP + 80, 40, true]);

  const off = battle([[Side.Left, 200], [Side.Right, 900]]);
  setRows(off, 160, 240, 0, WORLD_H, Material.Air);
  off.phase = Phase.Settle;
  const ev = untilSettled(off);
  assert.deepEqual([off.tanks[0].alive, off.tanks[0].gone], [false, true]);
  assert.deepEqual(ev.destroyed, [0]);

  const wet = battle([[Side.Left, 200], [Side.Right, 900]]);
  setRows(wet, 160, 240, TOP, TOP + 40, Material.Air);
  setRows(wet, 160, 240, TOP + 40, TOP + 80, Material.Water);
  wet.phase = Phase.Settle;
  untilSettled(wet);
  assert.deepEqual([wet.tanks[0].alive, wet.tanks[0].gone], [false, true]);

  const wood = battle([[Side.Left, 200], [Side.Right, 900]]);
  setRows(wood, 0, 400, TOP, WORLD_H, Material.Air);
  setRows(wood, 0, 400, TOP, TOP + 8, Material.Wood);
  setRows(wood, 0, 400, TOP + 200, WORLD_H, Material.Earth); // ground far below: still destroyed
  wood.tanks[0] = newTank(wood, 0, { side: Side.Left, look: look(), owner: null }, 200);
  assert.equal(wood.tanks[0].on, Material.Wood);
  const e = events();
  blast(wood, 200, TOP + 4, 40, 1, e);
  wood.phase = Phase.Settle;
  untilSettled(wood);
  assert.deepEqual([wood.tanks[0].alive, wood.tanks[0].gone], [false, true]);
});

test('crates: fall slowly, land on ground or wrecks, picked up by touching; blasts destroy them; water loses them', () => {
  const b = battle([[Side.Left, 200], [Side.Right, 1200]]);
  addCrate(b, 0, 300, Drop.Repair);
  const ev = run(b, NO_INPUT, 2);
  assert.ok(b.crates[0].falling && b.crates[0].y < TOP, 'still falling after 2 s');
  const landed = run(b, NO_INPUT, 3);
  assert.deepEqual(landed.landed, [0]);
  assert.equal(b.crates[0].y, TOP);
  assert.equal(ev.landed.length, 0);

  activeTank(b).hearts = 20;
  const got = run(b, { ...NO_INPUT, drive: 1 }, 3);
  assert.deepEqual(got.got, [[0, Drop.Repair]]);
  assert.equal(activeTank(b).hearts, 30);

  const onWreck = battle([[Side.Left, 200], [Side.Right, 900]]);
  onWreck.tanks[1].alive = false;
  addCrate(onWreck, 0, 900, Drop.Power);
  run(onWreck, NO_INPUT, 6);
  assert.equal(onWreck.crates[0].y, TOP - TANK_H, 'rests on the wreck');
  blast(onWreck, 900, TOP - TANK_H - 10, 40, 10, events());
  assert.equal(onWreck.crates.length, 0, 'blown up');

  const lake = battle([[Side.Left, 200], [Side.Right, 1200]]);
  setRows(lake, 450, 550, TOP - 20, TOP, Material.Water);
  addCrate(lake, 0, 500, Drop.Shield);
  run(lake, NO_INPUT, 6);
  assert.equal(lake.crates.length, 0);

  const off = battle([[Side.Left, 200], [Side.Right, 1200]]);
  setRows(off, 450, 550, 0, WORLD_H, Material.Air);
  addCrate(off, 0, 500, Drop.Shield);
  run(off, NO_INPUT, 6);
  assert.equal(off.crates.length, 0);
});

test('what crates give: repair up to full, power shell, grip gear for the next round, shield; at most one each', () => {
  const b = battle([[Side.Left, 200], [Side.Right, 1200]]), t = b.tanks[0], ev = events();
  const give = (d: Drop | null) => pickUp(b, t, addCrate(b, b.nextCrate, 0, d), ev);
  give(Drop.Repair); assert.equal(t.hearts, 40, 'wasted at full');
  give(Drop.Power); give(Drop.Power); assert.equal(t.powerShell, true);
  give(Drop.Shield); assert.equal(t.shield, true);
  give(Drop.Missile); give(Drop.Missile); assert.equal(t.missile, true);
  give(Drop.GripGear); assert.equal(t.gripUntil, b.round + 1);
  give(null); assert.equal(ev.got.length, 7, 'unknown contents (online guest): nothing applied here');
  assert.equal(b.crates.length, 0);
  setTurn(b, 0, TURN_MS, b.round + 1); assert.equal(t.gripUntil, b.round, 'lasts through the next round');
  setTurn(b, 0, TURN_MS, b.round + 1); assert.equal(t.gripUntil, null);
  assert.equal(Grip.High, 'High');
});

test('timeouts pass the turn with no shot; the battle ends when a side is empty (both at once: draw)', () => {
  const b = battle([[Side.Left, 200], [Side.Right, 1200]]);
  const ev = run(b, NO_INPUT, TURN_MS / 1000 + SETTLE_MIN + 0.2);
  assert.ok(ev.timeout && ev.settled);
  assert.equal(ev.blasts.length, 0);
  assert.equal(winnerOf(b), null);
  b.tanks[1].alive = false;
  assert.equal(winnerOf(b), Side.Left);
  b.tanks[0].alive = false;
  assert.equal(winnerOf(b), DRAW);

  const over = battle([[Side.Left, 200], [Side.Right, 260]]);
  blast(over, 230, TOP, 60, 100, events());
  over.phase = Phase.Settle;
  untilSettled(over);
  assert.equal(over.phase, Phase.Over);
  assert.equal(over.winner, DRAW);
  assert.equal(step(over, NO_INPUT, DT).settled, false, 'nothing after the end');

  const gone = battle([[Side.Left, 200], [Side.Right, 1200]]);
  gone.tanks[0].alive = false;
  assert.ok(run(gone, NO_INPUT, 1).timeout, 'a destroyed active tank passes at once');
});

test('on a slope a tank leans, and its shell leaves from the leaning cannon', () => {
  const b = battle([[Side.Left, 400], [Side.Right, 1200]]), t = b.tanks[0];
  assert.equal(tiltOf(b, t), 0, 'flat ground');
  for (let x = 400; x < 440; x += CELL) // ground rising under the tank's right end
    for (let y = TOP - (x - 400) / 2; y < TOP; y += CELL) b.terrain.cells[Math.floor(y / CELL) * GRID_W + Math.floor(x / CELL)] = Material.Earth;
  const tilt = tiltOf(b, t);
  assert.ok(tilt < -0.2, `leans back: ${tilt}`);
  t.falling = true; assert.equal(tiltOf(b, t), 0, 'not while falling'); t.falling = false;
  const onWreck = battle([[Side.Left, 400], [Side.Right, 1200], [Side.Left, 400 + TANK_W * 0.6]]);
  Object.assign(onWreck.tanks[2], { alive: false, y: TOP }); onWreck.tanks[0].y = TOP - TANK_H; // its front end on a wreck's roof
  assert.ok(tiltOf(onWreck, onWreck.tanks[0]) < 0, 'the wreck under its front holds that end up');
  const flat = makeShell(t, 45, 50, 10), leaning = makeShell(t, 45, 50, 10, tilt);
  assert.ok(Math.abs(leaning.x - flat.x - CANNON_H * Math.sin(tilt)) < 1e-9 && leaning.y > flat.y, 'the pivot moves with the body');
  fire(b); assert.equal(b.shell!.x, leaning.x, 'firing uses the tilt');
});

test('setPose: the active tank as its own device drove it, held on the field and its limits', () => {
  const b = battle([[Side.Left, 200, TankType.Heavy], [Side.Right, 1200]]);
  setPose(b, 0, 2000, 10, 150);
  const t = tankOf(b, 0);
  assert.deepEqual([t.x, t.angle, t.power], [WORLD_W - TANK_W / 2, 30, 89], "power held at its top power");
  setPose(b, 0, 300, 50, 40);
  assert.deepEqual([t.x, t.y, t.angle, t.power], [300, TOP, 50, 40]);
  t.alive = false; setPose(b, 0, 100, 50, 40);
  assert.equal(t.x, 300, 'a destroyed tank stays put');
});

test('a device told the turns (with the rest of the round) can run the battle later, mid-round', () => {
  const runner = battle([[Side.Left, 200], [Side.Left, 300], [Side.Right, 1200], [Side.Right, 1300]]);
  const guest = battle([[Side.Left, 200], [Side.Left, 300], [Side.Right, 1200], [Side.Right, 1300]]);
  runner.round = 0; runner.order = []; guest.round = 0; guest.order = [];
  const r = seeded(4);
  for (let i = 0; i < 6; i++) { // round 1 and half of round 2
    startTurn(runner, r);
    setTurn(guest, runner.active, TURN_MS, runner.round, runner.order);
    assert.deepEqual(guest.order, runner.order, `turn ${i}`);
  }
  startTurn(guest, r); // the guest takes over mid-round: the round's last two tanks still play
  assert.equal(guest.round, 2);
  assert.equal(guest.active, runner.order[0]);
});

test('a tank stands on the middle of its tracks: with only a corner on an edge, it falls', () => {
  const b = battle([[Side.Left, 300], [Side.Right, 1200]]);
  setRows(b, 300 - TANK_W / 2 + 6, 700, TOP, WORLD_H, Material.Air); // only the left corner is still over ground
  b.phase = Phase.Settle;
  untilSettled(b);
  assert.deepEqual([b.tanks[0].alive, b.tanks[0].gone], [false, true], 'fell off the screen');
});
