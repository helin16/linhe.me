// Turbo Tumble's 3D look (specs/010-turbo-3d-look): the karts' rounded, toy-like models with a driver who steers, and
// each track's look (what its road, ground, light, scenery and effects are made of). Builds three.js objects but needs
// no browser, so it is unit tested; drawing them (textures, lights, effects) is view.ts.
import * as THREE from 'three';
import { Effect, GroundKind, LayerKind, LightKind, PuffKind, RoadKind } from './enums.ts';
import { KartStyle, Track } from './settings.ts';

// each style's body (width, height, length) and wheel radius: the overall size the race was tuned with
export const SHAPES: Record<KartStyle, { body: [number, number, number]; wheel: number; tyre: number }> = {
  [KartStyle.Classic]: { body: [2.2, 0.7, 3.4], wheel: 0.5, tyre: 0.5 },
  [KartStyle.Buggy]: { body: [2.6, 0.9, 3.0], wheel: 0.65, tyre: 0.75 }, // chunky tyres
  [KartStyle.Rocket]: { body: [1.8, 0.6, 4.0], wheel: 0.45, tyre: 0.45 },
};
export const STEER_TURN = 1.1;  // the steering wheel's turn at full lock (radians)
export const HEAD_LEAN = 0.3;   // the driver's head lean at full lock (radians)
const STEER_EASE = 10;          // how fast the shown steering follows the real one (per second)
const FULL_TURN_RATE = 1.9;     // heading change (radians/s) that counts as full lock (the race's base turn rate)
const BEVEL = 0.2;              // rounded edges on bodies and wings

export type KartColors = { color: number; helmet: number; skin: number };
export type KartModel = {
  root: THREE.Group;                 // everything below, ready to add to the kart's body group
  body: THREE.Mesh;                  // the body in the kart colour, with the driver's torso and arms and any wing or fin
  marks: string[];                   // what marks the style (bumper, spoiler, roll bar, nose, fin, exhausts)
  wheels: THREE.Group[];             // the two axles, rear then front, each turning its pair of wheels
  driver: { torso: THREE.Mesh; head: THREE.Group };
  steering: THREE.Group;
  spark: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  radius: number;                    // wheel radius
  steer: number;                     // the steering shown, −1 (right) … 1 (left)
  turns: number;                     // how far the wheels have turned, in whole turns
};

/** Joins a group's meshes that share a material into one mesh each (fewer draw calls: a kart was 22 of them). The
 *  joined geometry belongs to this kart; disposeModel frees it. */
function fuse(group: THREE.Object3D, keep: THREE.Object3D[] = []) {
  const byMat = new Map<THREE.Material, THREE.Mesh[]>();
  for (const o of group.children) if (o instanceof THREE.Mesh && !keep.includes(o)) byMat.set(o.material, [...(byMat.get(o.material) ?? []), o]);
  const fused = new Map<THREE.Material, THREE.Mesh>();
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) { fused.set(mat, meshes[0]); continue; }
    const pos: number[] = [], nor: number[] = [];
    for (const m of meshes) {
      m.updateMatrix();
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
      pos.push(...Array.from(g.getAttribute('position').array)); nor.push(...Array.from(g.getAttribute('normal').array));
      g.dispose(); group.remove(m);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.userData.own = true;
    const one = new THREE.Mesh(g, mat); one.name = meshes[0].name; group.add(one); fused.set(mat, one);
  }
  return fused;
}

// geometries are shared by every kart of a style (karts are rebuilt on every garage change)
const cache = new Map<string, THREE.BufferGeometry>();
const geo = (key: string, make: () => THREE.BufferGeometry) => cache.get(key) ?? (cache.set(key, make()), cache.get(key)!);

/** A box with rounded edges and corners, centred on the origin. */
export function roundedBox(w: number, h: number, l: number, r = BEVEL) {
  const s = new THREE.Shape(), x = w / 2 - r, z = l / 2 - r, c = Math.min(x, z, r);
  s.moveTo(-x + c, -z); s.lineTo(x - c, -z); s.quadraticCurveTo(x, -z, x, -z + c); s.lineTo(x, z - c);
  s.quadraticCurveTo(x, z, x - c, z); s.lineTo(-x + c, z); s.quadraticCurveTo(-x, z, -x, z - c); s.lineTo(-x, -z + c);
  s.quadraticCurveTo(-x, -z, -x + c, -z);
  const depth = Math.max(h - 2 * r, 0.01);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 6 });
  return g.rotateX(-Math.PI / 2).translate(0, -depth / 2, 0);
}

const dark = new THREE.MeshLambertMaterial({ color: 0x26262b });
const hub = new THREE.MeshLambertMaterial({ color: 0xd8dde6 });
const glow = new THREE.MeshLambertMaterial({ color: 0x331100, emissive: 0xff7722, emissiveIntensity: 0.8 });
// Lambert (lit per vertex) throughout: each kind of material is a shader program, and software renderers and phones
// compile them slowly when a race first opens (SC-005)
const paint = (color: number) => Object.assign(new THREE.MeshLambertMaterial({ color }), { userData: { own: true } });

/** The kart model for a style, in the player's colours. Its size matches the race's (collisions are unchanged). */
export function kartModel(style: KartStyle, c: KartColors): KartModel {
  const { body: [bw, bh, bl], wheel: r, tyre } = SHAPES[style], y = r + 0.2;
  const root = new THREE.Group(), marks: string[] = [];
  const body = paint(c.color), helmet = paint(c.helmet), skin = paint(c.skin);
  const add = <M extends THREE.Material>(g: THREE.BufferGeometry, m: M, x: number, yy: number, z: number, parent: THREE.Object3D = root, name = '') => {
    const o = new THREE.Mesh(g, m); o.position.set(x, yy, z); o.name = name; parent.add(o); return o;
  };
  const mark = <M extends THREE.Material>(name: string, g: THREE.BufferGeometry, m: M, x: number, yy: number, z: number) => {
    if (!marks.includes(name)) marks.push(name);
    return add(g, m, x, yy, z, root, name);
  };

  add(geo(`${style}:body`, () => roundedBox(bw, bh, bl)), body, 0, y, 0, root, 'body');
  if (style === KartStyle.Classic) {
    mark('bumper', geo('bumper', () => new THREE.CylinderGeometry(0.22, 0.22, bw + 0.2, 12).rotateZ(Math.PI / 2)), dark, 0, y - 0.1, bl / 2 + 0.1);
    mark('spoiler', geo('spoiler', () => roundedBox(bw + 0.2, 0.18, 0.6, 0.08)), body, 0, y + 0.8, -bl / 2 + 0.2);
    for (const sx of [-0.6, 0.6]) mark('spoiler', geo('strut', () => new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8)), dark, sx, y + 0.5, -bl / 2 + 0.2);
  }
  if (style === KartStyle.Buggy) {
    mark('rollbar', geo('rollbar', () => new THREE.TorusGeometry(0.85, 0.09, 8, 20, Math.PI)), dark, 0, y + 0.45, -0.95);
  }
  if (style === KartStyle.Rocket) {
    mark('nose', geo('nose', () => new THREE.SphereGeometry(bh / 2 + 0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 3, 1).rotateX(Math.PI / 2)), body, 0, y, bl / 2 - 0.2);
    const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(-0.9, 0); fin.quadraticCurveTo(-1.0, 1.0, -0.6, 1.2); fin.lineTo(0, 0);
    mark('fin', geo('fin', () => new THREE.ExtrudeGeometry(fin, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }).rotateY(-Math.PI / 2).translate(0.04, 0, 0)), body, 0, y + bh / 2 - 0.05, -bl / 2 + 0.9);
    for (const sx of [-0.4, 0.4]) {
      mark('exhaust', geo('exhaust', () => new THREE.CylinderGeometry(0.17, 0.2, 0.5, 12).rotateX(Math.PI / 2)), hub, sx, y, -bl / 2 - 0.15);
      mark('exhaust', geo('flame', () => new THREE.CircleGeometry(0.12, 12).rotateY(Math.PI)), glow, sx, y, -bl / 2 - 0.41);
    }
  }

  // wheels: rounded tyres around hubs, a pair on each axle turning together about it (x)
  const wheels: THREE.Group[] = [];
  for (const sz of [-1, 1]) {
    const axle = new THREE.Group(); axle.name = 'axle'; axle.position.set(0, r, sz * (bl / 2 - 0.6)); root.add(axle);
    for (const sx of [-1, 1]) {
      add(geo(`tyre:${r}:${tyre}`, () => new THREE.TorusGeometry(r - tyre * 0.25, tyre * 0.32, 10, 20).rotateY(Math.PI / 2).scale(tyre * 1.4, 1, 1)), dark, sx * (bw / 2 + 0.1), 0, 0, axle, 'tyre');
      add(geo(`hub:${r}`, () => new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.3, 12).rotateZ(Math.PI / 2)), hub, sx * (bw / 2 + 0.1), 0, 0, axle, 'hub');
    }
    fuse(axle);
    wheels.push(axle);
  }

  // the driver: torso in the kart colour, a helmeted head that leans, arms on a small steering wheel
  add(geo('torso', () => new THREE.SphereGeometry(0.5, 14, 10).scale(1, 1.1, 0.8)), body, 0, y + bh / 2 + 0.2, -0.35, root, 'torso');
  const head = new THREE.Group(); head.name = 'head'; head.position.set(0, y + bh / 2 + 1, -0.3); root.add(head);
  add(geo('head', () => new THREE.SphereGeometry(0.42, 14, 10)), skin, 0, -0.05, 0.08, head, 'face');
  add(geo('neck', () => new THREE.CylinderGeometry(0.19, 0.21, 0.35, 10)), skin, 0, -0.3, -0.02, head, 'neck'); // chin and neck show below the helmet
  add(geo('helmet', () => new THREE.SphereGeometry(0.56, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)), helmet, 0, 0, 0, head, 'helmet');
  add(geo('visor', () => roundedBox(0.7, 0.18, 0.12, 0.05)), dark, 0, 0.02, 0.48, head, 'visor');
  const steering = new THREE.Group(); steering.name = 'steering'; steering.position.set(0, y + bh / 2 + 0.45, 0.45); steering.rotation.x = -0.9; root.add(steering);
  const wheelOf = new THREE.Group(); steering.add(wheelOf);
  add(geo('steer', () => new THREE.TorusGeometry(0.28, 0.06, 8, 18)), dark, 0, 0, 0, wheelOf, 'steer');
  add(geo('spoke', () => new THREE.BoxGeometry(0.5, 0.06, 0.04)), dark, 0, 0, 0, wheelOf);
  for (const sx of [-1, 1]) { // arms from the shoulder forward to the steering wheel's rim
    const a = add(geo('arm', () => new THREE.CylinderGeometry(0.1, 0.09, 0.75, 8).translate(0, 0.375, 0)), body, sx * 0.4, y + bh / 2 + 0.55, -0.3, root, 'arm');
    a.rotation.set(1.62, 0, sx * 0.2);
  }
  const spark = add(geo('spark', () => new THREE.SphereGeometry(0.45, 8, 6)), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.4, -bl / 2 - 0.3);
  spark.material.userData.own = true; spark.visible = false;
  fuse(wheelOf);
  const shell = fuse(root, [spark]).get(body)!; // the body, wings, fins, torso and arms: one mesh
  shell.name = 'body';
  return { root, body: shell, marks, wheels, driver: { torso: shell, head }, steering: wheelOf, spark, radius: r, steer: 0, turns: 0 };
}

/** Shows steering `target` (−1 right … 1 left), eased over `dt` seconds (no dt: at once): the steering wheel turns that
 *  way and the driver's head leans into the corner. Returns the steering shown. */
export function setSteer(m: KartModel, target: number, dt = Infinity) {
  const t = Math.max(-1, Math.min(1, target));
  m.steer += (t - m.steer) * Math.min(1, STEER_EASE * dt);
  m.steering.rotation.z = -m.steer * STEER_TURN; // anticlockwise as the driver sees it, for left
  m.driver.head.rotation.z = -m.steer * HEAD_LEAN;
  return m.steer;
}

/** Turns the wheels for `distance` travelled (backwards: negative). */
export function spinWheels(m: KartModel, distance: number) {
  const a = distance / m.radius;
  for (const w of m.wheels) w.rotation.x = (w.rotation.x + a) % (Math.PI * 2);
  m.turns += a / (Math.PI * 2);
}

/** How hard a kart driven on another screen is steering (−1 … 1), from its heading change over `dt` seconds (online
 *  messages carry no steering: FR-001a). */
export function steerFrom(prev: number, heading: number, dt: number) {
  if (!(dt > 0)) return 0;
  const d = Math.atan2(Math.sin(heading - prev), Math.cos(heading - prev));
  return Math.max(-1, Math.min(1, d / dt / FULL_TURN_RATE));
}

/** Frees what this kart owns (its colours and joined shapes); shared shapes stay for the next kart. */
export function disposeModel(m: KartModel) {
  m.root.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    if (o.material.userData.own) o.material.dispose();
    if (o.geometry.userData.own) o.geometry.dispose();
  });
}

// --- each track's look ---
export type Layer = { kind: LayerKind; dist: number; height: number; color: number };
export type TrackLook = {
  road: RoadKind; ground: GroundKind; light: LightKind;
  skyTop: number;          // the sky's top colour (it fades to the track's horizon colour)
  stars: boolean;          // a night sky with stars (else clouds)
  layers: Layer[];         // scenery rings, nearest first, distances past the track's edge
  effect: Effect; puff: PuffKind;
  props: [number, number]; // start-line props' two colours (arch and grandstand trim)
};
export const TRACK_LOOKS: Record<Track, TrackLook> = {
  [Track.Meadow]: {
    road: RoadKind.Tarmac, ground: GroundKind.Grass, light: LightKind.Sun, skyTop: 0x3d8fe0, stars: false,
    layers: [{ kind: LayerKind.Hills, dist: 120, height: 30, color: 0x5aa864 }, { kind: LayerKind.Hills, dist: 300, height: 60, color: 0x6fae9a },
      { kind: LayerKind.Mountains, dist: 520, height: 130, color: 0x8aa6c4 }],
    effect: Effect.Birds, puff: PuffKind.Dust, props: [0xffcc00, 0x2266dd],
  },
  [Track.Desert]: {
    road: RoadKind.Sand, ground: GroundKind.Sand, light: LightKind.Sun, skyTop: 0xe8925a, stars: false,
    layers: [{ kind: LayerKind.Dunes, dist: 120, height: 22, color: 0xd9a663 }, { kind: LayerKind.Dunes, dist: 300, height: 45, color: 0xc98d5a },
      { kind: LayerKind.Mountains, dist: 520, height: 110, color: 0xb07a63 }],
    effect: Effect.Dust, puff: PuffKind.Sand, props: [0xcc5500, 0xf4a460],
  },
  [Track.Snow]: {
    road: RoadKind.Tarmac, ground: GroundKind.Snow, light: LightKind.Sun, skyTop: 0x7aa9d8, stars: false,
    layers: [{ kind: LayerKind.Hills, dist: 120, height: 28, color: 0xe6eef6 }, { kind: LayerKind.Mountains, dist: 300, height: 90, color: 0xb8c9dc },
      { kind: LayerKind.Mountains, dist: 520, height: 160, color: 0x9fb4cc }],
    effect: Effect.Snow, puff: PuffKind.Snow, props: [0x3366cc, 0xcc2222],
  },
  [Track.Neon]: {
    road: RoadKind.Neon, ground: GroundKind.Grid, light: LightKind.Night, skyTop: 0x02020c, stars: true,
    layers: [{ kind: LayerKind.Towers, dist: 120, height: 50, color: 0x1a1a3a }, { kind: LayerKind.Towers, dist: 300, height: 90, color: 0x161634 }],
    effect: Effect.Pulse, puff: PuffKind.Glint, props: [0xff00cc, 0x00ffff],
  },
};
