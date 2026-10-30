import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Effect, GroundKind, LightKind, PuffKind, RoadKind } from './enums.ts';
import { disposeModel, HEAD_LEAN, kartModel, roundedBox, setSteer, SHAPES, spinWheels, STEER_TURN, steerFrom, TRACK_LOOKS } from './look.ts';
import { KartStyle, Track } from './settings.ts';
import { values } from '../../shared/enum.ts';

const colors = { color: 0xff4444, helmet: 0x2255ff, skin: 0x8d5524 };
const colorOf = (o: THREE.Object3D) => ((o as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHex();
const named = (o: THREE.Object3D, name: string) => { const r: THREE.Object3D[] = []; o.traverse(x => { if (x.name === name) r.push(x); }); return r; };

test('every style has a body, four wheels on two axles, a driver, a steering wheel and a hidden spark, in the player\'s colours', () => {
  for (const style of values(KartStyle)) {
    const m = kartModel(style, colors);
    assert.equal(m.wheels.length, 2);
    for (const axle of m.wheels) assert.equal(axle.children.length, 2); // two tyres in one mesh, two hubs in another
    assert.equal(colorOf(m.body), colors.color);
    assert.equal(colorOf(m.driver.torso), colors.color);
    assert.equal(colorOf(named(m.driver.head, 'face')[0]), colors.skin);
    assert.equal(colorOf(named(m.driver.head, 'neck')[0]), colors.skin);
    assert.equal(colorOf(named(m.driver.head, 'helmet')[0]), colors.helmet);
    assert.equal(named(m.steering, 'steer').length, 1);
    assert.equal(m.spark.visible, false);
    assert.equal(m.radius, SHAPES[style].wheel);
    assert.ok(m.root.getObjectByName('body'));
  }
});

test('each style has its own marks', () => {
  const marks = (style: KartStyle) => [...kartModel(style, colors).marks].sort();
  assert.deepEqual(marks(KartStyle.Classic), ['bumper', 'spoiler']);
  assert.deepEqual(marks(KartStyle.Buggy), ['rollbar']);
  assert.deepEqual(marks(KartStyle.Rocket), ['exhaust', 'fin', 'nose']);
  assert.ok(SHAPES[KartStyle.Buggy].tyre > SHAPES[KartStyle.Classic].tyre); // chunky tyres
});

test('karts stay about the size the race was tuned with', () => {
  for (const style of values(KartStyle)) {
    const [bw, , bl] = SHAPES[style].body, size = new THREE.Box3().setFromObject(kartModel(style, colors).root).getSize(new THREE.Vector3());
    assert.ok(size.x <= bw + 1.4, `${style} width ${size.x}`);
    assert.ok(size.z <= bl + 2, `${style} length ${size.z}`);
    assert.ok(size.y <= 3, `${style} height ${size.y}`);
  }
});

test('a kart is a dozen meshes or so: parts that share a colour are joined', () => {
  for (const style of values(KartStyle)) {
    let n = 0; kartModel(style, colors).root.traverse(o => { if (o instanceof THREE.Mesh) n++; });
    assert.ok(n <= 14, `${style}: ${n} meshes`);
  }
});

test('a rounded box has the size asked for', () => {
  const s = new THREE.Box3().setFromBufferAttribute(roundedBox(2, 1, 3).getAttribute('position') as THREE.BufferAttribute).getSize(new THREE.Vector3());
  assert.ok(Math.abs(s.x - 2) < 1e-6 && Math.abs(s.y - 1) < 1e-6 && Math.abs(s.z - 3) < 1e-6, `${s.x},${s.y},${s.z}`);
});

test('steering turns the wheel and leans the head, clamped and eased', () => {
  const m = kartModel(KartStyle.Classic, colors);
  assert.equal(setSteer(m, 1), 1);
  assert.equal(m.steering.rotation.z, -STEER_TURN);
  assert.equal(m.driver.head.rotation.z, -HEAD_LEAN);
  assert.equal(setSteer(m, -5), -1); // clamped
  assert.equal(m.driver.head.rotation.z, HEAD_LEAN);
  const half = setSteer(m, 1, 0.05); // eased: part of the way there
  assert.ok(half > -1 && half < 1);
  assert.equal(setSteer(m, 1, 10), 1);
});

test('wheels turn with the distance travelled, backwards too', () => {
  const m = kartModel(KartStyle.Buggy, colors);
  spinWheels(m, 2 * Math.PI * m.radius); // one turn
  assert.ok(Math.abs(m.turns - 1) < 1e-9);
  spinWheels(m, 0.5);
  for (const w of m.wheels) assert.ok(Math.abs(w.rotation.x - 0.5 / m.radius) < 1e-9);
  spinWheels(m, -0.5);
  assert.ok(Math.abs(m.turns - 1) < 1e-9);
});

test('steering read from a heading change: straight is 0, the sign follows the turn, across ±π too', () => {
  assert.equal(steerFrom(1, 1, 0.05), 0);
  assert.ok(steerFrom(0, 0.05, 0.05) > 0); // turning left (heading up)
  assert.ok(steerFrom(0, -0.05, 0.05) < 0);
  assert.equal(steerFrom(0, 1, 0.05), 1); // clamped
  assert.ok(steerFrom(Math.PI - 0.01, -Math.PI + 0.01, 0.05) > 0); // a small left turn across the wrap
  assert.equal(steerFrom(0, 1, 0), 0); // no time passed
});

test('disposing a model frees its own colours, not the shared parts', () => {
  const m = kartModel(KartStyle.Rocket, colors), freed: string[] = [];
  m.root.traverse(o => { if (o instanceof THREE.Mesh) o.material.addEventListener('dispose', () => freed.push(o.name)); });
  disposeModel(m);
  assert.ok(freed.includes('body') && freed.includes('face') && freed.includes('helmet'));
  const shapes: string[] = []; // the joined shapes are this kart's own; shared ones stay
  const n = kartModel(KartStyle.Classic, colors);
  n.root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.addEventListener('dispose', () => shapes.push(o.name)); });
  disposeModel(n);
  assert.ok(shapes.includes('body') && shapes.includes('tyre') && !shapes.includes('face'));
  assert.ok(!freed.includes('visor')); // shared dark material
});

test('every track has a look, with its kinds from the fixed sets and scenery farther each ring', () => {
  for (const track of values(Track)) {
    const l = TRACK_LOOKS[track];
    assert.ok(values(RoadKind).includes(l.road) && values(GroundKind).includes(l.ground) && values(LightKind).includes(l.light));
    assert.ok(values(Effect).includes(l.effect) && values(PuffKind).includes(l.puff));
    assert.ok(l.layers.length >= 2 && l.layers.length <= 3);
    l.layers.forEach((layer, i) => i && assert.ok(layer.dist > l.layers[i - 1].dist));
  }
  assert.equal(TRACK_LOOKS[Track.Neon].light, LightKind.Night);
  assert.equal(TRACK_LOOKS[Track.Neon].stars, true);
  for (const t of [Track.Meadow, Track.Desert, Track.Snow]) assert.equal(TRACK_LOOKS[t].light, LightKind.Sun);
});
