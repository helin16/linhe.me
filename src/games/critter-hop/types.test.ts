import { test } from 'node:test';
import assert from 'node:assert/strict';
import { values } from '../../shared/enum.ts';
import { CritterType } from './enums.ts';
import { BEATS, beatenBy, LOOKS, strong, weak } from './types.ts';

const ALL = values(CritterType);

test('the advantage ring is one cycle through all six types', () => {
  const seen = new Set<CritterType>();
  let t: CritterType = CritterType.Water;
  for (let i = 0; i < ALL.length; i++) { seen.add(t); t = BEATS[t]; }
  assert.equal(t, CritterType.Water);
  assert.equal(seen.size, ALL.length);
  assert.equal(BEATS[CritterType.Water], CritterType.Fire);
  assert.equal(BEATS[CritterType.Psychic], CritterType.Water);
});

test('each type is strong against exactly one and weak against exactly one, never itself', () => {
  for (const a of ALL) {
    assert.equal(ALL.filter(b => strong(a, b)).length, 1, a);
    assert.equal(ALL.filter(b => weak(a, b)).length, 1, a);
    assert.equal(strong(a, a) || weak(a, a), false);
    assert.ok(strong(beatenBy(a), a));
  }
  assert.ok(strong(CritterType.Water, CritterType.Fire) && weak(CritterType.Fire, CritterType.Water));
  assert.ok(weak(CritterType.Water, CritterType.Psychic));
  assert.ok(!strong(CritterType.Water, CritterType.Grass) && !weak(CritterType.Water, CritterType.Grass), 'not neighbours: neutral');
});

test('every type has its own creature, colour and hop effect', () => {
  for (const k of ['creature', 'color', 'effect', 'ears'] as const) assert.equal(new Set(ALL.map(t => LOOKS[t][k])).size, ALL.length, k);
  for (const t of ALL) assert.match(LOOKS[t].color, /^#[0-9a-f]{6}$/);
});
