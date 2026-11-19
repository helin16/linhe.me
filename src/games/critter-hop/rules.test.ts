import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoardKind, CritterType as T, EndWhy, GameState, HopKind, SeatKind } from './enums.ts';
import { STALL_ROUNDS } from './constants.ts';
import { boardOf, type Board } from './boards.ts';
import { applyMove, endNow, findMove, finished, inTarget, legalMoves, movesOf, newGame, rowsLeft, type Game } from './rules.ts';

const P = SeatKind.Person, C = SeatKind.Computer;
const at = (b: Board, a: number, c: number) => { const i = b.holes.findIndex(([x, y]) => x === a && y === c); assert.ok(i >= 0, `${a},${c}`); return i; };
const dests = (g: Game, piece: number) => legalMoves(g, piece).map(m => m.path[m.path.length - 1]).sort((a, b) => a - b);
/** Puts the listed creatures at the given holes; the rest are taken off the board, or with `keep` stay where they are
 *  (games that go on after the move need every creature on the board). */
function arrange(g: Game, spots: [piece: number, hole: number][], keep = false) {
  if (keep) for (const [id] of spots) g.occupant[g.pieces[id].hole] = -1;
  else { g.occupant.fill(-1); for (const p of g.pieces) p.hole = -1; }
  for (const [id, hole] of spots) { g.pieces[id].hole = hole; g.occupant[hole] = id; }
  return g;
}
/** A target hole with a neighbour outside the target: [the hole, that neighbour]. */
function entry(g: Game, target: number[]): [number, number] {
  for (const h of target) for (const ray of g.board.rays[h]) if (ray.length && !target.includes(ray[0])) return [h, ray[0]];
  throw new Error('no entry');
}
/** Seat 0 one step from finishing: nine creatures in its target, the tenth beside the empty hole. Returns that move. */
function nearlyDone(g: Game) {
  const target = g.board.homes[g.seats[0].target], [last, beside] = entry(g, target);
  // whoever started in that target moves to seat 0's empty home; everyone else stays home
  const spots: [number, number][] = [...target.filter(h => h !== last).map((hole, i) => [i + 1, hole] as [number, number]), [0, beside]];
  for (const s of g.seats.slice(1)) {
    const home = s.home === g.seats[0].target ? g.board.homes[g.seats[0].home] : g.board.homes[s.home];
    home.forEach((hole, n) => spots.push([s.id * 10 + n, hole]));
  }
  arrange(g, spots);
  return legalMoves(g, 0).find(m => m.path.at(-1) === last)!;
}
const duo = (a: T, b: T, kinds = [P, C]) => newGame([{ kind: kinds[0], type: a }, { kind: kinds[1], type: b }]);

test('2 players: the star, opposite points, ten creatures each with one leader', () => {
  const g = duo(T.Fire, T.Water);
  assert.equal(g.board.kind, BoardKind.Star);
  assert.deepEqual(g.seats.map(s => [s.home, s.target]), [[0, 3], [3, 0]]);
  assert.equal(g.pieces.length, 20);
  assert.equal(g.pieces.filter(p => p.leader).length, 2);
  assert.deepEqual(g.pieces.filter(p => p.seat === 0).map(p => p.hole).sort(), [...g.board.homes[0]].sort());
  assert.equal(g.turn, 0);
  assert.equal(g.state, GameState.Playing);
});

test('4 players use the cross, 6 the whole star', () => {
  const four = newGame([T.Fire, T.Water, T.Grass, T.Rock].map(type => ({ kind: C, type })));
  assert.equal(four.board.kind, BoardKind.Cross);
  assert.deepEqual(four.seats.map(s => s.target), [2, 3, 0, 1]);
  const six = newGame([T.Fire, T.Water, T.Grass, T.Rock, T.Electric, T.Psychic].map(type => ({ kind: C, type, slot: 3 })));
  assert.equal(six.board.kind, BoardKind.Star);
  assert.equal(six.pieces.length, 60);
  assert.equal(six.seats[0].slot, 3);
});

test('steps go to every empty neighbour: 6 on the star, 8 on the cross', () => {
  const s = boardOf(BoardKind.Star), g = arrange(duo(T.Fire, T.Water), [[0, at(s, 0, 0)]]);
  assert.equal(legalMoves(g, 0).length, 6);
  assert.ok(legalMoves(g, 0).every(m => m.kinds[0] === HopKind.Step));
  const four = newGame([T.Fire, T.Water, T.Grass, T.Rock].map(type => ({ kind: C, type })));
  arrange(four, [[0, at(four.board, 0, 0)]]);
  assert.equal(legalMoves(four, 0).length, 8);
});

test('hops chain over any adjacent creature into the empty hole behind; hopped creatures stay', () => {
  const s = boardOf(BoardKind.Star);
  const g = arrange(duo(T.Fire, T.Fire), [[0, at(s, 0, 0)], [10, at(s, 1, 0)], [11, at(s, 3, 0)]], true);
  const m = legalMoves(g, 0).find(m => m.path.at(-1) === at(s, 4, 0))!;
  assert.deepEqual(m.kinds, [HopKind.Hop, HopKind.Hop]);
  assert.deepEqual(m.path, [at(s, 0, 0), at(s, 2, 0), at(s, 4, 0)]);
  applyMove(g, m);
  assert.equal(g.pieces[10].hole, at(s, 1, 0));
  assert.equal(g.occupant[at(s, 0, 0)], -1);
  assert.equal(g.occupant[at(s, 4, 0)], 0);
});

test('a hop chain never loops: each hole once, one move per destination', () => {
  const s = boardOf(BoardKind.Star);
  // a ring of creatures around (0,0) at distance 1 except one gap: lots of chains back toward the start
  const g = arrange(duo(T.Fire, T.Fire), [[0, at(s, 0, 0)], [10, at(s, 1, 0)], [11, at(s, 0, 1)], [12, at(s, -1, 1)], [13, at(s, -1, 0)], [14, at(s, 0, -1)]]);
  const d = dests(g, 0);
  assert.equal(new Set(d).size, d.length);
  assert.ok(!d.includes(at(s, 0, 0)));
});

test('long hop: Water over a Fire two holes away lands at the mirror point (FR-009, US1 #6)', () => {
  const s = boardOf(BoardKind.Star);
  const g = arrange(duo(T.Water, T.Fire), [[0, at(s, 0, 0)], [10, at(s, 2, 0)]]);
  const m = legalMoves(g, 0).find(m => m.path.at(-1) === at(s, 4, 0));
  assert.ok(m);
  assert.deepEqual(m.kinds, [HopKind.LongHop]);
  // not over a neutral type (Grass) at distance 2, and not if a hole beyond is taken
  assert.ok(!dests(arrange(duo(T.Water, T.Grass), [[0, at(s, 0, 0)], [10, at(s, 2, 0)]]), 0).includes(at(s, 4, 0)));
  assert.ok(!dests(arrange(duo(T.Water, T.Fire), [[0, at(s, 0, 0)], [10, at(s, 2, 0)], [11, at(s, 3, 0)]]), 0).includes(at(s, 4, 0)));
  // the landing must be on the board: a Fire three away needs six holes, the ray has four
  assert.ok(!legalMoves(arrange(duo(T.Water, T.Fire), [[0, at(s, 0, 0)], [10, at(s, 3, 0)]]), 0).some(m => m.kinds.includes(HopKind.LongHop)));
});

test('blocked hop: no hop over a type that beats you; the winner hops over normally', () => {
  const s = boardOf(BoardKind.Star);
  const g = arrange(duo(T.Water, T.Psychic), [[0, at(s, 0, 0)], [10, at(s, 1, 0)]]);
  assert.ok(!dests(g, 0).includes(at(s, 2, 0)), 'Water cannot hop a Psychic');
  assert.ok(dests(g, 0).includes(at(s, -1, 0)), 'it can still step');
  assert.ok(dests(g, 10).includes(at(s, -1, 0)), 'Psychic hops the Water');
  assert.ok(legalMoves(g, 10).every(m => !m.kinds.includes(HopKind.LongHop) || m.path.length === 2));
});

test('findMove: only the seat in turn, its own creature, and a path the rules give', () => {
  const g = duo(T.Fire, T.Water), m = movesOf(g, 0)[0];
  assert.deepEqual(findMove(g, 0, m.piece, m.path), m);
  assert.equal(findMove(g, 1, 10, movesOf(g, 1)[0].path), null, 'not its turn');
  assert.equal(findMove(g, 0, 10, m.path), null, 'not its creature');
  assert.equal(findMove(g, 0, 99, m.path), null);
  assert.equal(findMove(g, 0, m.piece, [m.path[0], m.path[0]]), null);
  assert.equal(findMove(g, 0, m.piece, [...m.path, 0]), null);
  applyMove(g, m);
  assert.equal(g.turn, 1);
  assert.ok(g.pieces[m.piece].left);
});

test('finishing: a full target with at least one own creature; never-moved blockers still count', () => {
  const g = duo(T.Fire, T.Water), target = g.board.homes[3];
  arrange(g, target.map((hole, i) => [i, hole] as [number, number]));
  assert.ok(finished(g, 0));
  // nine of ours and the opponent's leader that never left: still finished; once it has left, not
  arrange(g, [...target.slice(1).map((hole, i) => [i, hole] as [number, number]), [10, target[0]]]);
  assert.ok(finished(g, 0));
  g.pieces[10].left = true;
  assert.ok(!finished(g, 0));
  arrange(g, target.map((hole, i) => [10 + i, hole] as [number, number]));
  assert.ok(!finished(g, 0), 'none of ours: not finished');
  arrange(g, target.slice(1).map((hole, i) => [i, hole] as [number, number]));
  assert.ok(!finished(g, 0), 'a hole empty');
});

test('a 2-player game ends when one finishes; places and why', () => {
  const g = duo(T.Fire, T.Water);
  const r = applyMove(g, nearlyDone(g));
  assert.ok(r.finished);
  assert.equal(g.state, GameState.Over);
  assert.equal(g.why, EndWhy.Done);
  assert.deepEqual(g.order, [0, 1]);
  assert.equal(g.seats[1].place, 2);
});

test('the game ends once no person is still playing; all-computer games go on', () => {
  const kinds = [P, C, C, C];
  const g = newGame([T.Fire, T.Water, T.Grass, T.Rock].map((type, i) => ({ kind: kinds[i], type })));
  applyMove(g, nearlyDone(g));
  assert.equal(g.state, GameState.Over);
  assert.equal(g.order[0], 0);
  assert.equal(g.order.length, 4);
});

test('a seat with no legal move is skipped', () => {
  // seat 1 (Fire) still all at home, every way out taken by seat 0's Water creatures, which Fire cannot hop
  const g = duo(T.Water, T.Fire), home = g.board.homes[3];
  const exits = [...new Set(home.flatMap(h => g.board.rays[h].filter(r => r.length).map(r => r[0])).filter(h => !home.includes(h)))];
  arrange(g, exits.map((hole, i) => [i, hole] as [number, number]), true);
  assert.equal(movesOf(g, 1).length, 0);
  const r = applyMove(g, movesOf(g, 0).find(m => m.piece >= exits.length)!);
  assert.deepEqual(r.skipped, [1]);
  assert.equal(g.turn, 0);
  assert.equal(g.round, 2);
});

test('stall rule: 20 full rounds with no creature newly reaching its target ends the game, ranked', () => {
  const g = duo(T.Fire, T.Water, [C, C]);
  // shuffle one creature each back and forth: nobody arrives, and the count hasn't started
  const back = (seat: number) => { const m = movesOf(g, seat)[0]; applyMove(g, m); };
  for (let i = 0; i < STALL_ROUNDS * 2 + 2; i++) back(g.turn);
  assert.equal(g.state, GameState.Playing, 'no creature has reached a target yet: no stall count');
  assert.equal(g.stall, 0);
  g.pieces[19].arrived = true; // one has been there: from now on rounds without a new arrival count
  for (let i = 0; i < STALL_ROUNDS * 2 + 2 && g.state === GameState.Playing; i++) back(g.turn);
  assert.equal(g.state, GameState.Over);
  assert.equal(g.why, EndWhy.Stall);
  assert.equal(g.order.length, 2);
  assert.ok(g.stall >= STALL_ROUNDS);
});

test('End game ranks by creatures in target, then rows left, then seat', () => {
  const g = duo(T.Fire, T.Water);
  assert.equal(inTarget(g, 0), 0);
  assert.ok(rowsLeft(g, 0) > 0);
  applyMove(g, movesOf(g, 0).sort((a, b) => b.path.length - a.path.length)[0]);
  endNow(g);
  assert.equal(g.why, EndWhy.Ended);
  assert.deepEqual(g.order, rowsLeft(g, 0) <= rowsLeft(g, 1) ? [0, 1] : [1, 0]);
});
