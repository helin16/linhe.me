import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Difficulty, Drop, MapId, Side, TankMsg, TankType, Variant } from './enums.ts';
import { seeded } from './seed.ts';
import { addCrate, createBattle, DRAW } from './sim.ts';
import {
  allowedFrom, applySettle, beginRows, encodeSettle, nextRunner, parseMessage, randomSide, roomEntries, rowsToEntries, sideFree,
  sideRoom, tanksFor, turnFits, type Msg,
} from './messages.ts';

const look = { name: 'Ann', color: '#112233', type: TankType.Heavy };
const ok = (m: object) => { const r = parseMessage({ from: 1, ...m }); assert.ok(r, JSON.stringify(m)); return r!; };
const bad = (m: object) => assert.equal(parseMessage({ from: 1, ...m }), null, JSON.stringify(m));

test('every message type is checked; anything malformed or unstamped is dropped', () => {
  for (const raw of [null, 'x', [1], { t: TankMsg.Look, p: look }, { t: 'nope', from: 1 }]) assert.equal(parseMessage(raw), null);
  assert.deepEqual(ok({ t: TankMsg.Look, p: { ...look, name: '<b>' + 'x'.repeat(20), side: Side.Right } }),
    { t: TankMsg.Look, from: 1, p: { ...look, name: '<b>xxxxxxx', variant: Variant.B, side: Side.Right } });
  ok({ t: TankMsg.Mode, map: MapId.Random, tanks: 6, level: Difficulty.Hard });
  bad({ t: TankMsg.Mode, map: MapId.Random, tanks: 3, level: Difficulty.Hard });
  bad({ t: TankMsg.Mode, map: 'Moon', tanks: 6, level: Difficulty.Hard });
  const begin = ok({ t: TankMsg.Begin, seed: 5, map: MapId.TimberGap, tanks: [[0, 1, Side.Left, { ...look, color: 'red' }], [1, -1, Side.Right, look]] });
  assert.equal((begin as Extract<Msg, { t: 'begin' }>).tanks[0][3].color, '#4caf50', 'looks cleaned');
  bad({ t: TankMsg.Begin, seed: 5, map: MapId.Random, tanks: [] });
  bad({ t: TankMsg.Begin, seed: -1, map: MapId.TimberGap, tanks: [] });
  bad({ t: TankMsg.Begin, seed: 5, map: MapId.TimberGap, tanks: [[0, 1, 'Middle', look]] });
  bad({ t: TankMsg.Begin, seed: 5, map: MapId.TimberGap, tanks: Array.from({ length: 11 }, (_, i) => [i % 10, -1, Side.Left, look]) });
  ok({ t: TankMsg.Turn, id: 3, slot: -1, left: 30000, round: 2, rest: [1, 2] });
  ok({ t: TankMsg.Turn, id: 3, slot: 2, left: 30000, round: 2, rest: [1, 2] });
  bad({ t: TankMsg.Turn, id: 3, slot: -1, left: 30000, round: 2, rest: [11] });
  bad({ t: TankMsg.Turn, id: 3, slot: -2, left: 30000, round: 2, rest: [1, 2] });
  bad({ t: TankMsg.Turn, id: 3, slot: -1, left: 40000, round: 2 });
  bad({ t: TankMsg.Turn, id: 10, slot: -1, left: 1000, round: 1, rest: [] });
  ok({ t: TankMsg.Pose, id: 0, x: 300, angle: 40, power: 50 });
  bad({ t: TankMsg.Pose, id: 0, x: 3000, angle: 40, power: 50 });
  ok({ t: TankMsg.Fire, id: 0, x: 300, angle: 40, power: 50 });
  bad({ t: TankMsg.Fire, id: 0, x: 300, angle: NaN, power: 50 });
  ok({ t: TankMsg.Settle, blasts: [[100, 500, 40]], tanks: [[0, 100, 500, 25, 1, 0, 0, 1, -1, 1]], crates: [[0, 50, 600, 0]], got: [[0, Drop.Shield]] });
  bad({ t: TankMsg.Settle, blasts: [], tanks: [[0, 100, 500, 25, 1, 0, 0, 1, -1, 2]], crates: [], got: [] });
  bad({ t: TankMsg.Settle, blasts: [], tanks: [], crates: [], got: [[0, 'Cake']] });
  ok({ t: TankMsg.Drop, id: 4, x: 800 });
  bad({ t: TankMsg.Drop, id: 4, x: -5 });
  ok({ t: TankMsg.Over, winner: Side.Left }); ok({ t: TankMsg.Over, winner: DRAW });
  bad({ t: TankMsg.Over, winner: 'Up' });
  ok({ t: TankMsg.Hand, to: 2 });
  bad({ t: TankMsg.Hand, to: -1 });
  const turnInfo = { id: 0, slot: 0, left: 1000, round: 2, rest: [], aim: 0 };
  const sync = ok({ t: TankMsg.Sync, seed: 9, map: MapId.LakeValley, tanks: [[0, 0, Side.Left, look]], blasts: [[1, 2, 40]], first: 1, turn: turnInfo });
  bad({ t: TankMsg.Sync, seed: 9, map: MapId.LakeValley, tanks: [], blasts: [], first: 1, turn: { ...turnInfo, aim: 2 } });
  bad({ t: TankMsg.Sync, seed: 9, map: MapId.LakeValley, tanks: [], blasts: [], first: 1 });
  assert.equal((sync as Extract<Msg, { t: 'sync' }>).first, true);
  bad({ t: TankMsg.Sync, seed: 9, map: MapId.LakeValley, tanks: [], blasts: Array.from({ length: 201 }, () => [1, 2, 40]), turn: turnInfo });
  assert.equal(turnFits(turnInfo, 2), true);
  assert.equal(turnFits({ ...turnInfo, rest: [1, 4] }, 4), false, 'a tank the battle does not have');
  assert.equal(turnFits({ ...turnInfo, id: 3 }, 2), false);
});

test('who may send what: runner settles, host sets up, the active tank’s player drives (the runner for computers)', () => {
  const m = (t: string, from: number) => ({ t, from }) as Msg;
  for (const t of [TankMsg.Begin, TankMsg.Turn, TankMsg.Settle, TankMsg.Drop, TankMsg.Over, TankMsg.Hand, TankMsg.Sync]) {
    assert.equal(allowedFrom(m(t, 2), 2, 0, 1), true, t);
    assert.equal(allowedFrom(m(t, 1), 2, 0, 1), false, t);
  }
  assert.equal(allowedFrom(m(TankMsg.Mode, 0), 2, 0, 1), true);
  assert.equal(allowedFrom(m(TankMsg.Mode, 2), 2, 0, 1), false);
  assert.equal(allowedFrom(m(TankMsg.Pose, 1), 2, 0, 1), true);
  assert.equal(allowedFrom(m(TankMsg.Fire, 2), 2, 0, 1), false, 'not your tank');
  assert.equal(allowedFrom(m(TankMsg.Fire, 2), 2, 0, null), true, 'the runner fires for a computer tank');
  assert.equal(allowedFrom(m(TankMsg.Look, 3), 2, 0, 1), true);
});

test('the runner stays while in the room; else the lowest slot; a hand moves it', () => {
  assert.equal(nextRunner(2, [0, 2, 3]), 2);
  assert.equal(nextRunner(2, [1, 3]), 1);
  assert.equal(nextRunner(0, [0, 3], { to: 3 }), 3);
  assert.equal(nextRunner(0, [0, 3], { to: 5 }), 0);
  assert.equal(nextRunner(0, []), -1);
});

test('sides: random when even, else the smaller; a side holds half the tanks; the tank count rises to fit', () => {
  assert.equal(randomSide([Side.Left], seeded(1)), Side.Right);
  assert.equal(randomSide([Side.Right, Side.Right, Side.Left], seeded(1)), Side.Left);
  const picks = new Set(Array.from({ length: 20 }, (_, i) => randomSide([], seeded(i))));
  assert.equal(picks.size, 2);
  assert.equal(sideRoom(4), 2);
  assert.equal(sideFree([Side.Left, Side.Left], 4, Side.Left), false);
  assert.equal(sideFree([Side.Left, undefined], 4, Side.Left), true, 'everyone may stack one side while it has room');
  assert.equal(tanksFor(2, [Side.Left, Side.Left]), 4);
  assert.equal(tanksFor(2, [Side.Left, Side.Right]), 2);
  assert.equal(tanksFor(6, [Side.Left]), 6);
  assert.equal(tanksFor(2, Array(6).fill(Side.Right)), 10, 'never more than 10');
});

test('room entries: each side’s players by slot, then computer tanks to half the count; rows round-trip', () => {
  const players = [{ slot: 2, side: Side.Left, look: { ...look, side: Side.Left } }, { slot: 0, side: Side.Left, look }, { slot: 1, side: Side.Right, look }];
  const entries = roomEntries(players, 6, n => ({ name: `CPU ${n}`, color: '#000000', type: TankType.Scout }));
  assert.deepEqual(entries.map(e => [e.side, e.owner && 'slot' in e.owner ? e.owner.slot : e.look.name]),
    [[Side.Left, 0], [Side.Left, 2], [Side.Left, 'CPU 1'], [Side.Right, 1], [Side.Right, 'CPU 2'], [Side.Right, 'CPU 3']]);
  assert.equal(entries[1].look.side, undefined);
  const rows = beginRows(entries);
  assert.deepEqual(rows[2].slice(0, 3), [2, -1, Side.Left]);
  assert.deepEqual(rowsToEntries(rows), entries);
});

test('settle: the runner’s battle state copied onto another device, crates included (contents hidden)', () => {
  const entries = [{ side: Side.Left, look, owner: { slot: 0 } }, { side: Side.Right, look, owner: null }];
  const runner = createBattle(seeded(3), MapId.GreenHills, entries), guest = createBattle(seeded(3), MapId.GreenHills, entries);
  runner.tanks[1].hearts = 25; runner.tanks[0].shield = true; runner.tanks[0].gripUntil = 3; runner.tanks[1].x += 10; runner.tanks[1].missile = true;
  addCrate(runner, 4, 500, Drop.Power);
  const msg = encodeSettle(runner, [[500, 600, 40]], [[0, Drop.Shield]]);
  const parsed = parseMessage({ from: 0, ...JSON.parse(JSON.stringify(msg)) }) as Extract<Msg, { t: 'settle' }>;
  assert.ok(parsed);
  applySettle(guest, parsed);
  assert.equal(guest.tanks[1].hearts, 25);
  assert.equal(guest.tanks[1].x, Math.round(runner.tanks[1].x * 100) / 100);
  assert.deepEqual([guest.tanks[0].shield, guest.tanks[0].gripUntil, guest.tanks[1].missile], [true, 3, true]);
  assert.deepEqual(guest.crates.map(c => [c.id, c.contents]), [[4, null]]);
  assert.equal(guest.nextCrate, 5);
  guest.crates[0].contents = Drop.Power; // learnt from a pick-up message
  applySettle(guest, parsed);
  assert.equal(guest.crates[0].contents, Drop.Power, 'a known crate keeps what it holds');
  applySettle(guest, { ...parsed, tanks: [[9, 0, 0, 0, 0, 0, 0, 0, -1, 0]], crates: [] });
  assert.equal(guest.crates.length, 0, 'unknown tanks are ignored; crates follow the runner');
});
