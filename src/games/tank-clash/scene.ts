// The 3D battle (specs/009-tank-semi-3d): a three.js scene seen side-on with a little depth — the ground built from the
// breakable grid (ground.ts), solid toy-like tanks, wrecks, crates and shells (models.ts), layered scenery per map
// behind the field, lights and soft shadows, explosions, smoke and splinters — and a flat layer over it for names,
// health bars, the active tank's arrow and rising repair hearts, so they stay sharp at any zoom. Runs only in a
// browser (WebGL), so it is covered by the end-to-end tests (constitution VII). Field y points down; three's y up.
import * as THREE from 'three';
import {
  CAMERA_FOV, CAMERA_TILT_DEG, CELL, DETAIL_PROBE_S, FAR_LAYER_Z, GRID_W, GROUND_DEPTH, LOW_DETAIL_FPS, NEAR_LAYER_Z, TANK_H, TANK_W,
  WORLD_H, WORLD_W,
} from './constants.ts';
import { GroundPart, MapId, Material, Phase, Variant } from './enums.ts';
import { CHUNKS, chunkMesh, dirtyChunks } from './ground.ts';
import { crateModel, parachuteModel, propModels, setAim, setGear, setWreck, shared, shellModel, tankModel } from './models.ts';
import type { TankLook } from './settings.ts';
import { activeTank, facing, tiltOf, type Battle } from './sim.ts';
import { specOf } from './tanks.ts';
import { groundBelow, surfaceAt, type PlayableMap, type Terrain } from './terrain.ts';
import type { View } from './camera.ts';

const CHEER_S = 1.2;     // a repair kit's heart rises and fades this long
const TEX = 256;         // procedural textures' size in pixels (they cover 64 units: ground.ts UV_SCALE)
const EDGE_REACH = 4000; // the ground and scenery carry on this far past the field's sides
const BOOM_S = 0.9;      // an explosion shows this long
const SPLINTERS = 18;    // pieces of wood flying from a broken bridge, at most
const LOW_DETAIL_RATIO = 0.75; // low detail draws at this pixel ratio (fewer pixels to fill)
const OUTLINE = '#1d1d24';
const y3 = (y: number) => WORLD_H - y; // field y (down) to three's (up)

// each map's sky, far and near hills and its extra scenery (the 2D look's colours)
type Look = { skyTop: string; skyBottom: string; far: string; near: string; extra: 'farm' | 'forest' | 'lake' | 'peaks' };
export const SCENES: Record<PlayableMap, Look> = {
  [MapId.GreenHills]: { skyTop: '#5ab4f0', skyBottom: '#cdeeff', far: '#9fd3a4', near: '#7cc184', extra: 'farm' },
  [MapId.TimberGap]: { skyTop: '#f2a65a', skyBottom: '#ffe3b3', far: '#c99a6b', near: '#a9805a', extra: 'forest' },
  [MapId.LakeValley]: { skyTop: '#4fa3e0', skyBottom: '#d8f1ff', far: '#8fc7c0', near: '#6fb0a8', extra: 'lake' },
  [MapId.FrostRidge]: { skyTop: '#8fb8de', skyBottom: '#eef6ff', far: '#c4d4e6', near: '#a9bfd8', extra: 'peaks' },
};

// --- procedural textures (clean and simple: FR-015) ---
function texture(draw: (c: CanvasRenderingContext2D, rnd: () => number) => void) {
  const cv = document.createElement('canvas'); cv.width = cv.height = TEX;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  draw(cv.getContext('2d')!, rnd);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
const dots = (c: CanvasRenderingContext2D, rnd: () => number, n: number, color: string, r: number) => {
  c.fillStyle = color;
  for (let i = 0; i < n; i++) { c.beginPath(); c.arc(rnd() * TEX, rnd() * TEX, r * (0.5 + rnd()), 0, Math.PI * 2); c.fill(); }
};
function groundMaterials(): Record<GroundPart, THREE.MeshStandardMaterial> {
  const soil = texture((c, rnd) => {
    ['#8a5a34', '#7b4f2d', '#8f603a', '#6e4628'].forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * TEX / 4, TEX, TEX / 4); });
    dots(c, rnd, 26, '#b8a58e', 5); dots(c, rnd, 60, '#5f3f24', 2);
  });
  const grass = texture((c, rnd) => {
    c.fillStyle = '#62b84a'; c.fillRect(0, 0, TEX, TEX);
    c.strokeStyle = '#86d05e'; c.lineWidth = 2;
    for (let i = 0; i < 90; i++) { const x = rnd() * TEX, y = rnd() * TEX; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y - 9); c.stroke(); }
  });
  const snow = texture((c, rnd) => { c.fillStyle = '#f7fbff'; c.fillRect(0, 0, TEX, TEX); dots(c, rnd, 70, '#dde9f6', 4); });
  const ice = texture((c, rnd) => {
    c.fillStyle = '#b6e2f5'; c.fillRect(0, 0, TEX, TEX);
    c.strokeStyle = '#eafaff'; c.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const y = rnd() * TEX; c.beginPath(); c.moveTo(0, y); c.lineTo(TEX, y - 40 + rnd() * 80); c.stroke(); }
  });
  const wood = texture((c, rnd) => {
    c.fillStyle = '#b07a44'; c.fillRect(0, 0, TEX, TEX);
    c.strokeStyle = '#94612f'; c.lineWidth = 2;
    for (let y = 6; y < TEX; y += 11) { c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(TEX / 3, y + 4 * rnd(), TEX * 2 / 3, y - 4 * rnd(), TEX, y); c.stroke(); }
    c.fillStyle = '#6b4425'; for (let x = 0; x < TEX; x += 64) c.fillRect(x, 0, 4, TEX); // plank seams
    c.fillStyle = '#4a4a52'; // nail heads
    for (let x = 10; x < TEX; x += 64) for (const y of [20, TEX - 20]) { c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); }
  });
  const water = texture((c, rnd) => {
    c.fillStyle = '#4096e1'; c.fillRect(0, 0, TEX, TEX);
    c.strokeStyle = '#9fd4ff'; c.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const x = rnd() * TEX, y = rnd() * TEX; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 12, y - 5, x + 24, y); c.stroke(); }
  });
  const m = (map: THREE.Texture, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    shared(new THREE.MeshStandardMaterial({ map, roughness, metalness: 0, ...extra }));
  return {
    [GroundPart.Soil]: m(soil, 0.95), [GroundPart.Grass]: m(grass, 0.9), [GroundPart.Snow]: m(snow, 0.8),
    [GroundPart.Ice]: m(ice, 0.15, { metalness: 0.1 }), [GroundPart.Wood]: m(wood, 0.8),
    [GroundPart.Water]: m(water, 0.2, { transparent: true, opacity: 0.75, depthWrite: false }),
  };
}

// --- scenery behind the field: far hills, near hills with trees and props, clouds; each map's own ---
const hillTop = (x: number, base: number, amp: number, freq: number) => base - amp * (0.5 + 0.5 * Math.sin(x * freq) * Math.cos(x * freq * 0.37));
function band(top: (x: number) => number, color: string, z: number) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(-EDGE_REACH, -800)];
  for (let x = -EDGE_REACH; x <= WORLD_W + EDGE_REACH; x += 20) pts.push(new THREE.Vector2(x, y3(top(x))));
  pts.push(new THREE.Vector2(WORLD_W + EDGE_REACH, -800));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  m.position.z = z; m.receiveShadow = true;
  return m;
}
function scenery(map: PlayableMap) {
  const s = SCENES[map], g = new THREE.Group(), near = (x: number) => hillTop(x, 540, 90, 0.007);
  if (s.extra === 'peaks') {
    const peak = (x: number) => { const p = ((x % 480) + 480) % 480, d = Math.abs(p - 240) / 240; return 260 + 210 * d; };
    g.add(band(peak, s.far, FAR_LAYER_Z));
    const caps = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
    for (let x = -EDGE_REACH + 240; x < WORLD_W + EDGE_REACH; x += 480) {
      const cap = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-45, -42), new THREE.Vector2(0, 0), new THREE.Vector2(45, -42)])), caps);
      cap.position.set(x, y3(260), FAR_LAYER_Z + 1); g.add(cap);
    }
  } else g.add(band(x => hillTop(x, 460, 140, 0.004), s.far, FAR_LAYER_Z));
  g.add(band(near, s.near, NEAR_LAYER_Z));
  if (s.extra === 'lake') {
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W + 2 * EDGE_REACH, 30), new THREE.MeshStandardMaterial({ color: '#78bef0', roughness: 0.2 }));
    lake.position.set(WORLD_W / 2, y3(535), NEAR_LAYER_Z - 20); g.add(lake);
  }
  const pine = s.extra === 'forest' || s.extra === 'peaks', leaf = new THREE.MeshStandardMaterial({ color: pine ? '#5c7a3e' : '#4f9a3a', roughness: 0.9 });
  const trunk = new THREE.MeshStandardMaterial({ color: '#7a5432', roughness: 0.9 });
  for (let x = -1500; x < WORLD_W + 1500; x += 90 + (Math.abs(x * 7) % 40)) {
    const tree = new THREE.Group(), stem = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 14, 6), trunk); stem.position.y = 7; tree.add(stem);
    const crown = pine ? new THREE.Mesh(new THREE.ConeGeometry(14, 44, 8), leaf) : new THREE.Mesh(new THREE.SphereGeometry(16, 10, 8), leaf);
    crown.position.y = pine ? 34 : 26; crown.castShadow = true; tree.add(crown);
    if (s.extra === 'peaks') { const cap = new THREE.Mesh(new THREE.ConeGeometry(7, 14, 8), new THREE.MeshStandardMaterial({ color: '#ffffff' })); cap.position.y = 50; tree.add(cap); }
    tree.position.set(x, y3(near(x)) - 4, NEAR_LAYER_Z + 10); g.add(tree);
  }
  for (const { x, model } of propModels(map)) { model.position.set(x, y3(near(x)) - 3, NEAR_LAYER_Z + 18); g.add(model); }
  const cloud = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
  for (const [x, y, r] of [[220, 120, 34], [640, 80, 28], [1080, 140, 38], [1420, 70, 26], [-500, 100, 30], [2100, 110, 32]]) {
    const c = new THREE.Group();
    for (const [dx, dy, k] of [[0, 0, 1], [r, -6, 0.8], [-r, -8, 0.7]]) { const p = new THREE.Mesh(new THREE.SphereGeometry(r * k, 12, 8), cloud); p.position.set(dx, dy, 0); c.add(p); }
    c.position.set(x, y3(y) + 120, FAR_LAYER_Z - 300); c.scale.setScalar(1.6); g.add(c);
  }
  return g;
}
function skyTexture(s: Look) {
  const cv = document.createElement('canvas'); cv.width = 2; cv.height = 256;
  const c = cv.getContext('2d')!, grad = c.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, s.skyTop); grad.addColorStop(1, s.skyBottom); c.fillStyle = grad; c.fillRect(0, 0, 2, 256);
  return new THREE.CanvasTexture(cv);
}

/** The scene for one canvas, with a flat layer (`labels`) over it. */
export function createScene(canvas: HTMLCanvasElement, labels: HTMLCanvasElement) {
  const touch = navigator.maxTouchPoints > 0;
  // no antialiasing: it costs too much on slower GPUs, and high-density screens hide the edges anyway (research R10)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  let ratio = Math.min(devicePixelRatio, touch ? 1.5 : 2); // tablets: trade a little sharpness for frame rate
  renderer.setPixelRatio(ratio);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 10, 9000);
  scene.fog = new THREE.Fog('#ffffff', 2000, 4000);
  scene.add(new THREE.HemisphereLight('#ffffff', '#6b5a44', 0.65));
  const sun = new THREE.DirectionalLight('#ffffff', 0.9);
  sun.position.set(WORLD_W / 2 - 500, WORLD_H + 700, 600); sun.target.position.set(WORLD_W / 2, 300, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { left: -1100, right: 1100, top: 900, bottom: -900, near: 100, far: 3000 });
  scene.add(sun, sun.target);
  const ground = groundMaterials(), world = new THREE.Group(); scene.add(world);
  const ctx = labels.getContext('2d')!;
  let lowDetail = false, probeT = 0, probeFrames = 0, probing = false, drewLast = false;

  // --- the battle shown: rebuilt when it is a different one ---
  type Shown = {
    b: Battle; original: Uint8Array; seen: Uint8Array; chunks: (THREE.Group | null)[]; dirty: Set<number>; edges: THREE.Group;
    tanks: Map<number, THREE.Group>; crates: Map<number, THREE.Group>; shell: THREE.Object3D | null; shellKind: boolean | null;
    shadow: THREE.Mesh; trail: THREE.Line; boom: THREE.Group; bits: { m: THREE.Mesh; v: THREE.Vector3; t: number }[]; scenery: THREE.Group;
  };
  let shown: Shown | null = null;
  const cheers: { id: number; at: number }[] = [];
  /** Frees an object's geometries and its own materials (shared ones stay for the next battle). */
  const dispose = (o: THREE.Object3D) => o.traverse(x => {
    if (!(x instanceof THREE.Mesh || x instanceof THREE.Line)) return;
    x.geometry.dispose();
    for (const m of [x.material].flat() as THREE.Material[]) if (!m.userData.shared) m.dispose();
  });

  function show(b: Battle) {
    if (shown?.b === b) return shown;
    if (shown) { dispose(world); world.clear(); }
    cheers.length = 0;
    const map = b.terrain.map, s = SCENES[map];
    (scene.background as THREE.Texture | null)?.dispose();
    scene.background = skyTexture(s); (scene.fog as THREE.Fog).color.set(s.skyBottom);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(9, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.visible = false;
    const trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
    const boom = new THREE.Group();
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: '#ffaa28', emissive: '#ff8a00', emissiveIntensity: 1.2, transparent: true }));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 10), new THREE.MeshBasicMaterial({ color: '#fff078', transparent: true }));
    boom.add(flash, core);
    for (let i = 0; i < 8; i++) boom.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshStandardMaterial({ color: '#504646', transparent: true, roughness: 1 })));
    const sc = scenery(map);
    shown = { b, original: b.terrain.cells.slice(), seen: b.terrain.cells.slice(), chunks: Array(CHUNKS).fill(null), dirty: new Set(Array.from({ length: CHUNKS }, (_, i) => i)),
      edges: new THREE.Group(), tanks: new Map(), crates: new Map(), shell: null, shellKind: null, shadow, trail, boom, bits: [], scenery: sc };
    world.add(sc, shown.edges, shadow, trail, boom);
    return shown;
  }

  /** The ground changed: rebuild the chunks these blasts reach (all of it if none are given); wood that broke splinters. */
  function groundChanged(t: Terrain, blasts?: [number, number, number][]) {
    if (!shown || shown.b.terrain !== t) return;
    if (!blasts) for (let i = 0; i < CHUNKS; i++) shown.dirty.add(i);
    else for (const [x, , r] of blasts) for (const c of dirtyChunks(x, r)) shown.dirty.add(c);
    let n = 0; // splinters where wood was and isn't any more
    for (let i = 0; i < t.cells.length && n < SPLINTERS * (lowDetail ? 0.5 : 1); i++) {
      if (shown.seen[i] !== Material.Wood || t.cells[i] !== Material.Air || (i * 7) % 5) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 3), ground[GroundPart.Wood]);
      m.position.set((i % GRID_W + 0.5) * CELL, y3((Math.floor(i / GRID_W) + 0.5) * CELL), GROUND_DEPTH / 2 + 2);
      world.add(m); shown.bits.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 220, 120 + Math.random() * 160, (Math.random() - 0.5) * 60), t: 0 }); n++;
    }
    shown.seen.set(t.cells);
  }

  function rebuildGround(s: Shown) {
    for (const i of s.dirty) {
      const old = s.chunks[i];
      if (old) { dispose(old); world.remove(old); }
      const g = new THREE.Group(), mesh = chunkMesh(s.b.terrain.cells, s.original, i);
      for (const [part, data] of Object.entries(mesh) as [GroundPart, NonNullable<(typeof mesh)[GroundPart]>][]) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
        const m = new THREE.Mesh(geo, ground[part]); m.receiveShadow = true; m.castShadow = part !== GroundPart.Water; g.add(m);
      }
      s.chunks[i] = g; world.add(g);
    }
    if (s.dirty.size) edges(s);
    s.dirty.clear();
  }
  /** The ground carrying on past the field's sides (at its edges' height) and below it, so the screen is filled. */
  function edges(s: Shown) {
    dispose(s.edges); s.edges.clear();
    for (const [x0, x1, edgeX] of [[-EDGE_REACH, 0, CELL / 2], [WORLD_W, WORLD_W + EDGE_REACH, WORLD_W - CELL / 2]]) {
      const g = groundBelow(s.b.terrain, edgeX, 0), top = y3(g ? g.y : WORLD_H);
      const part = !g || g.m === Material.Earth ? GroundPart.Grass : g.m === Material.Water ? GroundPart.Water : g.m === Material.Snow ? GroundPart.Snow : GroundPart.Soil;
      const body = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, top + 600, GROUND_DEPTH), ground[GroundPart.Soil]);
      body.position.set((x0 + x1) / 2, (top - 600) / 2, 0); body.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 4, GROUND_DEPTH + 0.5), ground[part]); cap.position.set((x0 + x1) / 2, top - 2, 0);
      s.edges.add(body, cap);
    }
    const below = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W, 600, GROUND_DEPTH), ground[GroundPart.Soil]); below.position.set(WORLD_W / 2, -300, 0);
    s.edges.add(below);
  }

  function syncTanks(s: Shown) {
    const b = s.b;
    for (const t of b.tanks) {
      let m = s.tanks.get(t.id);
      if (t.gone) { if (m) { dispose(m); world.remove(m); s.tanks.delete(t.id); } continue; }
      if (!m || m.userData.key !== `${t.type}|${t.look.variant}|${t.look.color}`) {
        if (m) { dispose(m); world.remove(m); }
        m = tankModel(t.type, t.look.variant ?? Variant.B, t.look.color); m.userData.key = `${t.type}|${t.look.variant}|${t.look.color}`;
        s.tanks.set(t.id, m); world.add(m);
      }
      if (!t.alive && !m.userData.wreck) setWreck(m);
      m.position.set(t.x, y3(t.y), 0);
      setAim(m, t.angle, tiltOf(b, t), facing(t.side));
      setGear(m, { wheels: t.alive && t.gripUntil !== null && t.gripUntil >= b.round, edge: t.alive && t.shield, ring: t.alive && t.powerShell, missile: t.alive && t.missile });
    }
  }
  function syncCrates(s: Shown) {
    const ids = new Set(s.b.crates.map(c => c.id));
    for (const [id, m] of s.crates) if (!ids.has(id)) { dispose(m); world.remove(m); s.crates.delete(id); }
    for (const c of s.b.crates) {
      let m = s.crates.get(c.id);
      if (!m) { m = crateModel(); const chute = parachuteModel(); m.add(chute); s.crates.set(c.id, m); world.add(m); }
      m.position.set(c.x, y3(c.y), 0); m.getObjectByName('parachute')!.visible = c.falling;
    }
  }
  function syncShot(s: Shown) {
    const sh = s.b.shell;
    if (!sh || s.shellKind !== sh.missile) { if (s.shell) { dispose(s.shell); world.remove(s.shell); } s.shell = sh ? shellModel(sh.missile) : null; s.shellKind = sh?.missile ?? null; if (s.shell) world.add(s.shell); }
    s.shadow.visible = false;
    if (sh && s.shell) {
      s.shell.position.set(sh.x, y3(sh.y), 0);
      s.shell.rotation.z = Math.atan2(-sh.vy, sh.vx);
      const g = surfaceAt(s.b.terrain, sh.x);
      if (g && g.y > sh.y) { s.shadow.visible = true; s.shadow.position.set(sh.x, y3(g.y) + 0.6, 0); s.shadow.scale.setScalar(Math.max(0.4, 1 - (g.y - sh.y) / 600)); }
      s.trail.geometry.setFromPoints(sh.trail.map(([x, y]) => new THREE.Vector3(x, y3(y), 0)));
      s.trail.visible = true;
    } else s.trail.visible = false;
    const boom = s.b.boom;
    s.boom.visible = !!boom && boom.t < BOOM_S;
    if (boom && s.boom.visible) { // a lit fireball growing and fading, with smoke rising
      const p = Math.min(1, boom.t / 0.25), fade = 1 - boom.t / BOOM_S, [flash, core, ...smoke] = s.boom.children as THREE.Mesh[];
      s.boom.position.set(boom.x, y3(boom.y), 6);
      flash.scale.setScalar(boom.r * p); (flash.material as THREE.MeshStandardMaterial).opacity = fade;
      core.scale.setScalar(boom.r * p); (core.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - boom.t / 0.6);
      smoke.forEach((m, i) => {
        m.visible = !lowDetail || i % 2 === 0;
        m.position.set(Math.cos(i) * boom.r * 0.6, boom.t * 60 + Math.sin(i * 2) * boom.r * 0.4, Math.sin(i * 3) * 10);
        m.scale.setScalar(boom.r * (0.6 + boom.t)); (m.material as THREE.MeshStandardMaterial).opacity = 0.5 * fade;
      });
    }
  }
  function syncBits(s: Shown, dt: number) {
    s.bits = s.bits.filter(({ m, v, t }, i) => {
      s.bits[i].t = t + dt; v.y -= 400 * dt; m.position.addScaledVector(v, dt); m.rotation.z += dt * 8;
      if (t + dt < 1.4) return true;
      m.geometry.dispose(); world.remove(m); return false;
    });
  }

  let viewNow: View = { cx: WORLD_W / 2, cy: WORLD_H / 2, halfW: WORLD_W / 2 };
  const size = () => ({ w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 });
  const aspect = () => { const { w, h } = size(); return w / h; };
  function setView(v: View) {
    viewNow = v;
    const a = aspect(), halfH = v.halfW / a, fov = CAMERA_FOV * Math.PI / 180, tilt = CAMERA_TILT_DEG * Math.PI / 180;
    const d = halfH / Math.tan(fov / 2), cx = v.cx, cy = y3(v.cy);
    camera.aspect = a; camera.updateProjectionMatrix();
    camera.position.set(cx, cy + d * Math.sin(tilt), d * Math.cos(tilt)); camera.lookAt(cx, cy, 0);
    const fog = scene.fog as THREE.Fog; fog.near = d + 150; fog.far = d + 2600; // the field stays clear; layers behind it go paler
    sun.position.set(cx - 500, WORLD_H + 700, 600); sun.target.position.set(cx, 300, 0);
  }
  function resize() {
    const { w, h } = size();
    renderer.setSize(w, h, false);
    const dpr = Math.min(devicePixelRatio, 2);
    if (labels.width !== Math.round(w * dpr) || labels.height !== Math.round(h * dpr)) { labels.width = Math.round(w * dpr); labels.height = Math.round(h * dpr); }
    setView(viewNow);
  }
  /** Where field point (x, y) is on screen, in CSS pixels. */
  function project(x: number, y: number) {
    const v = new THREE.Vector3(x, y3(y), 0).project(camera), { w, h } = size();
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h };
  }

  // names, health bars, the active tank's arrow and rising repair hearts, in screen pixels (007 FR-019, FR-023)
  function drawLabels(b: Battle, time: number) {
    const { w, h } = size(), dpr = labels.width / w;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const active = activeTank(b), aiming = b.phase !== Phase.Over && active.alive, k = Math.min(1.3, Math.max(0.7, WORLD_W / 2 / viewNow.halfW));
    for (const t of b.tanks) {
      if (t.gone || !t.alive) continue;
      const p = project(t.x, t.y - TANK_H), bw = 44 * k, bh = 6, by = p.y - 16 * k, frac = Math.max(0, t.hearts) / specOf(t.look).hearts;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(p.x - bw / 2 - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = t.look.color; ctx.fillRect(p.x - bw / 2, by, bw * frac, bh);
      ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(t.look.name, p.x, by - 5); ctx.fillStyle = '#ffffff'; ctx.fillText(t.look.name, p.x, by - 5);
      if (t !== active || !aiming) continue;
      const ay = by - 30 + Math.sin(time * 6) * 4;
      ctx.fillStyle = '#ffeb3b'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x - 9, ay); ctx.lineTo(p.x + 9, ay); ctx.lineTo(p.x, ay + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    for (let i = cheers.length - 1; i >= 0; i--) {
      const c = cheers[i], age = (time - c.at) / CHEER_S, t = b.tanks[c.id];
      if (age >= 1 || !t) { cheers.splice(i, 1); continue; }
      const p = project(t.x, t.y - TANK_H), s = 10 + age * 4, x = p.x, y = p.y - 30 - age * 60;
      ctx.globalAlpha = 1 - age; ctx.fillStyle = '#ff4d6d'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
      ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4);
      ctx.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (b.shell) { // a shell above the top of the screen: a marker at the top edge
      const p = project(b.shell.x, b.shell.y);
      if (p.y < 0) { ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.moveTo(p.x, 4); ctx.lineTo(p.x - 8, 18); ctx.lineTo(p.x + 8, 18); ctx.fill(); }
    }
  }

  // the garage preview: one tank in a little scene of its own, rendered here and copied to the preview's 2D canvas
  const preview = new THREE.Scene(), previewCam = new THREE.PerspectiveCamera(30, 240 / 110, 10, 1000);
  preview.add(new THREE.HemisphereLight('#ffffff', '#6b5a44', 0.8));
  const pSun = new THREE.DirectionalLight('#ffffff', 0.8); pSun.position.set(-60, 120, 140); preview.add(pSun);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(400, 10, 60), ground[GroundPart.Grass]); strip.position.y = -5; preview.add(strip);
  previewCam.position.set(0, 26, 150); previewCam.lookAt(0, 14, 0);
  preview.background = skyTexture(SCENES[MapId.GreenHills]);
  let previewTank: THREE.Group | null = null, previewKey = '';
  function drawPreview(look: Pick<TankLook, 'type' | 'variant' | 'color'>, out: CanvasRenderingContext2D) {
    const key = `${look.type}|${look.variant}|${look.color}`, { width: pw, height: ph } = out.canvas;
    if (key !== previewKey) {
      if (previewTank) { dispose(previewTank); preview.remove(previewTank); }
      previewTank = tankModel(look.type, look.variant ?? Variant.B, look.color); setAim(previewTank, 35, 0, 1); preview.add(previewTank); previewKey = key;
    }
    const { w, h } = size(), r = renderer.getPixelRatio(), vw = Math.min(pw, w), vh = Math.min(ph, h);
    renderer.setScissorTest(true); renderer.setViewport(0, 0, vw, vh); renderer.setScissor(0, 0, vw, vh);
    renderer.render(preview, previewCam);
    out.clearRect(0, 0, pw, ph);
    out.drawImage(canvas, 0, canvas.height - vh * r, vw * r, vh * r, 0, 0, pw, ph); // before the next render, while the frame is there
    renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h);
    lastKey = ''; // the preview drew over part of the picture
  }

  // the 3D picture is redrawn only when something in it moved (the flat labels are redrawn every frame): idle turns
  // cost almost nothing, on battery and in tests that fast-forward
  let lastKey = '';
  const r1 = (v: number) => Math.round(v * 10) / 10;
  function pictureKey(s: Shown) {
    const b = s.b, v = viewNow, parts: (number | string | boolean)[] = [r1(v.cx), r1(v.cy), r1(v.halfW), canvas.width, canvas.height, s.bits.length];
    for (const t of b.tanks) parts.push(r1(t.x), r1(t.y), r1(t.angle), t.alive, t.gone, t.shield, t.powerShell, t.missile, t.gripUntil ?? -1, t.look.color, t.type, t.look.variant ?? '');
    for (const c of b.crates) parts.push(c.id, r1(c.x), r1(c.y), c.falling);
    if (b.shell) parts.push(r1(b.shell.x), r1(b.shell.y));
    if (b.boom && b.boom.t < BOOM_S) parts.push(r1(b.boom.t)); // (a blast's clock runs on after it has gone)
    return parts.join(',');
  }
  /** Draws the battle with the view as it is now; `dt` steps splinters and measures the frame rate (FR-013). */
  function render(b: Battle, time: number, dt: number) {
    const s = show(b), changed = s.dirty.size > 0;
    rebuildGround(s); syncTanks(s); syncCrates(s); syncShot(s); syncBits(s, dt);
    const key = pictureKey(s);
    const drew = changed || key !== lastKey;
    if (drew) { renderer.render(scene, camera); lastKey = s.bits.length ? '' : key; } // flying splinters: every frame
    drawLabels(b, time);
    // the frame rate is measured over frames that redrew one after another (idle frames are cheap: they'd hide a slow GPU)
    if (probing && drew && drewLast) {
      probeT += dt; probeFrames++;
      if (probeT >= DETAIL_PROBE_S) { probing = false; if (probeFrames / probeT < LOW_DETAIL_FPS) lowerDetail(); }
    }
    drewLast = drew;
  }
  function lowerDetail() {
    lastKey = '';
    lowDetail = true; ratio = LOW_DETAIL_RATIO; renderer.setPixelRatio(ratio); renderer.shadowMap.enabled = false;
    scene.traverse(o => { if (o instanceof THREE.Mesh) o.material.needsUpdate = true; });
    resize();
  }

  return {
    render, setView, resize, project, drawPreview, groundChanged,
    /** Starts showing a battle now, so its starting ground is remembered before anything is carved into it (a rejoin
     *  carves the blasts so far straight away). */
    prepare: (b: Battle) => { show(b); },
    /** A heart rises from tank `id` (a repair kit picked up). */
    cheer: (id: number, time: number) => cheers.push({ id, at: time }),
    /** A battle started: measure the frame rate for a moment, then lower the detail if it is slow. */
    probe: () => { probing = !lowDetail; probeT = 0; probeFrames = 0; },
    /** 'probing' while the frame rate is being measured, then 'low' or 'full'. */
    get detail() { return probing ? 'probing' : lowDetail ? 'low' : 'full'; },
    dispose: () => { dispose(scene); dispose(preview); renderer.dispose(); },
  };
}
