import { test } from 'node:test';
import assert from 'node:assert/strict';
import { values } from '../../shared/enum.ts';
import { CritterType } from './enums.ts';
import { LOOKS } from './types.ts';

test('every type has its own colour, accent, ears and move effect', () => {
  const all = values(CritterType);
  for (const k of ['color', 'accent', 'ears', 'effect'] as const) assert.equal(new Set(all.map(t => LOOKS[t][k])).size, all.length, k);
  for (const t of all) assert.match(LOOKS[t].color, /^#[0-9a-f]{6}$/);
});
