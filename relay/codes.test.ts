import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCode } from './codes.ts';
import { CODE_ALPHABET, CODE_LENGTH } from './protocol.ts';

test('codes use the alphabet and length', () => {
  for (let i = 0; i < 200; i++) {
    const c = newCode(() => false);
    assert.equal(c.length, CODE_LENGTH);
    for (const ch of c) assert.ok(CODE_ALPHABET.includes(ch), c);
  }
});

test('retries while a code is taken', () => {
  let n = 0;
  const seq = [0, 0, 0, 0, 1, 1, 1, 1];
  const code = newCode(c => c === CODE_ALPHABET[0].repeat(4), () => seq[n++]);
  assert.equal(code, CODE_ALPHABET[1].repeat(4));
});

test('gives up after 100 tries', () => {
  assert.throws(() => newCode(() => true, () => 0), /no free room code/);
});
