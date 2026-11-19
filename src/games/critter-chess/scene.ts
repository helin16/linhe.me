// The 3D boards and armies (research R7): checkered square cells (8 × 8 and the cross) or three-shade hexagons, 36
// original creatures — six silhouettes (pawn, knight, bishop, rook, queen, king) each dressed in a type's colours, ears
// and effect — rings for the selection, moves, captures, check, the last move, the keyboard cursor and hints, moves that
// slide (knights leap), an orbiting camera that turns to face an army, and picking a cell from a tap. Browser-only
// (WebGL): covered by the end-to-end tests.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Detail, detailProbe, LOW_DETAIL_RATIO } from '../../shared/detail.ts';
import { softwareGpu } from '../../shared/render.ts';
import type { Board } from './boards.ts';
import { ChessEars, ChessEffect, PieceKind, type CritterType } from './enums.ts';
import type { Game, Move } from './rules.ts';
import { LOOKS } from './types.ts';

const TILE_H = 0.3, PICK_R = 0.6;
const TILE_HEX = 1 / Math.sqrt(3) + 0.01, TILE_SQUARE = Math.SQRT1_2 + 0.005; // cells that just meet their neighbours
const SQUARE_SHADES = ['#f3e3c3', '#b98b5e'], HEX_SHADES = ['#f3e3c3', '#d8b48a', '#b98b5e'];
const CAM_FOV = 45, CAM_POLAR = 0.75, CAM_DIST = 2.2, CAM_MIN_POLAR = 0.15, CAM_MAX_POLAR = 1.25, ZOOM_STEP = 1.15, TURN_STEP = Math.PI / 8;
const RING_Y = 0.02, RING_STEP = 0.004;
const FACE_S = 0.6, LEAP = 0.9, SLIDE_LIFT = 0.15, SPARKS = 10, SPARK_S = 0.6;
const RING = { select: '#ffffff', reach: '#ffe14d', capture: '#ff4d4d', check: '#ff1f1f', last: '#9be7ff', cursor: '#00e5ff', hint: '#7dff7a' } as const;
export type RingKind = keyof typeof RING;
// each piece kind's silhouette: overall size and height
const SIZE: Record<PieceKind, number> = {
  [PieceKind.Pawn]: 0.75, [PieceKind.Knight]: 0.9, [PieceKind.Bishop]: 0.9, [PieceKind.Rook]: 0.95, [PieceKind.Queen]: 1.0, [PieceKind.King]: 1.05,
};
const TALL: Record<PieceKind, number> = {
  [PieceKind.Pawn]: 1, [PieceKind.Knight]: 1.15, [PieceKind.Bishop]: 1.45, [PieceKind.Rook]: 1.05, [PieceKind.Queen]: 1.5, [PieceKind.King]: 1.6,
};
const shared = {
  sphere: new THREE.SphereGeometry(1, 16, 12), cone: new THREE.ConeGeometry(1, 1, 10), box: new THREE.BoxGeometry(1, 1, 1),
  torus: new THREE.TorusGeometry(1, 0.22, 6, 18), ring: new THREE.RingGeometry(0.36, 0.47, 24),
};
const PARTICLE: Record<ChessEffect, THREE.BufferGeometry> = {
  [ChessEffect.Embers]: new THREE.TetrahedronGeometry(0.07), [ChessEffect.Droplets]: new THREE.SphereGeometry(0.05, 6, 4),
  [ChessEffect.Leaves]: new THREE.BoxGeometry(0.1, 0.015, 0.06), [ChessEffect.Sparks]: new THREE.BoxGeometry(0.02, 0.14, 0.02),
  [ChessEffect.Glimmer]: new THREE.OctahedronGeometry(0.06), [ChessEffect.Pebbles]: new THREE.DodecahedronGeometry(0.06),
};

/** One creature: the kind's silhouette in the type's colours and ears. Built facing +z. */
function creature(kind: PieceKind, type: CritterType, mat: (color: string) => THREE.Material) {
  const look = LOOKS[type], g = new THREE.Group(), tall = TALL[kind], B = 0.28;
  const part = (geo: THREE.BufferGeometry, c: string, [x, y, z]: number[], [sx, sy, sz]: number[], rz = 0) => {
    const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.z = rz; m.castShadow = true; g.add(m); return m;
  };
  const headY = B * (1.1 + tall * 0.8);
  if (kind === PieceKind.Rook) part(shared.box, look.color, [0, B * tall * 0.75, 0], [B * 1.9, B * tall * 1.5, B * 1.9]); // a sturdy block
  else part(shared.sphere, look.color, [0, B * tall * 0.75, 0], [B, B * tall * 0.85, B]);                                 // a round body
  part(shared.sphere, look.accent, [0, B * tall * 0.65, B * 0.55], [B * 0.55, B * tall * 0.45, B * 0.35]);               // tummy
  part(shared.sphere, look.color, [0, headY, 0.03], [B * 0.72, B * 0.72, B * 0.72]);                                     // head
  for (const s of [-1, 1]) {
    part(shared.sphere, '#111111', [s * 0.08, headY + 0.03, B * 0.62], [0.035, 0.035, 0.035]);                          // eyes
    const pointed = look.ears === ChessEars.Flame || look.ears === ChessEars.Horn;
    const geo = pointed ? shared.cone : look.ears === ChessEars.Bolt ? shared.box : shared.sphere, y = headY + B * 0.6;
    if (pointed) part(geo, look.accent, [s * 0.11, y, 0], [0.07, 0.18, 0.07], -s * 0.35);
    if (look.ears === ChessEars.Fin) part(geo, look.accent, [s * 0.19, headY + 0.03, -0.02], [0.03, 0.13, 0.11]);
    if (look.ears === ChessEars.Leaf) part(geo, look.accent, [s * 0.16, y, 0], [0.11, 0.035, 0.06], s * 0.5);
    if (look.ears === ChessEars.Bolt) part(geo, look.accent, [s * 0.13, y, 0], [0.045, 0.2, 0.045], -s * 0.6);
    if (look.ears === ChessEars.Orb) part(geo, look.accent, [s * 0.15, y + 0.08, 0], [0.055, 0.055, 0.055]);
  }
  const top = headY + B * 0.72;
  if (kind === PieceKind.Knight) part(shared.sphere, look.color, [0, headY - 0.04, B * 0.75], [B * 0.4, B * 0.32, B * 0.6]); // a long snout
  if (kind === PieceKind.Bishop) part(shared.cone, look.accent, [0, top + 0.1, 0], [B * 0.45, B * 1.1, B * 0.45]);          // a pointed cap
  if (kind === PieceKind.Rook) for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])                                   // battlements
    part(shared.box, look.accent, [x * B * 0.7, B * tall * 1.5 + 0.04, z * B * 0.7], [0.1, 0.1, 0.1]);
  if (kind === PieceKind.Queen) {
    const frill = part(shared.torus, look.accent, [0, headY - B * 0.65, 0], [B * 0.75, B * 0.75, B * 0.75]); frill.rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; part(shared.cone, '#ffd700', [Math.sin(a) * 0.1, top + 0.03, Math.cos(a) * 0.1], [0.03, 0.1, 0.03]); }
  }
  if (kind === PieceKind.King) {
    const crown = part(shared.torus, '#ffd700', [0, top, 0], [B * 0.5, B * 0.5, B * 0.5]); crown.rotation.x = Math.PI / 2;
    part(shared.box, '#ffd700', [0, top + 0.13, 0], [0.04, 0.16, 0.04]); part(shared.box, '#ffd700', [0, top + 0.15, 0], [0.12, 0.04, 0.04]);
  }
  g.scale.setScalar(SIZE[kind]);
  return g;
}

type Slide = { piece: number; from: THREE.Vector3; to: THREE.Vector3; leap: boolean; t: number; s: number; done: () => void };
type Spark = { mesh: THREE.Mesh; v: THREE.Vector3; t: number };

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !softwareGpu() });
  let ratio = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(ratio);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cfe8d8');
  const camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 0.1, 300);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false; controls.enableDamping = true;
  controls.minPolarAngle = CAM_MIN_POLAR; controls.maxPolarAngle = CAM_MAX_POLAR;
  scene.add(new THREE.HemisphereLight('#ffffff', '#6b8f5e', 0.75));
  const sun = new THREE.DirectionalLight('#ffffff', 0.8);
  sun.position.set(8, 18, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
  scene.add(sun);
  const world = new THREE.Group(); scene.add(world);
  const mats = new Map<string, THREE.Material>();
  const ringMats = Object.fromEntries(Object.entries(RING).map(([k, c]) => [k, new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })])) as unknown as Record<RingKind, THREE.Material>;
  const probe = detailProbe();
  const mat = (c: string) => { if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })); return mats.get(c)!; };

  let board: Board | null = null, models: (THREE.Group | null)[] = [], kinds: PieceKind[] = [], rings: THREE.Mesh[] = [];
  let slide: Slide | null = null, sparks: Spark[] = [], face: { from: number; to: number; t: number } | null = null;
  let facing: number[] = []; // each army's facing angle (toward the middle)
  const at = (cell: number, y = 0) => new THREE.Vector3(board!.pos[cell][0], y, board!.pos[cell][1]);

  function clear() {
    const keep = new Set<unknown>([...Object.values(shared), ...Object.values(PARTICLE), ...mats.values(), ...Object.values(ringMats)]);
    world.traverse(o => { if (o instanceof THREE.Mesh) for (const x of [o.geometry, o.material]) if (!keep.has(x)) x.dispose(); });
    world.remove(...world.children);
    const cut = slide; // a move cut short (a new game or a sync mid-move) still resolves, so its awaiter can finish
    models = []; kinds = []; rings = []; sparks = []; slide = null; face = null;
    cut?.done();
  }

  /** Builds the board and armies for a game and frames the camera. */
  function setGame(g: Game) {
    clear();
    const b = board = g.board;
    const hex = b.straight[0].length === 6, ext = Math.max(...b.pos.map(([x, y]) => Math.hypot(x, y))) + 1;
    const size = hex ? TILE_HEX : TILE_SQUARE;
    const tiles = new THREE.InstancedMesh(new THREE.CylinderGeometry(size, size, TILE_H, hex ? 6 : 4), new THREE.MeshStandardMaterial({ roughness: 0.75 }), b.cells.length);
    const m = new THREE.Matrix4(), turn = new THREE.Matrix4().makeRotationY(hex ? 0 : Math.PI / 4), c = new THREE.Color();
    b.cells.forEach(([u, v], i) => {
      tiles.setMatrixAt(i, m.makeTranslation(b.pos[i][0], -TILE_H / 2, b.pos[i][1]).multiply(turn));
      tiles.setColorAt(i, c.set(hex ? HEX_SHADES[(((u - v) % 3) + 3) % 3] : SQUARE_SHADES[(u + v) % 2]));
    });
    tiles.receiveShadow = true; world.add(tiles);
    facing = b.armies.map(a => {
      const x = a.back.reduce((s, i) => s + b.pos[i][0], 0), z = a.back.reduce((s, i) => s + b.pos[i][1], 0);
      return Math.atan2(-x, -z);
    });
    sync(g);
    controls.minDistance = ext * 0.5; controls.maxDistance = ext * 3;
    camera.position.setFromSpherical(new THREE.Spherical(ext * CAM_DIST, CAM_POLAR, 0)); controls.target.set(0, 0, 0); controls.update();
    probe.restart();
  }
  /** Puts every creature on its cell: new models for new or promoted pieces, none for captured ones. */
  function sync(g: Game) {
    g.pieces.forEach((p, i) => {
      if (models[i] && (kinds[i] !== p.kind || p.cell < 0)) { world.remove(models[i]!); models[i] = null; }
      if (p.cell < 0) return;
      if (!models[i]) { models[i] = creature(p.kind, g.seats[p.seat].type, mat); kinds[i] = p.kind; world.add(models[i]!); }
      models[i]!.position.copy(at(p.cell)); models[i]!.rotation.y = facing[p.seat];
    });
  }

  /** Shows rings: [cell, kind]. */
  function setRings(list: [number, RingKind][]) {
    for (const r of rings) world.remove(r);
    rings = list.map(([cell, kind], i) => {
      const r = new THREE.Mesh(shared.ring, ringMats[kind]);
      r.rotation.x = -Math.PI / 2; r.position.copy(at(cell, RING_Y + i * RING_STEP)); // stacked rings on one cell don't flicker r.scale.setScalar(kind === 'select' || kind === 'check' ? 1.2 : 1);
      world.add(r); return r;
    });
  }

  /** Animates a move (knights leap, others slide); resolves when the piece lands. Call sync afterwards. */
  function animate(m: Move, type: CritterType, ms: number, knight: boolean) {
    return new Promise<void>(done => {
      if (!models[m.piece]) return done();
      slide = { piece: m.piece, from: at(m.from), to: at(m.to), leap: knight, t: 0, s: ms / 1000, done };
      if (m.capture >= 0) burst(m.to, type);
    });
  }
  function burst(cell: number, type: CritterType) {
    const look = LOOKS[type];
    for (let i = 0; i < (probe.detail === Detail.Low ? SPARKS / 2 : SPARKS); i++) {
      const s = new THREE.Mesh(PARTICLE[look.effect], mat(i % 2 ? look.color : look.accent));
      s.rotation.set(Math.random() * 3, Math.random() * 3, 0); s.position.copy(at(cell, 0.3));
      sparks.push({ mesh: s, v: new THREE.Vector3(Math.random() - 0.5, 1 + Math.random(), Math.random() - 0.5).multiplyScalar(2), t: 0 });
      world.add(s);
    }
  }

  /** Turns the camera (smoothly) so an army is nearest the viewer. */
  function faceSeat(seat: number) {
    if (!board) return;
    const a = board.armies[seat], x = a.back.reduce((s, i) => s + board!.pos[i][0], 0), z = a.back.reduce((s, i) => s + board!.pos[i][1], 0);
    const now = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    let to = Math.atan2(x, z);
    while (to - now.theta > Math.PI) to -= 2 * Math.PI;
    while (to - now.theta < -Math.PI) to += 2 * Math.PI;
    face = { from: now.theta, to, t: 0 };
  }
  function turn(dir: number) { orbit(s => { s.theta += dir * TURN_STEP; }); }
  function zoom(factor: number) { orbit(s => { s.radius = THREE.MathUtils.clamp(s.radius * factor, controls.minDistance, controls.maxDistance); }); }
  function orbit(change: (s: THREE.Spherical) => void) {
    const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    change(s); camera.position.setFromSpherical(s).add(controls.target); controls.update();
  }

  /** The cell under a screen point (CSS pixels in the canvas), or −1. */
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function pick(x: number, y: number) {
    if (!board) return -1;
    ray.setFromCamera(new THREE.Vector2((x / canvas.clientWidth) * 2 - 1, -(y / canvas.clientHeight) * 2 + 1), camera);
    const p = ray.ray.intersectPlane(plane, new THREE.Vector3());
    if (!p) return -1;
    let best = -1, bestD = PICK_R;
    board.pos.forEach(([cx, cz], i) => { const d = Math.hypot(cx - p.x, cz - p.z); if (d < bestD) { bestD = d; best = i; } });
    return best;
  }
  /** A cell's position on screen (CSS pixels in the canvas). */
  function project(cell: number) {
    const v = at(cell, 0.3).project(camera);
    return { x: (v.x + 1) / 2 * canvas.clientWidth, y: (1 - v.y) / 2 * canvas.clientHeight };
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  /** One frame: the moving piece, sparks, camera turns, then draw. */
  function render(dt: number) {
    if (canvas.width !== Math.floor(canvas.clientWidth * ratio) || canvas.height !== Math.floor(canvas.clientHeight * ratio)) resize();
    if (slide) {
      const s = slide, model = models[s.piece];
      s.t = Math.min(1, s.t + dt / s.s);
      if (model) { model.position.lerpVectors(s.from, s.to, s.t); model.position.y = Math.sin(Math.PI * s.t) * (s.leap ? LEAP : SLIDE_LIFT); }
      if (s.t >= 1) { slide = null; s.done(); }
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
    setGame, sync, setRings, animate, faceSeat, turn, zoom, pick, project, render, zoomStep: ZOOM_STEP,
    dispose() {
      clear(); controls.dispose();
      for (const m of [...mats.values(), ...Object.values(ringMats)]) m.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
