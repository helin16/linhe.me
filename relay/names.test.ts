import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADJECTIVES, ANIMALS, newName } from './names.ts';

test('names are "Adjective Animal" from the fixed lists', () => {
  assert.ok(ADJECTIVES.length >= 40 && ANIMALS.length >= 40);
  assert.equal(new Set(ADJECTIVES).size, ADJECTIVES.length);
  assert.equal(new Set(ANIMALS).size, ANIMALS.length);
  for (const w of [...ADJECTIVES, ...ANIMALS]) assert.match(w, /^[A-Z][a-z]+$/);
  assert.match(newName(() => false), /^[A-Z][a-z]+ [A-Z][a-z]+$/);
});

test('a taken name is skipped; it gives up after 100 tries', () => {
  const picks = [0, 0, 1, 2]; // first "Turbo Otter" (taken), then "Rocket Fox"
  assert.equal(newName(n => n === 'Turbo Otter', () => picks.shift()!), 'Rocket Fox');
  assert.throws(() => newName(() => true, () => 0), /no free room name/);
});
