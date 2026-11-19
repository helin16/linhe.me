import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoardKind } from './enums.ts';
import { BACK_RANK, boardFor, boardOf } from './boards.ts';

const SQ = boardOf(BoardKind.Square), CROSS = boardOf(BoardKind.Cross), HEX = boardOf(BoardKind.Hex);
const at = (b: typeof SQ, a: number, c: number) => b.cells.findIndex(([x, y]) => x === a && y === c);

test('cell counts and armies per board; each army 16 distinct cells, no two armies overlap', () => {
  for (const [b, cells, armies] of [[SQ, 64, 2], [CROSS, 160, 4], [HEX, 397, 6]] as const) {
    assert.equal(b.cells.length, cells, b.kind);
    assert.equal(b.armies.length, armies);
    const all = b.armies.flatMap(a => [...a.back, ...a.pawns]);
    assert.ok(all.every(i => i >= 0), `${b.kind}: every start cell is on the board`);
    assert.equal(new Set(all).size, armies * 16, b.kind);
  }
  assert.equal(boardFor(2), SQ); assert.equal(boardFor(4), CROSS); assert.equal(boardFor(6), HEX);
});

test('8 × 8: standard start, pawn steps and promotion, castling cells', () => {
  const [white, black] = SQ.armies;
  assert.deepEqual(white.back, [0, 1, 2, 3, 4, 5, 6, 7].map(x => at(SQ, x, 0)));
  assert.equal(BACK_RANK[3], 'Queen');
  assert.equal(black.back[3], at(SQ, 3, 7), 'both queens on the d-file');
  const e2 = at(SQ, 4, 1);
  assert.equal(white.pawnStep[e2], at(SQ, 4, 2));
  assert.equal(white.pawnDouble[e2], at(SQ, 4, 3));
  assert.equal(white.pawnDouble[at(SQ, 4, 2)], -1);
  assert.deepEqual([...white.pawnCaptures[e2]].sort(), [at(SQ, 3, 2), at(SQ, 5, 2)].sort());
  assert.equal(black.pawnStep[at(SQ, 4, 6)], at(SQ, 4, 5));
  assert.equal(white.promote[at(SQ, 0, 7)], 1);
  assert.equal(black.promote[at(SQ, 0, 0)], 1);
  const [short, long] = white.castles;
  assert.equal(short.kingTo, at(SQ, 6, 0)); assert.equal(short.rookTo, at(SQ, 5, 0));
  assert.deepEqual(short.empty, [at(SQ, 5, 0), at(SQ, 6, 0)]);
  assert.equal(long.kingTo, at(SQ, 2, 0)); assert.equal(long.rookTo, at(SQ, 3, 0));
  assert.deepEqual(long.empty, [at(SQ, 3, 0), at(SQ, 2, 0), at(SQ, 1, 0)]);
});

test('8 × 8 tables: rays, knight and king counts', () => {
  const d4 = at(SQ, 3, 3), a1 = at(SQ, 0, 0);
  assert.equal(SQ.knight[d4].length, 8);
  assert.equal(SQ.knight[a1].length, 2);
  assert.equal(SQ.king[d4].length, 8);
  assert.equal(SQ.straight[d4].flat().length, 14);
  assert.equal(SQ.diagonal[d4].flat().length, 13);
});

test('cross: 160 cells, armies on four arms facing in, queen on each army’s own left, promotion at the middle', () => {
  const [south, west, north, east] = CROSS.armies;
  assert.equal(CROSS.cells.findIndex(([x, y]) => x < 3 && y < 3), -1, 'no corners');
  assert.deepEqual(south.back.slice(3, 5).map(i => CROSS.cells[i]), [[6, 0], [7, 0]], 'red: Q g1, K h1');
  assert.deepEqual(north.back.slice(3, 5).map(i => CROSS.cells[i]), [[7, 13], [6, 13]], 'yellow: Q h14, K g14');
  assert.equal(CROSS.cells[west.back[0]][0], 0);
  assert.equal(CROSS.cells[east.back[0]][0], 13);
  assert.equal(south.promote[CROSS.cells.findIndex(([x, y]) => x === 5 && y === 7)], 1);
  assert.equal(west.promote[CROSS.cells.findIndex(([x, y]) => x === 7 && y === 5)], 1);
  assert.equal(south.castles.length, 2);
});

test('hexagon: side 12, 12 knight jumps and 12 king steps in the middle, pawns step toward the far side', () => {
  const mid = HEX.cells.findIndex(([q, r]) => q === 0 && r === 0);
  assert.equal(HEX.knight[mid].length, 12);
  assert.equal(HEX.king[mid].length, 12);
  assert.equal(HEX.straight[mid].length, 6);
  assert.equal(HEX.diagonal[mid].length, 6);
  assert.ok(HEX.straight[mid].every(r => r.length === 11), 'straight rays reach the edge');
  for (const army of HEX.armies) {
    assert.equal(army.castles.length, 0);
    for (const p of army.pawns) {
      assert.ok(army.pawnStep[p] >= 0, 'every starting pawn can step');
      assert.equal(army.pawnCaptures[p].length, 2);
      assert.equal(army.promote[p], 0);
    }
  }
  // the near army steps up the screen (smaller y)
  const near = HEX.armies[0], p = near.pawns[3];
  assert.ok(HEX.pos[near.pawnStep[p]][1] < HEX.pos[p][1]);
  assert.ok(Math.abs(HEX.pos[near.pawnStep[p]][0] - HEX.pos[p][0]) < 1e-9, 'straight ahead');
  const ring = (c: number) => { const [q, r] = HEX.cells[c]; return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); };
  assert.ok(HEX.armies.every(a => a.back.every(c => ring(c) === 11) && a.pawns.every(c => ring(c) === 9)), 'back rank on the edge, pawns two rows in');
});
