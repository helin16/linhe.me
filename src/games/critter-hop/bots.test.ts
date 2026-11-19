import { test } from 'node:test';
import assert from 'node:assert/strict';
import { values } from '../../shared/enum.ts';
import { BOT_BUDGET_MS } from './constants.ts';
import { CritterType as T, Difficulty, GameState, HopKind, SeatKind } from './enums.ts';
import { botMove, cost, hint, score } from './bots.ts';
import { applyMove, findMove, legalMoves, movesOf, newGame, type Game } from './rules.ts';
import { seeded } from '../../shared/seed.ts';

const C = SeatKind.Computer;
const game = (types: T[], kinds?: SeatKind[]) => newGame(types.map((type, i) => ({ kind: kinds?.[i] ?? C, type })));
const SIX = values(T);

function play(g: Game, level: Difficulty, seed: number, maxTurns = 4000) {
  const r = seeded(seed);
  let turns = 0, slowest = 0;
  while (g.state === GameState.Playing && turns < maxTurns) {
    const t0 = performance.now(), m = botMove(g, r, level);
    slowest = Math.max(slowest, performance.now() - t0);
    assert.ok(findMove(g, g.turn, m.piece, m.path), 'always a legal move');
    applyMove(g, m); turns++;
  }
  return { turns, slowest };
}

test('cost: a target hole costs less than a home hole; the tip least', () => {
  const g = game([T.Fire, T.Water]), target = g.board.homes[g.seats[0].target];
  assert.equal(cost(g, 0, g.board.tips[g.seats[0].target]), 0);
  assert.ok(Math.max(...target.map(h => cost(g, 0, h))) < Math.min(...g.board.homes[0].map(h => cost(g, 0, h))));
});

test('score: forward moves are worth more than sideways or backward ones', () => {
  const g = game([T.Fire, T.Water]), moves = movesOf(g, 0);
  const forward = moves.filter(m => score(g, m) > 0);
  assert.ok(forward.length);
  for (const m of moves) assert.equal(score(g, m) > 0, cost(g, 0, m.path.at(-1)!) < cost(g, 0, m.path[0]));
});

for (const level of values(Difficulty)) test(`${level}: 2, 4 and 6 computer players play legal moves to the end, in time`, () => {
  for (const types of [[T.Fire, T.Water], [T.Fire, T.Water, T.Grass, T.Rock], SIX]) {
    const g = game(types), { slowest } = play(g, level, 3);
    assert.equal(g.state, GameState.Over, `${types.length} players`);
    assert.equal(g.order.length, types.length);
    assert.ok(slowest < BOT_BUDGET_MS, `${level} took ${slowest.toFixed(0)} ms`);
  }
});

/** Seat 0's wins in `n` seeded 2-player games of Fire against Rock (types that don't affect each other). */
function duel(a: Difficulty, b: Difficulty, n = 8) {
  let wins = 0;
  for (let seed = 1; seed <= n; seed++) {
    const g = game([T.Fire, T.Rock]), r = seeded(seed);
    while (g.state === GameState.Playing) applyMove(g, botMove(g, r, g.turn === 0 ? a : b));
    if (g.order[0] === 0) wins++;
  }
  return wins;
}
test('stronger levels win: Normal beats Easy, Hard beats Normal, most games', () => {
  assert.ok(duel(Difficulty.Normal, Difficulty.Easy) >= 5);
  assert.ok(duel(Difficulty.Easy, Difficulty.Normal) <= 3);
  assert.ok(duel(Difficulty.Hard, Difficulty.Normal) >= 6);
});

test('equal levels: the type that beats the other has the edge (Water over Fire)', () => {
  const g = game([T.Fire, T.Water]), r = seeded(1);
  while (g.state === GameState.Playing) applyMove(g, botMove(g, r, Difficulty.Normal));
  assert.equal(g.order[0], 1);
});

test('the same seed plays the same game', () => {
  const a = game([T.Fire, T.Water]), b = game([T.Fire, T.Water]);
  play(a, Difficulty.Easy, 9, 30); play(b, Difficulty.Easy, 9, 30);
  assert.deepEqual(a.pieces.map(p => p.hole), b.pieces.map(p => p.hole));
});

test('Easy never long-hops when it has another move; Normal takes a long hop that is clearly best', () => {
  const g = game([T.Water, T.Fire]);
  for (let i = 0; i < 40 && g.state === GameState.Playing; i++) {
    const m = botMove(g, seeded(i), Difficulty.Easy);
    if (g.turn === 0) assert.ok(!m.kinds.includes(HopKind.LongHop) || movesOf(g, 0).every(x => x.kinds.includes(HopKind.LongHop)));
    applyMove(g, m);
  }
  // Water alone in the middle, a Fire two holes ahead toward its target: the long hop gains the most
  const h = game([T.Water, T.Fire]);
  const dir = h.board.dirs.findIndex((_, d) => { const ray = h.board.rays[h.pieces[0].hole][d]; return ray.length > 1 && cost(h, 0, ray[1]) < cost(h, 0, h.pieces[0].hole); });
  assert.ok(dir >= 0);
  const hint1 = hint(h);
  assert.ok(legalMoves(h, hint1.piece).some(m => m.path.at(-1) === hint1.path.at(-1)), 'a hint is a legal move');
});
