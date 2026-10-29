import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TankType, Variant } from './enums.ts';
import { BUILD_GUN, gunOf } from './pixel.ts';

test('builds change the cannon: A long and slim, C short and fat with a muzzle brake', () => {
  assert.deepEqual(gunOf(TankType.Scout, Variant.B), { x: 36, y: 12.5, barrels: [[0, 15, 2.2]], brake: undefined });
  const [a, c] = [Variant.A, Variant.C].map(v => gunOf(TankType.Scout, v).barrels[0]);
  assert.ok(a[1] > 15 && a[2] < 2.2 && c[1] < 15 && c[2] > 2.2);
  assert.ok(gunOf(TankType.Scout, Variant.C).brake, 'C always has a brake');
  assert.equal(gunOf(TankType.Scout, Variant.A).brake, undefined);
  const [len, th] = BUILD_GUN[Variant.C];
  assert.deepEqual(gunOf(TankType.Allrounder, Variant.C).brake, [4, 6 * th], 'an existing brake fattens with the barrel');
  const twin = gunOf(TankType.Heavy, Variant.C).barrels;
  assert.ok(twin[1][0] - twin[0][0] > twin[0][2], 'fat twin barrels stay apart');
  assert.equal(twin[0][1], 16 * len);
});
