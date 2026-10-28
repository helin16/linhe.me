import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMember, values } from './enum.ts';

const E = { A: 'a', B: 'b' } as const;

test('values lists members in declaration order', () => {
  assert.deepEqual(values(E), ['a', 'b']);
});

test('isMember accepts member values only', () => {
  assert.equal(isMember(E, 'a'), true);
  for (const v of ['A', 'c', undefined, null, 1, 'toString', '__proto__']) assert.equal(isMember(E, v), false, String(v));
});
