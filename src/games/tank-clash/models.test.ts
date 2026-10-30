import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { values } from '../../shared/enum.ts';
import { TANK_H } from './constants.ts';
import { TankType, Variant } from './enums.ts';
import { BUILD_GUN, cannonOf, crateModel, GOLD, parachuteModel, propModels, setAim, setGear, setWreck, shellModel, tankModel } from './models.ts';
import { PLAYABLE_MAPS } from './terrain.ts';

const size = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
const part = (t: THREE.Object3D, name: string) => t.getObjectByName(name)!;

test('builds change the cannon: A long and slim, C short and fat with a muzzle brake', () => {
  const [a, b, c] = values(Variant).map(v => cannonOf(TankType.Scout, v));
  assert.deepEqual(b, { x: 2, y: 18, len: 22, thick: 3, twin: false, brake: false });
  assert.ok(a.len > b.len && a.thick < b.thick && c.len < b.len && c.thick > b.thick);
  assert.deepEqual([a.brake, c.brake], [false, true]);
  assert.equal(cannonOf(TankType.Heavy, Variant.C).len, 24 * BUILD_GUN[Variant.C][0]);
  assert.equal(cannonOf(TankType.Heavy, Variant.B).twin, true);
});

test('a tank has its named parts; the four types differ in size; barrels follow the build', () => {
  const sizes = values(TankType).map(type => {
    const t = tankModel(type, Variant.B, '#4caf50');
    for (const name of ['hull', 'turret', 'wheels', 'cannon', 'barrels', 'edge', 'ring', 'missile']) assert.ok(t.getObjectByName(name), `${type}: ${name}`);
    assert.equal(!!t.getObjectByName('tracks'), type !== TankType.Scout, `${type}: tracks`);
    assert.equal((part(t, 'hull') as THREE.Mesh).material instanceof THREE.MeshStandardMaterial, true);
    assert.equal(((part(t, 'hull') as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString(), '4caf50', 'in the player colour');
    return size(part(t, 'hull')).x * 100 + size(part(t, 'turret')).y;
  });
  assert.equal(new Set(sizes).size, 4, 'each type has its own hull and turret');
  assert.equal(part(tankModel(TankType.Heavy, Variant.B, '#fff'), 'barrels').children.length, 2, 'twin barrels');
  assert.equal(part(tankModel(TankType.Allrounder, Variant.C, '#fff'), 'barrels').children.length, 2, 'a barrel and its brake');
  const len = (v: Variant) => size(part(tankModel(TankType.Artillery, v, '#fff'), 'barrels')).x;
  assert.ok(len(Variant.A) > len(Variant.B) && len(Variant.B) > len(Variant.C));
});

test('bonus marks: hidden at first, shown by setGear; grip gear gilds the wheels and the gold comes off again', () => {
  const t = tankModel(TankType.Scout, Variant.B, '#e53935');
  for (const name of ['edge', 'ring', 'missile']) assert.equal(part(t, name).visible, false, name);
  setGear(t, { wheels: true, edge: true, ring: true, missile: true });
  for (const name of ['edge', 'ring', 'missile']) assert.equal(part(t, name).visible, true, name);
  const wheels = part(t, 'wheels').children as THREE.Mesh[];
  assert.ok(wheels.every(w => w.material === GOLD));
  setGear(t, { wheels: false, edge: false, ring: false, missile: false });
  assert.ok(wheels.every(w => w.material !== GOLD), 'back to their own look');
  assert.equal(part(t, 'ring').position.y, TANK_H / 2);
});

test('a wreck is dark scorched steel with no bonus marks, dented, and stays a wreck', () => {
  const t = tankModel(TankType.Heavy, Variant.B, '#2196f3'), before = (part(t, 'hull') as THREE.Mesh).geometry;
  setGear(t, { wheels: true, edge: true, ring: true, missile: true });
  setWreck(t);
  const hull = part(t, 'hull') as THREE.Mesh, wreck = hull.material as THREE.MeshStandardMaterial;
  assert.ok(wreck.color.r < 0.3 && wreck.color.g < 0.3 && wreck.color.b < 0.3, 'dark');
  assert.equal((part(t, 'turret') as THREE.Mesh).material, wreck, 'the whole body');
  assert.notEqual(hull.geometry, before, 'dented: its own geometry');
  for (const name of ['edge', 'ring', 'missile']) assert.equal(part(t, name).visible, false, name);
  setGear(t, { wheels: true, edge: true, ring: true, missile: true });
  assert.equal(part(t, 'ring').visible, false, 'a wreck shows no bonuses');
});

test('setAim: facing, tilt and a cannon angle kept from flat ground', () => {
  const t = tankModel(TankType.Allrounder, Variant.B, '#fff');
  setAim(t, 45, 0, 1);
  assert.ok(t.scale.x === 1 && t.rotation.z === 0); // (=== treats −0 as 0)
  assert.ok(Math.abs(part(t, 'cannon').rotation.z - Math.PI / 4) < 1e-9);
  setAim(t, 30, 0.2, -1);
  assert.equal(t.scale.x, -1);
  assert.equal(t.rotation.z, -0.2, 'clockwise on screen');
  // the cannon's angle on screen stays 30° from flat: the body's tilt is taken back out
  assert.ok(Math.abs(part(t, 'cannon').rotation.z - (30 - 0.2 * 180 / Math.PI) * Math.PI / 180) < 1e-9);
});

test('crates, parachutes, shells and missiles', () => {
  const crate = crateModel();
  assert.ok(Math.abs(new THREE.Box3().setFromObject(crate).min.y) < 2, 'standing on its bottom');
  assert.ok(new THREE.Box3().setFromObject(parachuteModel()).min.y > 0, 'above the crate');
  assert.equal(shellModel(false).name, 'shell');
  assert.equal(shellModel(true).name, 'missile');
  assert.ok(size(shellModel(true)).x > size(shellModel(false)).x, 'a missile is longer');
});

test('each map has its props on the hills behind the field', () => {
  const names = Object.fromEntries(PLAYABLE_MAPS.map(m => [m, propModels(m).map(p => p.model.name).sort()]));
  assert.deepEqual(names, {
    'Green Hills': ['fence', 'ruin', 'sandbags', 'sandbags'], 'Timber Gap': ['fence', 'logs', 'logs', 'sandbags'],
    'Lake Valley': ['fence', 'ruin', 'sandbags', 'sandbags'], 'Frost Ridge': ['fence', 'ruin', 'sandbags', 'sandbags'],
  });
  for (const m of PLAYABLE_MAPS) for (const p of propModels(m)) assert.ok(p.x > 0 && p.x < 1600);
});
