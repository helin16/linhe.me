import { test } from 'node:test';
import assert from 'node:assert/strict';
import { values } from '../../shared/enum.ts';
import { Grip, TankType, Variant } from './enums.ts';
import { clampAngle, clampPower, DEFAULT_TYPE, DEFAULT_VARIANT, MAX_POWER, specOf, TANKS, tenths, variantOf } from './tanks.ts';

test('the table matches the spec (FR-007)', () => {
  assert.deepEqual(TANKS[TankType.Heavy], { minAngle: 30, maxAngle: 65, damage: 15, hearts: 50, grip: Grip.Low, speed: 60 });
  assert.ok(TANKS[TankType.Scout].speed > TANKS[TankType.Allrounder].speed && TANKS[TankType.Allrounder].speed > TANKS[TankType.Heavy].speed, 'lighter drives faster');
  assert.ok(TANKS[TankType.Artillery].speed > TANKS[TankType.Scout].speed, 'as light, but low grip: faster');
  assert.deepEqual([DEFAULT_TYPE, DEFAULT_VARIANT], [TankType.Allrounder, Variant.B]);
});

test('builds: A tilts further but hits softer, C tilts less but hits harder; hearts, grip and speed stay', () => {
  const topB: Record<TankType, number> = { [TankType.Scout]: 98, [TankType.Allrounder]: 95, [TankType.Heavy]: 89, [TankType.Artillery]: 86 };
  for (const type of values(TankType)) {
    const [a, b, c] = values(Variant).map(variant => specOf({ type, variant }));
    assert.deepEqual(b, { ...TANKS[type], topPower: topB[type] }, `${type} B is the type`);
    assert.ok(a.maxAngle - a.minAngle > b.maxAngle - b.minAngle && b.maxAngle - b.minAngle > c.maxAngle - c.minAngle, `${type} angles`);
    assert.ok(a.damage < b.damage && b.damage < c.damage, `${type} damage`);
    for (const s of [a, c]) assert.deepEqual([s.hearts, s.grip, s.speed], [b.hearts, b.grip, b.speed]);
  }
  assert.deepEqual(specOf({ type: TankType.Heavy, variant: Variant.C }), { ...TANKS[TankType.Heavy], minAngle: 38, maxAngle: 57, damage: 19, topPower: 84 });
  assert.deepEqual(specOf({ type: TankType.Scout, variant: Variant.A }), { ...TANKS[TankType.Scout], minAngle: 0, maxAngle: 85, damage: 6, topPower: 100 });
  assert.deepEqual(specOf({ type: TankType.Heavy }), { ...TANKS[TankType.Heavy], topPower: 89 }, 'no build given: B');
});

test('harder hits reach less far: top power 100 − 12 × (damage − 0.6), never above 100 (FR-007)', () => {
  const tops = values(TankType).map(type => values(Variant).map(variant => specOf({ type, variant }).topPower));
  assert.deepEqual(tops, [[100, 98, 95], [98, 95, 92], [93, 89, 84], [90, 86, 80]]);
  const heavy = { type: TankType.Heavy };
  assert.deepEqual([clampPower(heavy, 95), clampPower(heavy, -3), clampPower(heavy, 50)], [89, 0, 50]);
  assert.equal(MAX_POWER, 100);
});

test('no angle reaches straight up or backwards; hearts 3 to 5', () => {
  for (const type of values(TankType)) for (const variant of values(Variant)) {
    const s = specOf({ type, variant });
    assert.ok(s.minAngle >= 0 && s.maxAngle < 90 && s.minAngle < s.maxAngle, `${type} ${variant}`);
    assert.ok(s.hearts >= 30 && s.hearts <= 50, type);
  }
});

test('good grip only on lightly armed types: no B above 1.0 damage grips better than Low', () => {
  for (const t of values(TankType)) if (TANKS[t].damage > 10) assert.equal(TANKS[t].grip, Grip.Low, t);
});

test('tenths read as hearts; angles are held inside a build’s limits', () => {
  assert.equal(tenths(25), '2.5');
  assert.equal(tenths(-3), '0.0');
  const heavy = { type: TankType.Heavy };
  assert.equal(clampAngle(heavy, 10), 30);
  assert.equal(clampAngle(heavy, 80), 65);
  assert.equal(clampAngle(heavy, 40), 40);
  assert.equal(clampAngle({ type: TankType.Heavy, variant: Variant.C }, 60), 57);
});

test('a look without a build is a B', () => {
  assert.equal(variantOf({}), Variant.B);
  assert.equal(variantOf({ variant: Variant.C }), Variant.C);
});
