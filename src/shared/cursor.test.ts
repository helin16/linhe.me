import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARROWS, nextSpot } from './cursor.ts';

const Arrow = { Up: ARROWS.ArrowUp, Down: ARROWS.ArrowDown, Left: ARROWS.ArrowLeft, Right: ARROWS.ArrowRight };

const grid = [{ id: 0, x: 0, y: 0 }, { id: 1, x: 10, y: 0 }, { id: 2, x: 20, y: 1 }, { id: 3, x: 0, y: 10 }, { id: 4, x: 9, y: 9 }, { id: 5, x: -10, y: -1 }];

test('arrows go to the nearest spot that way', () => {
  assert.equal(nextSpot(grid[0], grid, Arrow.Right).id, 1);
  assert.equal(nextSpot(grid[1], grid, Arrow.Right).id, 2);
  assert.equal(nextSpot(grid[0], grid, Arrow.Down).id, 3);
  assert.equal(nextSpot(grid[0], grid, Arrow.Left).id, 5);
  assert.equal(nextSpot(grid[3], grid, Arrow.Up).id, 0);
});

test('nothing that way (or only far off to the side): stay put', () => {
  assert.equal(nextSpot(grid[2], grid, Arrow.Right).id, 2);
  assert.equal(nextSpot(grid[0], [grid[0], { id: 9, x: 1, y: 10 }], Arrow.Right).id, 0);
  assert.equal(nextSpot(grid[0], [grid[0], { id: 7, x: 0, y: 0 }], Arrow.Up).id, 0, 'a spot on top of us is ignored');
});

test('a straight-on spot beats a slightly nearer one off to the side', () => {
  const spots = [{ id: 0, x: 0, y: 0 }, { id: 1, x: 8, y: 6 }, { id: 2, x: 11, y: 0 }];
  assert.equal(nextSpot(spots[0], spots, Arrow.Right).id, 2);
});
