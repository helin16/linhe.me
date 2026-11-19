// The 3D board (research R7): a slab with holes, home areas tinted by each seat's type, original creatures built from
// simple shapes (one per type, the leader bigger with a crown), rings for the selection, reachable holes (long hops in a
// stronger colour), the keyboard cursor and hints, hop animations with each type's effect, an orbiting camera that can
// turn to face a home, and picking a hole from a tap. Runs only in a browser (WebGL): covered by end-to-end tests.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Detail, detailProbe, LOW_DETAIL_RATIO } from '../../shared/detail.ts';
import { softwareGpu } from '../../shared/render.ts';
import type { Board } from './boards.ts';
import { Ears, HopEffect, HopKind, type CritterType } from './enums.ts';
import type { Game, Move } from './rules.ts';
import { LOOKS } from './types.ts';

const HOLE_R = 0.3, SLAB_H = 0.4, PICK_R = 0.55;
const TILE_HEX = 1 / Math.sqrt(3) + 0.02, TILE_SQUARE = Math.SQRT1_2 + 0.01; // tiles that just meet their neighbours
const BODY = 0.3, LEADER = 1.3, JUMP = 0.9;
const CAM_FOV = 45, CAM_POLAR = 0.7, CAM_DIST = 2.5, CAM_MIN_POLAR = 0.15, CAM_MAX_POLAR = 1.25, ZOOM_STEP = 1.15, TURN_STEP = Math.PI / 8;
const FACE_S = 0.6;                       // turning to face a home takes this long
const SPARKS = 10, SPARK_S = 0.6;
const RING = { select: '#ffffff', reach: '#ffe14d', long: '#ff4dd8', cursor: '#00e5ff', hint: '#7dff7a' } as const;
export type RingKind = keyof typeof RING;

/** One creature of a type, built from primitives; `leader` adds a crown. Geometries and materials are shared. */
function creatureModel(type: CritterType, leader: boolean, mat: (color: string) => THREE.Material) {
  const look = LOOKS[type], g = new THREE.Group();
  const ball = (r: number, c: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(shared.sphere, mat(c)); m.scale.set(r * sx, r * sy, r * sz); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
  };
  ball(BODY, look.color, 0, BODY, 0, 1, 0.9, 1);                       // body
  ball(BODY * 0.72, look.color, 0, BODY * 1.85, 0.05);                 // head
  ball(BODY * 0.42, look.accent, 0, BODY * 0.95, 0.2, 1, 0.8, 0.6);    // tummy
  for (const s of [-1, 1]) {
    ball(BODY * 0.12, '#111111', s * 0.09, BODY * 1.95, 0.24);         // eyes
    const pointed = look.ears === Ears.Flame || look.ears === Ears.Horn;
    const ear = new THREE.Mesh(pointed ? shared.cone : look.ears === Ears.Bolt ? shared.box : shared.sphere, mat(look.accent));
    ear.castShadow = true;
    if (pointed) { ear.scale.set(0.08, 0.2, 0.08); ear.position.set(s * 0.12, BODY * 2.4, 0); ear.rotation.z = -s * 0.35; }
    if (look.ears === Ears.Fin) { ear.scale.set(0.03, 0.14, 0.12); ear.position.set(s * 0.2, BODY * 2.05, -0.02); }
    if (look.ears === Ears.Leaf) { ear.scale.set(0.12, 0.04, 0.07); ear.position.set(s * 0.18, BODY * 2.35, 0); ear.rotation.z = s * 0.5; }
    if (look.ears === Ears.Bolt) { ear.scale.set(0.05, 0.22, 0.05); ear.position.set(s * 0.14, BODY * 2.4, 0); ear.rotation.z = -s * 0.6; }
    if (look.ears === Ears.Orb) { ear.scale.setScalar(0.06); ear.position.set(s * 0.16, BODY * 2.6, 0); }
    g.add(ear);
  }
  if (leader) {
    const crown = new THREE.Mesh(shared.crown, mat('#ffd700'));
    crown.rotation.x = Math.PI / 2; crown.position.y = BODY * 2.55; g.add(crown);
    g.scale.setScalar(LEADER);
  }
  return g;
}
const shared = {
  sphere: new THREE.SphereGeometry(1, 16, 12), cone: new THREE.ConeGeometry(1, 1, 10), box: new THREE.BoxGeometry(1, 1, 1),
  crown: new THREE.TorusGeometry(0.13, 0.03, 6, 16), ring: new THREE.RingGeometry(0.34, 0.46, 24),
};
// each type's hop effect: its own particle shape (and its colours)
const PARTICLE: Record<HopEffect, THREE.BufferGeometry> = {
  [HopEffect.Embers]: new THREE.TetrahedronGeometry(0.07), [HopEffect.Droplets]: new THREE.SphereGeometry(0.05, 6, 4),
  [HopEffect.Leaves]: new THREE.BoxGeometry(0.1, 0.015, 0.06), [HopEffect.Sparks]: new THREE.BoxGeometry(0.02, 0.14, 0.02),
  [HopEffect.Glimmer]: new THREE.OctahedronGeometry(0.06), [HopEffect.Pebbles]: new THREE.DodecahedronGeometry(0.06),
};

type Hop = { move: Move; seg: number; t: number; segS: number; done: () => void };
type Spark = { mesh: THREE.Mesh; v: THREE.Vector3; t: number };

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !softwareGpu() });
  let ratio = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(ratio);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfe3ff');
  const camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 0.1, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false; controls.enableDamping = true;
  controls.minPolarAngle = CAM_MIN_POLAR; controls.maxPolarAngle = CAM_MAX_POLAR;
  scene.add(new THREE.HemisphereLight('#ffffff', '#6b8f5e', 0.75));
  const sun = new THREE.DirectionalLight('#ffffff', 0.8);
  sun.position.set(6, 14, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
  scene.add(sun);
  const world = new THREE.Group(); scene.add(world);
  const mats = new Map<string, THREE.Material>();
  const ringMats = Object.fromEntries(Object.entries(RING).map(([k, c]) => [k, new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })])) as unknown as Record<RingKind, THREE.Material>;
  const probe = detailProbe();

  let board: Board | null = null, models: THREE.Group[] = [], rings: THREE.Mesh[] = [], hop: Hop | null = null, sparks: Spark[] = [];
  let face: { from: number; to: number; t: number } | null = null, radius = 20;
  const at = (hole: number, y = 0) => new THREE.Vector3(board!.pos[hole][0], y, board!.pos[hole][1]);

  function clear() {
    const keep = new Set<unknown>([...Object.values(shared), ...Object.values(PARTICLE), ...mats.values(), ...Object.values(ringMats)]);
    world.traverse(o => { if (o instanceof THREE.Mesh) for (const x of [o.geometry, o.material]) if (!keep.has(x)) x.dispose(); });
    world.remove(...world.children);
    const cut = hop; // a hop cut short (a new game or a sync mid-move) still resolves, so its awaiter can finish
    models = []; rings = []; sparks = []; hop = null; face = null;
    cut?.done();
  }

  /** Builds the board and creatures for a game (home areas tinted by the seats' types) and frames the camera. */
  function setGame(g: Game) {
    clear();
    board = g.board;
    const ext = Math.max(...board.pos.map(([x, y]) => Math.hypot(x, y))) + 1;
    // the board's shape: a tile under every hole (hexagons on the star, squares on the cross), so its points or arms show
    const star = board.dirs.length === 6;
    const tiles = new THREE.InstancedMesh(new THREE.CylinderGeometry(star ? TILE_HEX : TILE_SQUARE, star ? TILE_HEX : TILE_SQUARE, SLAB_H, star ? 6 : 4),
      mat('#f4e1b6'), board.holes.length);
    // a 6-sided cylinder already has flat sides toward the star's neighbours; the square needs a 45° turn
    const tm = new THREE.Matrix4(), turnTile = new THREE.Matrix4().makeRotationY(star ? 0 : Math.PI / 4);
    board.holes.forEach((_, i) => tiles.setMatrixAt(i, tm.makeTranslation(board!.pos[i][0], -SLAB_H / 2, board!.pos[i][1]).multiply(turnTile)));
    tiles.receiveShadow = true; world.add(tiles);
    const holes = new THREE.InstancedMesh(new THREE.CylinderGeometry(HOLE_R, HOLE_R, 0.02, 16), new THREE.MeshStandardMaterial({ roughness: 0.8 }), board.holes.length);
    const tint = new Map<number, string>();
    for (const s of g.seats) { for (const h of board.homes[s.home]) tint.set(h, LOOKS[s.type].color); for (const h of board.homes[s.target]) if (!tint.has(h)) tint.set(h, LOOKS[s.type].color); }
    const m = new THREE.Matrix4(), c = new THREE.Color();
    board.holes.forEach((_, i) => {
      m.makeTranslation(board!.pos[i][0], 0.01, board!.pos[i][1]); holes.setMatrixAt(i, m);
      holes.setColorAt(i, c.set(tint.get(i) ?? '#b08a5a').lerp(new THREE.Color('#5a4126'), tint.has(i) ? 0.2 : 0.35));
    });
    holes.receiveShadow = true; world.add(holes);
    models = g.pieces.map(p => { const model = creatureModel(g.seats[p.seat].type, p.leader, mat); world.add(model); return model; });
    sync(g);
    radius = ext * CAM_DIST; controls.minDistance = ext * 0.6; controls.maxDistance = ext * 3;
    camera.position.setFromSpherical(new THREE.Spherical(radius, CAM_POLAR, 0)); controls.target.set(0, 0, 0); controls.update();
    probe.restart();
  }
  function mat(c: string) { if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })); return mats.get(c)!; }
  /** Puts every creature on its hole. */
  function sync(g: Game) { g.pieces.forEach((p, i) => { models[i].position.copy(at(p.hole)); models[i].rotation.y = 0; }); }

  /** Shows rings: [hole, kind]. */
  function setRings(list: [number, RingKind][]) {
    for (const r of rings) world.remove(r);
    rings = list.map(([hole, kind]) => {
      const r = new THREE.Mesh(shared.ring, ringMats[kind]);
      r.rotation.x = -Math.PI / 2; r.position.copy(at(hole, 0.05)); r.scale.setScalar(kind === 'select' ? 1.25 : 1);
      world.add(r); return r;
    });
  }

  /** Animates a move along its path, `segMs` per step or hop; resolves when the creature lands. */
  function animate(m: Move, type: CritterType, segMs: number) {
    return new Promise<void>(done => {
      hop = { move: m, seg: 0, t: 0, segS: segMs / 1000, done };
      burst(m.path[0], type);
    });
  }
  function burst(hole: number, type: CritterType) {
    const look = LOOKS[type];
    for (let i = 0; i < (probe.detail === Detail.Low ? SPARKS / 2 : SPARKS); i++) {
      const s = new THREE.Mesh(PARTICLE[look.effect], mat(i % 2 ? look.color : look.accent));
      s.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      s.position.copy(at(hole, 0.3));
      sparks.push({ mesh: s, v: new THREE.Vector3(Math.random() - 0.5, 1 + Math.random(), Math.random() - 0.5).multiplyScalar(2), t: 0 });
      world.add(s);
    }
  }

  /** Turns the camera (smoothly) so a home is nearest the viewer. */
  function faceHome(home: number) {
    if (!board) return;
    const h = board.homes[home], x = h.reduce((s, i) => s + board!.pos[i][0], 0), z = h.reduce((s, i) => s + board!.pos[i][1], 0);
    const now = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    let to = Math.atan2(x, z);
    while (to - now.theta > Math.PI) to -= 2 * Math.PI;
    while (to - now.theta < -Math.PI) to += 2 * Math.PI;
    face = { from: now.theta, to, t: 0 };
  }
  /** Keyboard: turn the board a step (−1 / +1) or zoom (factor < 1 is closer). */
  function turn(dir: number) { orbit(s => { s.theta += dir * TURN_STEP; }); }
  function zoom(factor: number) { orbit(s => { s.radius = THREE.MathUtils.clamp(s.radius * factor, controls.minDistance, controls.maxDistance); }); }
  function orbit(change: (s: THREE.Spherical) => void) {
    const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    change(s); camera.position.setFromSpherical(s).add(controls.target); controls.update();
  }

  /** The hole under a screen point (CSS pixels in the canvas), or −1. */
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function pick(x: number, y: number) {
    if (!board) return -1;
    ray.setFromCamera(new THREE.Vector2((x / canvas.clientWidth) * 2 - 1, -(y / canvas.clientHeight) * 2 + 1), camera);
    const p = ray.ray.intersectPlane(plane, new THREE.Vector3());
    if (!p) return -1;
    let best = -1, bestD = PICK_R;
    board.pos.forEach(([hx, hz], i) => { const d = Math.hypot(hx - p.x, hz - p.z); if (d < bestD) { bestD = d; best = i; } });
    return best;
  }
  /** A hole's position on screen (CSS pixels in the canvas). */
  function project(hole: number) {
    const v = at(hole, 0.3).project(camera); // clientWidth/Height: no layout read per call (the canvas fills the root)
    return { x: (v.x + 1) / 2 * canvas.clientWidth, y: (1 - v.y) / 2 * canvas.clientHeight };
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  /** One frame: hops, sparks, camera turns, then draw. */
  function render(dt: number) {
    if (canvas.width !== Math.floor(canvas.clientWidth * ratio) || canvas.height !== Math.floor(canvas.clientHeight * ratio)) resize();
    if (hop) {
      const h = hop, from = at(h.move.path[h.seg]), to = at(h.move.path[h.seg + 1]), model = models[h.move.piece];
      h.t += dt / h.segS;
      const k = Math.min(1, h.t), lift = h.move.kinds[h.seg] === HopKind.Step ? 0.3 : h.move.kinds[h.seg] === HopKind.LongHop ? JUMP * 1.6 : JUMP;
      model.position.lerpVectors(from, to, k); model.position.y = Math.sin(Math.PI * k) * lift;
      model.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      if (k >= 1) { h.seg++; h.t = 0; if (h.seg >= h.move.path.length - 1) { hop = null; model.position.y = 0; h.done(); } }
    }
    sparks = sparks.filter(s => {
      s.t += dt; s.v.y -= 6 * dt; s.mesh.position.addScaledVector(s.v, dt);
      if (s.t < SPARK_S) return true;
      world.remove(s.mesh); return false;
    });
    if (face) {
      face.t = Math.min(1, face.t + dt / FACE_S);
      const f = face, e = f.t * f.t * (3 - 2 * f.t);
      orbit(s => { s.theta = f.from + (f.to - f.from) * e; });
      if (f.t >= 1) face = null;
    }
    controls.update();
    renderer.render(scene, camera);
    if (probe.frame(dt, true)) { ratio = LOW_DETAIL_RATIO; renderer.setPixelRatio(ratio); renderer.shadowMap.enabled = false; resize(); }
  }

  return {
    setGame, setRings, animate, burst, faceHome, turn, zoom, pick, project, render,
    zoomStep: ZOOM_STEP,
    dispose() {
      clear(); controls.dispose();
      for (const m of [...mats.values(), ...Object.values(ringMats)]) m.dispose();
      renderer.dispose(); renderer.forceContextLoss(); // free the GL context now, not at garbage collection
    },
  };
}
