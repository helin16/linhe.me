import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CritterType as T, Difficulty, GameState, HopMsg, SeatKind } from './enums.ts';
import { allowedFrom, freeType, fromSync, nextRunner, parseMessage, roomSeats, seatSpecs, syncMsg, takeType, type Msg, type SeatRow } from './messages.ts';
import { applyMove, movesOf, newGame } from './rules.ts';
import { seeded } from './seed.ts';

const seats: SeatRow[] = [[0, 0, T.Fire], [1, -1, T.Water]];
const ok = (m: object) => parseMessage({ from: 1, ...m });

test('well-formed messages pass', () => {
  assert.ok(ok({ t: HopMsg.Pick, type: T.Rock }));
  assert.ok(ok({ t: HopMsg.Types, types: [[0, T.Fire], [3, T.Rock]], level: Difficulty.Hard }));
  assert.ok(ok({ t: HopMsg.Begin, seed: 5, seats }));
  assert.ok(ok({ t: HopMsg.Turn, seat: 1, left: 60000, round: 3, stall: 0 }));
  assert.ok(ok({ t: HopMsg.Move, seat: 0, piece: 3, path: [10, 20, 30] }));
  const g = newGame(seatSpecs(seats));
  assert.ok(parseMessage({ ...syncMsg(g, 7, 1234), from: 0 }));
});

test('malformed messages are dropped', () => {
  for (const bad of [null, 'x', [], { t: HopMsg.Pick, type: T.Fire }, { from: 1, t: 'boom' }]) assert.equal(parseMessage(bad), null);
  for (const m of [
    { t: HopMsg.Pick, type: 'Ice' },
    { t: HopMsg.Types, types: [[0, 'Ice']], level: Difficulty.Easy }, { t: HopMsg.Types, types: [], level: 'Max' },
    { t: HopMsg.Begin, seed: -1, seats }, { t: HopMsg.Begin, seed: 1, seats: [[0, 0, T.Fire]] }, // 1 seat
    { t: HopMsg.Begin, seed: 1, seats: [[0, 0, T.Fire], [1, 2, T.Fire]] }, // same type twice
    { t: HopMsg.Begin, seed: 1, seats: [[1, 0, T.Fire], [0, 2, T.Water]] }, // out of order
    { t: HopMsg.Turn, seat: 9, left: 0, round: 1, stall: 0 }, { t: HopMsg.Turn, seat: 0, left: 1e9, round: 1, stall: 0 },
    { t: HopMsg.Move, seat: 0, piece: 3, path: [10] }, { t: HopMsg.Move, seat: 0, piece: 3, path: [10, 10] },
    { t: HopMsg.Move, seat: 0, piece: 99, path: [1, 2] }, { t: HopMsg.Move, seat: 0, piece: 1, path: [1, 999] },
    { t: HopMsg.Sync, seed: 1, seats, holes: [], flags: [], order: [0, 0], progress: 0, turn: { seat: 0, left: 0, round: 1, stall: 0 } },
  ]) assert.equal(ok(m), null, JSON.stringify(m));
  const g = newGame(seatSpecs(seats)), sync = { ...syncMsg(g, 7, 0), from: 0 };
  for (const change of [{ holes: sync.holes.slice(1) }, { holes: sync.holes.map(() => 0) }, { flags: [] }, { progress: 2 },
    { turn: { ...sync.turn, seat: 5 } }, { order: [5, 0] }, { turn: null }, { seed: 'x' }]) assert.equal(parseMessage({ ...sync, ...change }), null, JSON.stringify(change).slice(0, 40));
});

test('who may send what', () => {
  const m = (t: string, from: number) => ({ t, from }) as Msg;
  assert.ok(allowedFrom(m(HopMsg.Pick, 4), 0, 0, -1));
  assert.ok(allowedFrom(m(HopMsg.Types, 0), 2, 0, -1));
  assert.ok(!allowedFrom(m(HopMsg.Types, 2), 2, 0, -1));
  for (const t of [HopMsg.Begin, HopMsg.Turn, HopMsg.Sync]) {
    assert.ok(allowedFrom(m(t, 1), 1, 0, 3));
    assert.ok(!allowedFrom(m(t, 3), 1, 0, 3));
  }
  assert.ok(allowedFrom(m(HopMsg.Move, 3), 1, 0, 3), 'the seat’s own player');
  assert.ok(allowedFrom(m(HopMsg.Move, 1), 1, 0, -1), 'the runner, for a computer');
  assert.ok(!allowedFrom(m(HopMsg.Move, 2), 1, 0, 3));
});

test('runner hand-over and type picks', () => {
  assert.equal(nextRunner(2, [0, 2, 5]), 2);
  assert.equal(nextRunner(2, [3, 5]), 3);
  assert.equal(nextRunner(2, []), -1);
  const types = new Map<number, T>();
  assert.ok(takeType(types, 0, T.Water));
  assert.ok(!takeType(types, 1, T.Water), 'taken');
  assert.ok(takeType(types, 0, T.Fire), 'changing your own pick');
  assert.ok(takeType(types, 1, T.Water));
  const r = seeded(1);
  for (let i = 0; i < 20; i++) assert.ok(!([T.Fire, T.Water] as T[]).includes(freeType([T.Fire, T.Water], r)));
});

test('room seats: players in slot order with their picks, free types for the rest, computers fill up', () => {
  const rows = roomSeats([4, 0], new Map([[0, T.Water], [4, T.Grass]]), 4, seeded(2));
  assert.deepEqual(rows.slice(0, 2), [[0, 0, T.Water], [1, 4, T.Grass]]);
  assert.deepEqual(rows.slice(2).map(r => r[1]), [-1, -1]);
  assert.equal(new Set(rows.map(r => r[2])).size, 4);
  // a clash (can't normally happen): the lower slot keeps it, the other gets a free one; no pick → free
  const clash = roomSeats([0, 1, 2], new Map([[0, T.Fire], [1, T.Fire]]), 6, seeded(3));
  assert.equal(clash[0][2], T.Fire);
  assert.notEqual(clash[1][2], T.Fire);
  assert.equal(new Set(clash.map(r => r[2])).size, 6);
  assert.deepEqual(seatSpecs(rows).map(s => s.kind), [SeatKind.Person, SeatKind.Person, SeatKind.Computer, SeatKind.Computer]);
});

test('sync carries the whole game: a rejoiner gets the same board, flags, places and turn', () => {
  const g = newGame(seatSpecs([[0, 0, T.Fire], [1, 3, T.Water], [2, -1, T.Grass], [3, -1, T.Rock]]));
  for (let i = 0; i < 9; i++) applyMove(g, movesOf(g, g.turn)[0]);
  g.seats[2].place = 1; g.order = [2]; g.pieces[5].arrived = true;
  const back = fromSync(parseMessage({ ...syncMsg(g, 11, 4321), from: 0 }) as Extract<Msg, { t: typeof HopMsg.Sync }>);
  assert.deepEqual(back.pieces.map(p => [p.hole, p.left, p.arrived]), g.pieces.map(p => [p.hole, p.left, p.arrived]));
  assert.deepEqual([...back.occupant], [...g.occupant]);
  assert.deepEqual([back.turn, back.round, back.stall, back.progress, back.order, back.state], [g.turn, g.round, g.stall, g.progress, g.order, GameState.Playing]);
  assert.equal(back.seats[2].place, 1);
  assert.equal(back.seats[1].slot, 3);
});
