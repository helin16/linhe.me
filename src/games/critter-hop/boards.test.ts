import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PIECES } from './constants.ts';
import { BoardKind } from './enums.ts';
import { boardFor, boardOf, distance, homesFor } from './boards.ts';

const STAR = boardOf(BoardKind.Star), CROSS = boardOf(BoardKind.Cross);

test('the star has 121 holes, six homes of ten, 6 directions', () => {
  assert.equal(STAR.holes.length, 121);
  assert.equal(STAR.dirs.length, 6);
  assert.equal(STAR.homes.length, 6);
  for (const h of STAR.homes) assert.equal(h.length, PIECES);
});

test('the cross has 105 holes, four homes of ten, 8 directions', () => {
  assert.equal(CROSS.holes.length, 105);
  assert.equal(CROSS.dirs.length, 8);
  assert.equal(CROSS.homes.length, 4);
  for (const h of CROSS.homes) assert.equal(h.length, PIECES);
});

for (const b of [STAR, CROSS]) test(`${b.kind}: homes are apart, opposites pair up, rays stay on the board`, () => {
  assert.equal(new Set(b.homes.flat()).size, b.homes.length * PIECES);
  b.opposite.forEach((o, h) => { assert.notEqual(o, h); assert.equal(b.opposite[o], h); });
  for (const rays of b.rays) for (const ray of rays) for (const i of ray) assert.ok(i >= 0 && i < b.holes.length);
  for (let i = 0; i < b.holes.length; i++) for (const ray of b.rays[i]) ray.forEach((j, k) => assert.equal(distance(b, i, j), k + 1));
  // a home's own holes are rows 0..3 (star) or 0..1 (cross) from its outer row, and no other hole is that close
  b.homes.forEach((home, h) => {
    const near = Math.max(...home.map(i => b.rows[h][i]));
    assert.equal(b.holes.filter((_, i) => b.rows[h][i] <= near).length, PIECES);
    assert.equal(b.rows[h][b.tips[h]], 0);
    assert.ok(home.includes(b.tips[h]));
  });
  // home 0 is nearest the player (largest y), then clockwise on screen: left next
  const cy = (h: number) => b.homes[h].reduce((s, i) => s + b.pos[i][1], 0);
  const cx = (h: number) => b.homes[h].reduce((s, i) => s + b.pos[i][0], 0);
  assert.ok(b.homes.every((_, h) => cy(0) >= cy(h)));
  assert.ok(cx(1) < 0);
});

test('the cross tip is the middle of the outer row; the star tip is its point', () => {
  assert.deepEqual(CROSS.holes[CROSS.tips[0]], [0, 6]);
  assert.equal(STAR.rays[STAR.tips[0]].filter(r => r.length).length, 2, 'a star tip has two neighbours');
});

test('which board and homes each player count uses', () => {
  assert.equal(boardFor(2), STAR);
  assert.equal(boardFor(6), STAR);
  assert.equal(boardFor(4), CROSS);
  assert.deepEqual(homesFor(2), [0, 3]);
  assert.deepEqual(homesFor(4), [0, 1, 2, 3]);
  assert.deepEqual(homesFor(6), [0, 1, 2, 3, 4, 5]);
  assert.equal(STAR.opposite[0], 3);
  assert.equal(CROSS.opposite[1], 3);
});
