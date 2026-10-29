import { test } from 'node:test';
import assert from 'node:assert/strict';
import { values } from '../../shared/enum.ts';
import { Grip, TankType } from './enums.ts';
import { clampAngle, DEFAULT_TYPE, TANKS, tenths } from './tanks.ts';

test('the table matches the spec (FR-007)', () => {
  assert.deepEqual(TANKS[TankType.Heavy], { minAngle: 30, maxAngle: 65, damage: 15, hearts: 50, grip: Grip.Low });
  assert.equal(TANKS[TankType.Scout].maxAngle - TANKS[TankType.Scout].minAngle, 85); // the widest
  assert.equal(DEFAULT_TYPE, TankType.Allrounder);
});

test('no angle reaches straight up or backwards; hearts 3 to 5', () => {
  for (const t of values(TankType)) {
    const s = TANKS[t];
    assert.ok(s.minAngle >= 0 && s.maxAngle < 90 && s.minAngle < s.maxAngle, t);
    assert.ok(s.hearts >= 30 && s.hearts <= 50, t);
  }
});

test('good grip only on lightly armed tanks: no tank above 1.0 damage grips better than Low', () => {
  for (const t of values(TankType)) if (TANKS[t].damage > 10) assert.equal(TANKS[t].grip, Grip.Low, t);
});

test('tenths read as hearts; angles are held inside the limits', () => {
  assert.equal(tenths(25), '2.5');
  assert.equal(tenths(-3), '0.0');
  assert.equal(clampAngle(TankType.Heavy, 10), 30);
  assert.equal(clampAngle(TankType.Heavy, 80), 65);
  assert.equal(clampAngle(TankType.Heavy, 40), 40);
});
