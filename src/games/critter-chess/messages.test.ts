import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChessMsg, CritterType as T, Difficulty, PieceKind as K, SeatKind, SeatState } from './enums.ts';
import { allowedFrom, fromSync, parseMessage, seatSpecs, syncMsg, type Msg, type SeatRow } from './messages.ts';
import { applyMove, findMove, legalMoves, newGame, resign } from './rules.ts';

const seats: SeatRow[] = [[0, 0, T.Fire], [1, -1, T.Water]];
const ok = (m: object) => parseMessage({ from: 1, ...m });
const rowsOf = (g: { seats: { id: number; slot: number; type: T }[] }) => g.seats.map(s => [s.id, s.slot, s.type] as SeatRow);

test('well-formed messages pass', () => {
  assert.ok(ok({ t: ChessMsg.Pick, type: T.Rock }));
  assert.ok(ok({ t: ChessMsg.Types, types: [[0, T.Fire], [3, T.Rock]], level: Difficulty.Hard }));
  assert.ok(ok({ t: ChessMsg.Begin, seed: 5, seats }));
  assert.ok(ok({ t: ChessMsg.Turn, seat: 1, left: 60000 }));
  assert.ok(ok({ t: ChessMsg.Move, seat: 0, at: 12, to: 28 }));
  assert.ok(ok({ t: ChessMsg.Move, seat: 0, at: 52, to: 60, promo: K.Knight }));
  assert.ok(parseMessage({ ...syncMsg(newGame(seatSpecs(seats)), 7, 1234, rowsOf(newGame(seatSpecs(seats)))), from: 0 }));
});

test('malformed messages are dropped', () => {
  for (const bad of [null, 'x', [], { t: ChessMsg.Pick, type: T.Fire }, { from: 1, t: 'boom' }]) assert.equal(parseMessage(bad), null);
  for (const m of [
    { t: ChessMsg.Pick, type: 'Ice' }, { t: ChessMsg.Types, types: [[0, 'Ice']], level: Difficulty.Easy },
    { t: ChessMsg.Begin, seed: -1, seats }, { t: ChessMsg.Begin, seed: 1, seats: [[0, 0, T.Fire]] },
    { t: ChessMsg.Begin, seed: 1, seats: [[0, 0, T.Fire], [1, 2, T.Fire]] }, { t: ChessMsg.Begin, seed: 1, seats: [[1, 0, T.Fire], [0, 2, T.Water]] },
    { t: ChessMsg.Turn, seat: 9, left: 0 }, { t: ChessMsg.Turn, seat: 0, left: 1e9 },
    { t: ChessMsg.Move, seat: 0, at: -1, to: 2 }, { t: ChessMsg.Move, seat: 0, at: 1, to: 9999 }, { t: ChessMsg.Move, seat: 0, at: 1, to: 2, promo: K.King },
  ]) assert.equal(ok(m), null, JSON.stringify(m));
  const sync = { ...syncMsg(newGame(seatSpecs(seats)), 7, 0, rowsOf(newGame(seatSpecs(seats)))), from: 0 };
  for (const change of [{ pieces: [[0, K.King, 0, 0], [0, K.King, 1, 0]] }, { pieces: [[99, K.King, 0, 0]] }, { pieces: [[1, 'Dragon', 0, 0]] },
    { places: [null] }, { places: [null, 3] }, { turn: 5 }, { left: -1 }, { ep: [1] }, { keys: [['x', 0]] }, { seed: 'x' }])
    assert.equal(parseMessage({ ...sync, ...change }), null, JSON.stringify(change).slice(0, 50));
});

test('sync: the seats as the game began, and who plays each now (a computer stands in for a dropped player)', () => {
  const begun: SeatRow[] = [[0, 0, T.Fire], [1, 3, T.Water]], g = newGame(seatSpecs(begun));
  g.seats[1].slot = -1; g.seats[1].kind = SeatKind.Computer; // seat 1's player dropped
  const m = parseMessage({ ...syncMsg(g, 1, 0, begun), from: 0 }) as Extract<Msg, { t: typeof ChessMsg.Sync }>;
  assert.deepEqual(m.seats, begun, 'the rejoiner keeps the original seats, to hand seat 1 back later');
  const back = fromSync(m);
  assert.equal(back.seats[1].kind, SeatKind.Computer);
  assert.equal(back.seats[1].slot, -1);
  assert.equal(parseMessage({ ...syncMsg(g, 1, 0, begun), now: [0], from: 0 }), null, 'one entry per seat');
});

test('an inconsistent sync is dropped: turn with a seat that is out, a seat in without a king, pieces of a seat out, a fake en passant pawn, a finished game', () => {
  const g = newGame(seatSpecs([[0, 0, T.Fire], [1, -1, T.Water], [2, -1, T.Grass], [3, -1, T.Rock]]));
  resign(g, 2);
  const base = { ...syncMsg(g, 1, 0, rowsOf(g)), from: 0 };
  assert.ok(parseMessage(base));
  assert.equal(parseMessage({ ...base, turn: 2 }), null, 'seat 2 is out');
  assert.equal(parseMessage({ ...base, pieces: base.pieces.filter(p => !(p[1] === K.King && p[2] === 1)) }), null, 'seat 1 has no king');
  assert.equal(parseMessage({ ...base, pieces: [...base.pieces, [0, K.Pawn, 2, 0]] }), null, 'pieces of an out seat');
  const two = newGame(seatSpecs(seats));
  const s2 = { ...syncMsg(two, 1, 0, seats), from: 0 };
  assert.equal(parseMessage({ ...s2, ep: [20, 4] }), null, 'e1 holds a king, not a pawn');
  assert.equal(parseMessage({ ...s2, places: [null, 2] }), null, 'a finished game');
});

test('who may send what', () => {
  const m = (t: string, from: number) => ({ t, from }) as Msg;
  assert.ok(allowedFrom(m(ChessMsg.Pick, 4), 0, 0, -1));
  assert.ok(allowedFrom(m(ChessMsg.Types, 0), 2, 0, -1) && !allowedFrom(m(ChessMsg.Types, 2), 2, 0, -1));
  for (const t of [ChessMsg.Begin, ChessMsg.Turn, ChessMsg.Sync]) { assert.ok(allowedFrom(m(t, 1), 1, 0, 3)); assert.ok(!allowedFrom(m(t, 3), 1, 0, 3)); }
  assert.ok(allowedFrom(m(ChessMsg.Move, 3), 1, 0, 3) && allowedFrom(m(ChessMsg.Move, 1), 1, 0, -1) && !allowedFrom(m(ChessMsg.Move, 2), 1, 0, 3));
});

test('sync carries the whole game: pieces, outs, turn, en passant and repetition history', () => {
  const g = newGame(seatSpecs(seats));
  for (const [a, b] of [[12, 28], [52, 44], [28, 36], [51, 35]]) applyMove(g, findMove(g, g.turn, a, b)!); // e4 e6 e5 d5: en passant on d6
  assert.ok(g.ep >= 0);
  const back = fromSync(parseMessage({ ...syncMsg(g, 11, 4321, rowsOf(g)), from: 0 }) as Extract<Msg, { t: typeof ChessMsg.Sync }>);
  assert.deepEqual([...back.at].map(id => id < 0 ? null : [back.pieces[id].kind, back.pieces[id].seat]), [...g.at].map(id => id < 0 ? null : [g.pieces[id].kind, g.pieces[id].seat]));
  assert.deepEqual([back.turn, back.ep, back.quiet, [...back.keys]], [g.turn, g.ep, g.quiet, [...g.keys]]);
  assert.ok(legalMoves(back, 0).some(m => m.ep), 'en passant survives the sync');
  const four = newGame(seatSpecs([[0, 0, T.Fire], [1, -1, T.Water], [2, -1, T.Grass], [3, -1, T.Rock]]));
  resign(four, 2);
  const f = fromSync(parseMessage({ ...syncMsg(four, 1, 0, rowsOf(four)), from: 0 }) as Extract<Msg, { t: typeof ChessMsg.Sync }>);
  assert.equal(f.seats[2].state, SeatState.Out); assert.equal(f.seats[2].place, 4); assert.equal(f.seats[1].state, SeatState.Playing);
});
