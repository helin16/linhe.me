// Tank Clash's 3D models (specs/009-tank-semi-3d research R5): tanks, wrecks, crates, shells and the props behind the
// field, built from three.js shapes by the game (original art, no image files), toy-like (FR-015): rounded, bright,
// fairly rough. A tank's origin is the middle of its tracks' bottom, facing +x; its outlines are the 2D look's, in field
// units with y up. Only geometry and materials: no DOM, so this runs in the unit tests too.
import * as THREE from 'three';
import { CRATE_SIZE, TANK_H, TANK_W } from './constants.ts';
import { MapId, TankType, Variant } from './enums.ts';
import type { PlayableMap } from './terrain.ts';

const W = TANK_W / 2;
type Pt = [number, number];
/** How each build changes the cannon (length, thickness): A's is long and slim, C's short and fat (with a brake). */
export const BUILD_GUN: Record<Variant, [number, number]> = { [Variant.A]: [1.15, 0.75], [Variant.B]: [1, 1], [Variant.C]: [0.9, 1.35] };

type Body = { hull: Pt[]; turret: Pt[] | { cx: number; cy: number; r: number }; tracked: boolean; cannon: { x: number; y: number; len: number; thick: number; twin?: boolean } };
// each type's side outline (y up from the tracks' bottom), its turret, and where its cannon pivots
const BODIES: Record<TankType, Body> = {
  [TankType.Scout]: { hull: [[-20, 8], [-16, 18], [18, 18], [22, 8]], turret: [[-8, 18], [-5, 24], [8, 24], [10, 18]], tracked: false,
    cannon: { x: 2, y: 18, len: 22, thick: 3 } },
  [TankType.Allrounder]: { hull: [[-23, 11], [-19, 19], [19, 19], [23, 11]], turret: { cx: 2, cy: 19, r: 9 }, tracked: true,
    cannon: { x: 3, y: 21, len: 26, thick: 4 } },
  [TankType.Heavy]: { hull: [[-24, 11], [-21, 21], [21, 21], [24, 11]], turret: [[-12, 21], [-10, 28], [12, 28], [14, 21]], tracked: true,
    cannon: { x: 4, y: 24, len: 24, thick: 4, twin: true } },
  [TankType.Artillery]: { hull: [[-22, 11], [-18, 17], [20, 17], [23, 11]], turret: [[-2, 17], [0, 22], [9, 22], [11, 17]], tracked: true,
    cannon: { x: 4, y: 18, len: 36, thick: 3.4 } },
};
const HULL_DEPTH = 20, TURRET_DEPTH = 14, TRACK_DEPTH = 24, WHEEL_LEN = 26;
const BEVEL = { bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.2, bevelSegments: 2 };

/** A type's cannon in a build: pivot, barrel length and thickness, twin barrels, a muzzle brake (C's). */
export function cannonOf(type: TankType, variant: Variant) {
  const c = BODIES[type].cannon, [len, th] = BUILD_GUN[variant];
  return { x: c.x, y: c.y, len: c.len * len, thick: c.thick * th, twin: !!c.twin, brake: variant === Variant.C };
}

const mat = (color: THREE.Color | string, roughness = 0.6, metalness = 0.1) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
/** A material kept for the whole game (shared by every model): never disposed with a model. */
export const shared = <M extends THREE.Material>(m: M) => { m.userData.shared = true; return m; };
const WRECK = shared(mat('#2b2725', 0.9, 0.3)), METAL = shared(mat('#5b5e66', 0.5, 0.4)), TRACK = shared(mat('#34343c', 0.85)), HUB = shared(mat('#9a9aa6', 0.5, 0.3));
export const GOLD = shared(new THREE.MeshStandardMaterial({ color: '#ffc928', roughness: 0.3, metalness: 0.8, emissive: '#8a5a00', emissiveIntensity: 0.4 }));
const EDGE = shared(new THREE.MeshStandardMaterial({ color: '#ffd84a', emissive: '#ffb000', emissiveIntensity: 0.6, side: THREE.BackSide }));

function extrude(pts: Pt[] | THREE.Shape, depth: number, material: THREE.Material, name: string) {
  const shape = pts instanceof THREE.Shape ? pts : new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, ...BEVEL });
  g.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(g, material); m.name = name; m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cylinder(r: number, len: number, material: THREE.Material, along: 'x' | 'z') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), material);
  m.userData.material = material; // its own look, for when grip gear's gold comes off
  if (along === 'x') m.rotation.z = -Math.PI / 2; else m.rotation.x = Math.PI / 2;
  m.castShadow = true;
  return m;
}

/** A missile pointing +x, centred on its origin: red body, white nose, dark fins. */
export function missileModel() {
  const g = new THREE.Group(); g.name = 'missile';
  g.add(cylinder(3.5, 16, mat('#e94b3c', 0.5), 'x'));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7, 16), mat('#ffffff', 0.5)); nose.rotation.z = -Math.PI / 2; nose.position.x = 11.5; g.add(nose);
  for (const s of [1, -1]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 1), METAL); fin.position.set(-8, s * 4, 0); g.add(fin); }
  return g;
}

/** A tank of a type and build in a colour: named parts hull, turret, tracks (tracked types), wheels, cannon (its
 *  barrels inside), and its bonus marks edge (shield), ring (power shell) and missile, hidden until setGear. */
export function tankModel(type: TankType, variant: Variant, color: string) {
  const b = BODIES[type], body = mat(color), light = mat(new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.25));
  const tank = new THREE.Group(); tank.name = 'tank';
  const hull = extrude(b.hull, HULL_DEPTH, body, 'hull');
  const turret = Array.isArray(b.turret) ? extrude(b.turret, TURRET_DEPTH, light, 'turret')
    : extrude(new THREE.Shape().absarc(b.turret.cx, b.turret.cy, b.turret.r, 0, Math.PI, false), TURRET_DEPTH, light, 'turret');
  tank.add(hull, turret);
  const wheels = new THREE.Group(); wheels.name = 'wheels';
  if (b.tracked) {
    const tracks = extrude(new THREE.Shape().moveTo(-W + 5, 0).lineTo(W - 5, 0).absarc(W - 5, 5.5, 5.5, -Math.PI / 2, Math.PI / 2, false)
      .lineTo(-W + 5, 11).absarc(-W + 5, 5.5, 5.5, Math.PI / 2, Math.PI * 1.5, false), TRACK_DEPTH, TRACK, 'tracks');
    tank.add(tracks);
    for (let x = -W + 6; x <= W - 6; x += 9) { const w = cylinder(3.6, WHEEL_LEN, HUB, 'z'); w.position.set(x, 5.5, 0); wheels.add(w); }
  } else for (const x of [-W + 9, 0, W - 9]) {
    const w = cylinder(6, WHEEL_LEN, TRACK, 'z'); w.position.set(x, 6, 0); wheels.add(w);
    const hub = cylinder(2.4, WHEEL_LEN + 1, HUB, 'z'); hub.position.set(x, 6, 0); wheels.add(hub);
  }
  tank.add(wheels);
  const c = cannonOf(type, variant), cannon = new THREE.Group(); cannon.name = 'cannon'; cannon.position.set(c.x, c.y, 0);
  const barrels = new THREE.Group(); barrels.name = 'barrels';
  for (const z of c.twin ? [-c.thick * 0.8, c.thick * 0.8] : [0]) {
    const barrel = cylinder(c.thick / 2, c.len, METAL, 'x'); barrel.position.set(c.len / 2, 0, z); barrels.add(barrel);
    if (c.brake) { const brake = cylinder(c.thick * 0.8, 4, METAL, 'x'); brake.position.set(c.len - 2, 0, z); barrels.add(brake); }
  }
  cannon.add(barrels); tank.add(cannon);
  const exhaust = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), METAL); exhaust.position.set(-W + 4, TANK_H - 9, 0); exhaust.name = 'exhaust'; tank.add(exhaust);
  // bonus marks: a gold outline (the hull and turret again, a little bigger, inside out), a gold ring, a missile on top
  const edge = new THREE.Group(); edge.name = 'edge'; edge.visible = false;
  for (const part of [hull, turret]) { const shell = new THREE.Mesh(part.geometry, EDGE); shell.scale.setScalar(1.1); shell.position.y = -0.8; edge.add(shell); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(TANK_W * 0.75, 1.2, 8, 48), GOLD); ring.name = 'ring'; ring.position.y = TANK_H / 2; ring.visible = false;
  const missile = missileModel(); missile.position.set(-4, TANK_H + 6, 0); missile.visible = false;
  tank.add(edge, ring, missile);
  return tank;
}

/** Turns a tank into its wreck: scorched dark steel, lightly dented (FR-025, FR-008). */
export function setWreck(tank: THREE.Group) {
  tank.traverse(o => {
    if (!(o instanceof THREE.Mesh) || o.material === EDGE || o.material === GOLD) return;
    o.material = WRECK;
    if (o.name === 'hull' || o.name === 'turret') {
      o.geometry = o.geometry.clone();
      const p = o.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { const d = Math.sin(i * 12.9898) * 0.8; p.setXYZ(i, p.getX(i) + d, p.getY(i) - Math.abs(d), p.getZ(i)); }
      o.geometry.computeVertexNormals();
    }
  });
  for (const name of ['edge', 'ring', 'missile']) tank.getObjectByName(name)!.visible = false;
  tank.userData.wreck = true;
}

/** Shows a tank's bonuses (007 FR-021): gold wheels (grip gear), a gold outline (shield), a gold ring (power shell),
 *  a missile on top. */
export function setGear(tank: THREE.Group, gear: { wheels: boolean; edge: boolean; ring: boolean; missile: boolean }) {
  if (tank.userData.wreck) return;
  for (const w of tank.getObjectByName('wheels')!.children as THREE.Mesh[]) w.material = gear.wheels ? GOLD : w.userData.material;
  tank.getObjectByName('edge')!.visible = gear.edge;
  tank.getObjectByName('ring')!.visible = gear.ring;
  tank.getObjectByName('missile')!.visible = gear.missile;
}

/** Points a tank: facing `dir` (1 right, −1 left), the body tilted `tilt` radians (clockwise, as the battle measures
 *  it) and the cannon at `angle` degrees from flat ground, whatever the tilt. */
export function setAim(tank: THREE.Group, angle: number, tilt: number, dir: number) {
  tank.scale.x = dir;
  tank.rotation.z = -tilt; // clockwise on screen is negative about +z (y up); the mirroring for dir comes first
  tank.getObjectByName('cannon')!.rotation.z = (angle + dir * tilt * 180 / Math.PI) * Math.PI / 180;
}

/** An air-drop crate: a wooden box with cross planks, its bottom at the origin. */
export function crateModel() {
  const g = new THREE.Group(); g.name = 'crate';
  const box = new THREE.Mesh(new THREE.BoxGeometry(CRATE_SIZE, CRATE_SIZE, CRATE_SIZE), mat('#c8913e', 0.8)); box.position.y = CRATE_SIZE / 2; box.castShadow = true; g.add(box);
  for (const r of [Math.PI / 4, -Math.PI / 4]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(CRATE_SIZE * 1.3, 3, CRATE_SIZE + 0.6), mat('#8a5a2b', 0.8));
    plank.position.y = CRATE_SIZE / 2; plank.rotation.z = r; g.add(plank);
  }
  return g;
}
/** A parachute canopy (white with a red top) and its lines, hanging from 26 above a crate's top. */
export function parachuteModel() {
  const g = new THREE.Group(); g.name = 'parachute';
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(22, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ffffff', 0.7));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(22.3, 20, 4, 0, Math.PI * 2, 0, Math.PI / 6), mat('#e94b3c', 0.7));
  canopy.position.y = cap.position.y = CRATE_SIZE + 26; canopy.scale.y = cap.scale.y = 0.6; g.add(canopy, cap);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 30, 4), mat('#444444'));
    line.position.set(x * 13, CRATE_SIZE + 12, z * 9); line.rotation.z = -x * 0.45; g.add(line);
  }
  return g;
}
/** A shell (a dark ball) or a missile, centred on its origin. */
export function shellModel(missile: boolean) {
  if (missile) { const m = missileModel(); m.scale.setScalar(1.3); return m; }
  const s = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12), mat('#2a2a30', 0.4, 0.5)); s.name = 'shell'; s.castShadow = true;
  return s;
}

// props on the hills behind the field: what stands where (x along the field), per map
const STONE = shared(mat('#c9bfa8', 0.9)), PLANK = shared(mat('#9a6b40', 0.85)), BAG = shared(mat('#c6ad63', 0.95)), SNOWBAG = shared(mat('#f2f6fb', 0.9)), WIRE = shared(mat('#4b4b4b', 0.6));
const HOLE = shared(mat('#2a2620', 1));
function ruin(wall: THREE.Material) {
  const g = new THREE.Group(); g.name = 'ruin';
  for (const [x, y, w, h] of [[0, 0, 60, 68], [60, 0, 44, 48], [8, 68, 12, 18]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 30), wall); b.position.set(x + w / 2, y + h / 2, 0); b.castShadow = true; g.add(b);
  }
  for (const [x, y] of [[14, 34], [38, 34], [78, 18]]) { const hole = new THREE.Mesh(new THREE.BoxGeometry(12, 18, 31), HOLE); hole.position.set(x, y, 0); g.add(hole); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(70, 4, 6), PLANK); beam.position.set(30, 74, 8); beam.rotation.z = 0.12; g.add(beam);
  return g;
}
function sandbags(bag: THREE.Material) {
  const g = new THREE.Group(); g.name = 'sandbags';
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 8), bag); s.scale.set(1.1, 0.65, 0.8);
    s.position.set(i * 20 + row * 10, 7 + row * 12, 0); s.castShadow = true; g.add(s);
  }
  return g;
}
function fence(w: number) {
  const g = new THREE.Group(); g.name = 'fence';
  for (let x = 0; x <= w; x += 28) { const post = new THREE.Mesh(new THREE.BoxGeometry(4, 28, 4), PLANK); post.position.set(x, 14, 0); g.add(post); }
  for (const y of [10, 20]) { const wire = new THREE.Mesh(new THREE.BoxGeometry(w, 1, 1), WIRE); wire.position.set(w / 2, y, 0); g.add(wire); }
  return g;
}
function logs() {
  const g = new THREE.Group(); g.name = 'logs';
  for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) {
    const l = cylinder(10, 60, PLANK, 'z'); l.position.set(i * 20 + row * 10, 10 + row * 17, 0); g.add(l);
  }
  return g;
}
const PROPS: Record<PlayableMap, [number, () => THREE.Group][]> = {
  [MapId.GreenHills]: [[300, () => ruin(STONE)], [220, () => sandbags(BAG)], [1180, () => sandbags(BAG)], [1240, () => fence(168)]],
  [MapId.TimberGap]: [[420, logs], [1150, logs], [820, () => sandbags(BAG)], [180, () => fence(140)]],
  [MapId.LakeValley]: [[1000, () => ruin(PLANK)], [260, () => sandbags(BAG)], [1320, () => sandbags(BAG)], [560, () => fence(168)]],
  [MapId.FrostRidge]: [[350, () => sandbags(SNOWBAG)], [1220, () => sandbags(SNOWBAG)], [700, () => fence(168)], [980, () => ruin(STONE)]],
};
/** A map's props, each with where it stands along the field. */
export const propModels = (map: PlayableMap) => PROPS[map].map(([x, make]) => ({ x, model: make() }));
