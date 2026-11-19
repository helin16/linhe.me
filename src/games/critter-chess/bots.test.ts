import { test } from 'node:test';
import assert from 'node:assert/strict';
import { values } from '../../shared/enum.ts';
import { BOT_BUDGET_MS } from './constants.ts';
import { BoardKind, CritterType as T, Difficulty, GameState, PieceKind as K, SeatKind } from './enums.ts';
import { boardOf } from './boards.ts';
import { botMove, evaluate, hint, outcome, quickScore } from './bots.ts';
import { applyMove, findMove, legalMoves, newGame, setPieces, type Game } from './rules.ts';
import { seeded } from '../../shared/seed.ts';

const C = SeatKind.Computer, SQ = boardOf(BoardKind.Square);
const sq = (n: string) => SQ.cells.findIndex(([x, y]) => x === n.charCodeAt(0) - 97 && y === Number(n[1]) - 1);
const game = (n: number) => newGame(values(T).slice(0, n).map(type => ({ kind: C, type })));
const position = (list: [number, K, string][]) => { const g = game(2); setPieces(g, list.map(([seat, kind, c]) => ({ seat, kind, cell: sq(c), moved: true }))); return g; };

function play(g: Game, levels: Difficulty[], seed: number, maxPlies: number, budget?: number) {
  const r = seeded(seed);
  let slowest = 0;
  for (let i = 0; i < maxPlies && g.state === GameState.Playing; i++) {
    const t0 = performance.now(), m = botMove(g, r, levels[g.turn % levels.length], budget);
    slowest = Math.max(slowest, performance.now() - t0);
    assert.ok(findMove(g, g.turn, m.from, m.to, m.promo), 'always legal');
    applyMove(g, m);
  }
  return slowest;
}

test('evaluate: material first; the start position is even', () => {
  assert.ok(Math.abs(evaluate(game(2), 0) - evaluate(game(2), 1)) < 1e-9);
  const g = position([[0, K.King, 'e1'], [0, K.Queen, 'd1'], [1, K.King, 'e8']]);
  assert.ok(evaluate(g, 0) > 8 && evaluate(g, 1) < -8);
});

test('Normal does not leave its queen where it can be taken for free', () => {
  // the white queen can go to d5 (attacked by a black pawn on e6, unprotected) or stay safe
  const g = position([[0, K.King, 'e1'], [0, K.Queen, 'd1'], [1, K.King, 'e8'], [1, K.Pawn, 'e6']]);
  const bad = findMove(g, 0, sq('d1'), sq('d5'))!;
  assert.ok(quickScore(g, bad) < quickScore(g, findMove(g, 0, sq('d1'), sq('d2'))!));
  assert.notEqual(botMove(g, seeded(1), Difficulty.Normal).to, sq('d5'));
});

test('Hard finds mate in one; Normal takes a free queen', () => {
  const mate = position([[0, K.King, 'g6'], [0, K.Queen, 'a7'], [1, K.King, 'h8']]);
  const m = botMove(mate, seeded(1), Difficulty.Hard);
  applyMove(mate, m);
  assert.equal(mate.state, GameState.Over);
  assert.equal(mate.order[0], 0);
  const free = position([[0, K.King, 'e1'], [0, K.Rook, 'a1'], [1, K.King, 'e8'], [1, K.Queen, 'a5']]);
  assert.equal(botMove(free, seeded(1), Difficulty.Normal).to, sq('a5'));
});

test('Easy plays legal random moves; the same seed repeats', () => {
  const a = game(2), b = game(2);
  play(a, [Difficulty.Easy], 7, 20); play(b, [Difficulty.Easy], 7, 20);
  assert.deepEqual(a.pieces.map(p => p.cell), b.pieces.map(p => p.cell));
});

for (const n of [2, 4, 6]) test(`${n} players: every level moves legally within the budget`, () => {
  for (const level of values(Difficulty)) {
    const slowest = play(game(n), [level], 3, n * 3);
    assert.ok(slowest < BOT_BUDGET_MS + 300, `${level}: ${slowest.toFixed(0)} ms`);
  }
});

test('6 players, mid-game: Normal and Hard still move within the budget', () => {
  const g = game(6);
  play(g, [Difficulty.Easy], 5, 60);
  for (const level of [Difficulty.Normal, Difficulty.Hard]) {
    const t0 = performance.now();
    botMove(g, seeded(1), level);
    assert.ok(performance.now() - t0 < BOT_BUDGET_MS + 300, level);
  }
  const t0 = performance.now();
  botMove(g, seeded(1), Difficulty.Normal, 1); // a tiny budget: the deadline is honoured
  assert.ok(performance.now() - t0 < 200);
});

test('stronger levels win: Normal beats Easy, Hard beats Normal, most games (2 players)', () => {
  const duel = (a: Difficulty, b: Difficulty, budget?: number) => {
    let wins = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const g = game(2);
      play(g, seed % 2 ? [a, b] : [b, a], seed, 300, budget);
      const aSeat = seed % 2 ? 0 : 1;
      if (g.state === GameState.Over && g.order[0] === aSeat && g.seats[aSeat].place === 1 && g.seats[1 - aSeat].place === 2) wins++;
      else if (g.state === GameState.Playing && evaluate(g, aSeat) > 3) wins++; // clearly ahead when the test stops
    }
    return wins;
  };
  assert.ok(duel(Difficulty.Normal, Difficulty.Easy) >= 3);
  assert.ok(duel(Difficulty.Hard, Difficulty.Normal, 150) >= 3);
});

test('outcome: a win, a loss, and a shared first place is a draw even with a seat already out', () => {
  const g = game(4);
  g.seats[3].place = 4; g.seats[0].place = 1; g.seats[1].place = 1; g.seats[2].place = 1;
  assert.equal(outcome(g, 0, 0), 0);
  g.seats[1].place = 2; g.seats[2].place = 3;
  assert.ok(outcome(g, 0, 0) > 0 && outcome(g, 1, 0) < 0);
});

test('hint is a legal move', () => {
  const g = game(4), h = hint(g);
  assert.ok(legalMoves(g, g.turn).some(m => m.from === h.from && m.to === h.to));
});
