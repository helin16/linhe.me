import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seeded } from '../seed.ts';
import { freeType, nextRunner, roomSeats, takeType } from './seats.ts';

const ALL = ['Fire', 'Water', 'Grass', 'Rock', 'Electric', 'Psychic'];

test('runner hand-over: the same while in the room, else the lowest slot', () => {
  assert.equal(nextRunner(2, [0, 2, 5]), 2);
  assert.equal(nextRunner(2, [3, 5]), 3);
  assert.equal(nextRunner(2, []), -1);
});

test('type picks: first come wins; a slot may change its own', () => {
  const types = new Map<number, string>();
  assert.ok(takeType(types, 0, 'Water'));
  assert.ok(!takeType(types, 1, 'Water'), 'taken');
  assert.ok(takeType(types, 0, 'Fire'));
  assert.ok(takeType(types, 1, 'Water'));
  for (let i = 0; i < 20; i++) assert.ok(!['Fire', 'Water'].includes(freeType(ALL, ['Fire', 'Water'], seeded(i))));
});

test('room seats: players by slot with their picks, free types for the rest, computers fill up', () => {
  const rows = roomSeats(ALL, [4, 0], new Map([[0, 'Water'], [4, 'Grass']]), 4, seeded(2));
  assert.deepEqual(rows.slice(0, 2), [[0, 0, 'Water'], [1, 4, 'Grass']]);
  assert.deepEqual(rows.slice(2).map(r => r[1]), [-1, -1]);
  assert.equal(new Set(rows.map(r => r[2])).size, 4);
  const clash = roomSeats(ALL, [0, 1, 2], new Map([[0, 'Fire'], [1, 'Fire']]), 6, seeded(3));
  assert.equal(clash[0][2], 'Fire');
  assert.notEqual(clash[1][2], 'Fire');
  assert.equal(new Set(clash.map(r => r[2])).size, 6);
});

test('a room needs a type per seat: asking for more says so', () => {
  assert.throws(() => roomSeats(ALL.slice(0, 2), [0], new Map(), 4, seeded(1)), /needs 4 types/);
});
