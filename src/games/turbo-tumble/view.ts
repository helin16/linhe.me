// What Turbo Tumble draws around the race (specs/010-turbo-3d-look): textures made by the game, the sun and its soft
// shadows (or Neon's night lights), layered scenery, sky, clouds or stars, start-line props, one moving effect per
// track and drift puffs, and low detail. Runs only in a browser (WebGL, canvases), so it is covered by the end-to-end
// tests (constitution VII).
import * as THREE from 'three';
import { texture } from '../../shared/render.ts';
import { Effect, GroundKind, LayerKind, LightKind, PuffKind, RoadKind } from './enums.ts';
import type { TrackLook } from './look.ts';

const TEX = 256;              // texture size in pixels
export const TEX_METRES = 18; // one texture tile covers this many metres (the road's width)
export const FOG_NEAR = 120, FOG_FAR = 1100; // far scenery fades into the sky's colour
export const HELMET_TOP = 2.3; // a driver's helmet top, above the road: data-shadow is where its shadow falls
const SHADOW_ALPHA = 0.6;     // how dark a shadow's middle is
const PUFFS = 96;             // drift puffs alive at once, at most
const PUFF_S = 0.6;           // a puff lasts this long
const RING_DEPTH = 90;        // how deep each scenery ring is (metres)
const STARS = 500, CLOUDS = 14;
const SKY_RADIUS = 1800;      // the sky dome, inside the cameras' reach
export const RENDER_SKY = -3, RENDER_WORLD = -2, RENDER_EFFECT = -1; // sky, then the world, the moving effect, then karts

// --- textures: light detail that the track's own colours tint (vertex colours or material colour) ---
const grain = (c: CanvasRenderingContext2D, rnd: () => number, n: number, light: number, spread: number, r: number) => {
  for (let i = 0; i < n; i++) {
    const v = Math.round(light + (rnd() - 0.5) * spread);
    c.fillStyle = `rgb(${v},${v},${v})`; c.beginPath(); c.arc(rnd() * TEX, rnd() * TEX, r * (0.4 + rnd()), 0, Math.PI * 2); c.fill();
  }
};
const fill = (c: CanvasRenderingContext2D, color: string) => { c.fillStyle = color; c.fillRect(0, 0, TEX, TEX); };
const ripples = (c: CanvasRenderingContext2D, rnd: () => number, color: string, n: number) => {
  c.strokeStyle = color; c.lineWidth = 3;
  for (let i = 0; i < n; i++) {
    const y0 = (i + rnd() * 0.5) * TEX / n, a = 3 + rnd() * 4, k = (2 * Math.PI / TEX) * (1 + Math.floor(rnd() * 2));
    c.beginPath(); for (let x = 0; x <= TEX; x += 8) c.lineTo(x, y0 + Math.sin(x * k) * a); c.stroke();
  }
};
const grid = (c: CanvasRenderingContext2D, colors: string[], step: number, width: number) => {
  c.lineWidth = width;
  for (let i = 0; i < TEX; i += step) {
    c.strokeStyle = colors[(i / step) % colors.length];
    c.beginPath(); c.moveTo(i + width / 2, 0); c.lineTo(i + width / 2, TEX); c.moveTo(0, i + width / 2); c.lineTo(TEX, i + width / 2); c.stroke();
  }
};
const ROADS: Record<RoadKind, (c: CanvasRenderingContext2D, rnd: () => number) => void> = {
  [RoadKind.Tarmac]: (c, rnd) => { fill(c, '#e2e2e2'); grain(c, rnd, 2600, 225, 60, 1.6); },
  [RoadKind.Sand]: (c, rnd) => { fill(c, '#e4e4e4'); grain(c, rnd, 1800, 228, 80, 2.2); ripples(c, rnd, 'rgba(0,0,0,0.22)', 9); },
  [RoadKind.Neon]: (c, rnd) => { fill(c, '#8a8aa4'); grain(c, rnd, 2400, 138, 110, 2); grid(c, ['#ffffff'], 32, 3); },
};
const GROUNDS: Record<GroundKind, (c: CanvasRenderingContext2D, rnd: () => number) => void> = {
  [GroundKind.Grass]: (c, rnd) => {
    fill(c, '#e4ecdc');
    for (let i = 0; i < 1400; i++) { // little blades
      const x = rnd() * TEX, y = rnd() * TEX, v = Math.round(190 + rnd() * 65);
      c.strokeStyle = `rgb(${v - 20},${v},${v - 30})`; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 4, y - 4 - rnd() * 5); c.stroke();
    }
  },
  [GroundKind.Sand]: (c, rnd) => { fill(c, '#efefef'); grain(c, rnd, 1200, 232, 46, 1.6); ripples(c, rnd, 'rgba(0,0,0,0.12)', 12); },
  [GroundKind.Snow]: (c, rnd) => { fill(c, '#ffffff'); grain(c, rnd, 500, 236, 30, 3); grain(c, rnd, 160, 255, 0, 1); },
  [GroundKind.Grid]: c => { fill(c, '#000000'); grid(c, ['#00ffff', '#ff00cc'], 32, 3); },
};
/** The track's road and ground textures (FR-003). The Neon grid is a glow map: it lights itself. */
export function trackTextures(look: TrackLook, sharp: boolean) {
  const t = { road: texture(TEX, ROADS[look.road]), ground: texture(TEX, GROUNDS[look.ground]) };
  if (!sharp) t.road.anisotropy = t.ground.anisotropy = 1; // filtering at grazing angles is costly without a graphics chip
  return t;
}

// --- particles: one draw call for many soft dots, each with its own size, alpha and colour ---
function particles(n: number, additive: boolean) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('alpha', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('tint', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { scale: { value: 400 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 tint; uniform float scale; varying float vA; varying vec3 vC;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = min(size * scale / -mv.z, 24.0); vA = alpha; vC = tint; }`,
    fragmentShader: `varying float vA; varying vec3 vC;
      void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5 || vA <= 0.0) discard;
        gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.15, d)); }`,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, transparent: !additive,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false;
  const attr = (name: string) => g.getAttribute(name) as THREE.BufferAttribute;
  return { points: p, pos: attr('position'), size: attr('size'), alpha: attr('alpha'), tint: attr('tint'), material: m };
}
type Particles = ReturnType<typeof particles>;
const touched = (...a: THREE.BufferAttribute[]) => a.forEach(x => { x.needsUpdate = true; });

// --- the moving effect around the camera (FR-006a). Additive and drawn before the karts without writing depth, so a
// kart or item drawn after it always covers it ---
const EFFECTS: Record<Exclude<Effect, typeof Effect.Birds>, { n: number; box: [number, number, number]; size: number; tints: number[] }> = {
  [Effect.Snow]: { n: 320, box: [120, 40, 120], size: 0.45, tints: [0xffffff] },
  [Effect.Dust]: { n: 160, box: [120, 8, 120], size: 0.7, tints: [0x8a6a40, 0x9a7a4a] },
  [Effect.Pulse]: { n: 70, box: [140, 20, 140], size: 1.6, tints: [0xff00cc, 0x00ffff, 0xffee00] },
};
function movingEffect(kind: Effect) {
  const rnd = mulberry(kind.length), group = new THREE.Group(); group.renderOrder = RENDER_EFFECT;
  let t = 0;
  if (kind === Effect.Birds) { // a few birds circling high above, wings flapping
    const mat = new THREE.MeshBasicMaterial({ color: 0x2b2f3a, side: THREE.DoubleSide }), wing = new THREE.PlaneGeometry(1.4, 0.4).translate(0.7, 0, 0);
    const birds = Array.from({ length: 7 }, () => {
      const b = new THREE.Group(), l = new THREE.Mesh(wing, mat), r = new THREE.Mesh(wing, mat);
      r.scale.x = -1; b.add(l, r); group.add(b);
      return { b, l, r, a: rnd() * 6.3, rad: 20 + rnd() * 30, y: 30 + rnd() * 18, speed: 0.25 + rnd() * 0.2, phase: rnd() * 6.3 };
    });
    const centres: THREE.Vector3[] = []; // where the birds circle, for each view (a little ahead of its camera)
    let last = 0;
    return {
      group, kind,
      step(dt: number) {
        t += dt; last = dt;
        for (const x of birds) {
          x.a += x.speed * dt; x.b.rotation.y = -x.a;
          const flap = Math.sin(t * 9 + x.phase) * 0.6; x.l.rotation.z = flap; x.r.rotation.z = -flap;
        }
      },
      around(cam: THREE.Camera, n: number) {
        const ahead = new THREE.Vector3(0, 0, -60).applyQuaternion(cam.quaternion).add(cam.position);
        const c = centres[n] = centres[n] ? centres[n].lerp(ahead, Math.min(1, last * 0.5)) : ahead;
        for (const x of birds) x.b.position.set(c.x + Math.cos(x.a) * x.rad, x.y, c.z + Math.sin(x.a) * x.rad);
      },
      scale() { /* meshes, not particles */ },
      dispose() { mat.dispose(); wing.dispose(); },
    };
  }
  const e = EFFECTS[kind], p = particles(e.n, true), [bx, by, bz] = e.box, c = new THREE.Color();
  for (let i = 0; i < e.n; i++) {
    p.pos.setXYZ(i, (rnd() - 0.5) * bx, rnd() * by, (rnd() - 0.5) * bz);
    p.size.setX(i, e.size * (0.6 + rnd() * 0.8)); p.alpha.setX(i, kind === Effect.Dust ? 0.5 : 0.85);
    c.set(e.tints[i % e.tints.length]); p.tint.setXYZ(i, c.r, c.g, c.b);
  }
  p.points.renderOrder = RENDER_EFFECT; group.add(p.points);
  const phase = Float32Array.from({ length: e.n }, () => rnd() * 6.3);
  const wrap = (v: number, centre: number, size: number) => centre + ((((v - centre) % size) + size * 1.5) % size) - size / 2;
  return {
    group, kind,
    step(dt: number) { // moves every particle once a frame
      t += dt;
      for (let i = 0; i < e.n; i++) {
        let x = p.pos.getX(i), y = p.pos.getY(i), z = p.pos.getZ(i);
        if (kind === Effect.Snow) { y -= dt * (2.5 + (i % 3)); x += Math.sin(t + phase[i]) * dt; if (y < 0) y += by; }
        if (kind === Effect.Dust) { x += dt * 5; z += Math.sin(t * 0.7 + phase[i]) * dt * 2; y = 0.5 + (Math.sin(t + phase[i]) * 0.5 + 0.5) * by; }
        if (kind === Effect.Pulse) { y = 4 + (phase[i] / 6.3) * by + Math.sin(t * 0.8 + phase[i]) * 2; p.alpha.setX(i, 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.2 + phase[i]))); }
        p.pos.setXYZ(i, x, y, z);
      }
      touched(p.alpha);
    },
    around(cam: THREE.Camera) { // the field wraps around the camera about to draw, so each view has it all around
      const cx = cam.position.x, cz = cam.position.z;
      for (let i = 0; i < e.n; i++) p.pos.setXYZ(i, wrap(p.pos.getX(i), cx, bx), p.pos.getY(i), wrap(p.pos.getZ(i), cz, bz));
      touched(p.pos);
    },
    scale(v: number) { p.material.uniforms.scale.value = v; },
    dispose() { p.points.geometry.dispose(); p.material.dispose(); },
  };
}

// --- drift puffs behind the wheels (FR-002a) ---
const PUFF_TINTS: Record<PuffKind, number[]> = {
  [PuffKind.Dust]: [0xb9a88a, 0xcdbfa4],
  [PuffKind.Sand]: [0xe2b878, 0xd6a560],
  [PuffKind.Snow]: [0xffffff, 0xe8f1ff],
  [PuffKind.Glint]: [0xff00cc, 0x00ffff, 0xffee00],
};
function puffs(kind: PuffKind) {
  const p = particles(PUFFS, kind === PuffKind.Glint), tints = PUFF_TINTS[kind], c = new THREE.Color();
  const life = new Float32Array(PUFFS), vel = new Float32Array(PUFFS * 3);
  let next = 0, live = 0;
  return {
    points: p.points,
    get live() { return live; },
    emit(at: THREE.Vector3) {
      const i = next; next = (next + 1) % PUFFS;
      life[i] = PUFF_S; p.pos.setXYZ(i, at.x, at.y, at.z);
      vel[i * 3] = (Math.random() - 0.5) * 2; vel[i * 3 + 1] = 0.8 + Math.random(); vel[i * 3 + 2] = (Math.random() - 0.5) * 2;
      c.set(tints[i % tints.length]); p.tint.setXYZ(i, c.r, c.g, c.b);
    },
    update(dt: number, scale: number) {
      p.material.uniforms.scale.value = scale; live = 0;
      for (let i = 0; i < PUFFS; i++) {
        if (life[i] <= 0) { p.alpha.setX(i, 0); continue; }
        life[i] -= dt; live++;
        const f = Math.max(0, life[i] / PUFF_S);
        p.pos.setXYZ(i, p.pos.getX(i) + vel[i * 3] * dt, p.pos.getY(i) + vel[i * 3 + 1] * dt, p.pos.getZ(i) + vel[i * 3 + 2] * dt);
        p.size.setX(i, 0.6 + (1 - f) * 1.4); p.alpha.setX(i, f * (kind === PuffKind.Glint ? 1 : 0.7));
      }
      touched(p.pos, p.size, p.alpha, p.tint);
    },
    dispose() { p.points.geometry.dispose(); p.material.dispose(); },
  };
}

/** A black and white chequered texture, 8 squares across, repeated `x` × `y` times (start line, arch banner). */
export function chequers(x: number, y: number) {
  const t = texture(64, c => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : '#111'; c.fillRect(i * 8, j * 8, 8, 8); } });
  t.magFilter = THREE.NearestFilter; t.repeat.set(x, y);
  return t;
}

/** One geometry holding `geo` at each of `at` (optionally tinted per copy): one draw call, and no instancing, which
 *  software renderers draw slowly. */
export function bake(geo: THREE.BufferGeometry, at: THREE.Matrix4[], tints?: THREE.Color[]) {
  const src = geo.index ? geo.toNonIndexed() : geo, n = src.getAttribute('position').count, out = new THREE.BufferGeometry();
  const names = ['position', 'normal', 'uv'].filter(a => src.getAttribute(a)), data: Record<string, number[]> = { color: [] };
  for (const a of names) data[a] = [];
  const normal = new THREE.Matrix3(), v = new THREE.Vector3();
  at.forEach((m, k) => {
    normal.getNormalMatrix(m);
    for (let i = 0; i < n; i++) {
      const p = src.getAttribute('position') as THREE.BufferAttribute;
      v.fromBufferAttribute(p, i).applyMatrix4(m); data.position.push(v.x, v.y, v.z);
      if (data.normal) { v.fromBufferAttribute(src.getAttribute('normal') as THREE.BufferAttribute, i).applyMatrix3(normal).normalize(); data.normal.push(v.x, v.y, v.z); }
      if (data.uv) { const uv = src.getAttribute('uv'); data.uv.push(uv.getX(i), uv.getY(i)); }
      if (tints) data.color.push(tints[k].r, tints[k].g, tints[k].b);
    }
  });
  for (const a of names) out.setAttribute(a, new THREE.Float32BufferAttribute(data[a], a === 'uv' ? 2 : 3));
  if (tints) out.setAttribute('color', new THREE.Float32BufferAttribute(data.color, 3));
  if (src !== geo) src.dispose();
  return out;
}

/** A small seeded random source (scenery and effects look the same every visit). */
function mulberry(seed: number) {
  let a = seed * 9973 + 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Where the track is: its start, which way the start faces and its left, the barrier offset, and its middle and size. */
export type Place = { start: THREE.Vector3; heading: number; left: THREE.Vector3; wall: number; centre: THREE.Vector3; radius: number };

/** Everything around the race for one scene. */
export function createView(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556644, 0.8);
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  scene.add(hemi, sun, sun.target);
  const toSun = new THREE.Vector3(0, 1, 0);
  // shadows are soft dark shapes on the ground, offset away from the sun (research R5: shadow maps halve a software
  // renderer's frame rate and add most of a second of shader compiling when they come on)
  const blobTex = texture(64, c => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(0,0,0,${SHADOW_ALPHA})`); g.addColorStop(0.55, `rgba(0,0,0,${SHADOW_ALPHA * 0.75})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.clearRect(0, 0, 64, 64); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  blobTex.wrapS = blobTex.wrapT = THREE.ClampToEdgeWrapping;
  const edgeTex = texture(64, c => { // across a barrier's foot: clear, dark under the rail, clear
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${SHADOW_ALPHA * 0.8})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.clearRect(0, 0, 64, 64); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  const shade = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const blobMat = shade(blobTex), edgeMat = shade(edgeTex), blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  let track = new THREE.Group(), lights: THREE.PointLight[] = [], effect: ReturnType<typeof movingEffect> | null = null;
  let puff: ReturnType<typeof puffs> | null = null, low = false;
  let props: THREE.Object3D[] = [], hideInLow: THREE.Object3D[] = [], layers: { dist: number; haze: number }[] = [];
  scene.add(track);

  const grainTex = texture(64, (c, r) => { fill(c, '#f0f0f0'); grain(c, r, 120, 236, 40, 2); }); // light grain to tint, shared
  const register = (o: THREE.Object3D) => { hideInLow.push(o); if (low) o.visible = false; return o; };
  const std = (color: number, opts: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...opts });
  const at = (g: THREE.Object3D, o: THREE.Object3D, x: number, y: number, z: number) => { o.position.set(x, y, z); g.add(o); return o; };
  /** A soft shadow `w` × `l` metres on the ground at (x, z) in `g`. */
  const blob = (g: THREE.Object3D, x: number, z: number, w: number, l: number) => { const b = at(g, new THREE.Mesh(blobGeo, blobMat), x, 0.04, z); b.scale.set(w, 1, l); return b; };

  /** The start arch with its chequered banner, tyre stacks and a small grandstand, beside the start line (FR-004a). */
  function startProps(look: TrackLook, p: Place, night: boolean) {
    const base = new THREE.Group(); base.position.copy(p.start); base.rotation.y = p.heading; track.add(base);
    const chequer = chequers(4, 0.5);
    const glow = (color: number) => night ? new THREE.MeshBasicMaterial({ color }) : std(color);
    const arch = new THREE.Group(), post = new THREE.CylinderGeometry(0.5, 0.6, 8, 14), postM = glow(look.props[0]);
    for (const s of [-1, 1]) { at(arch, new THREE.Mesh(post, postM), s * (p.wall + 0.8), 4, 0); if (!night) blob(arch, s * (p.wall + 0.8), 0, 2.2, 2.2); }
    at(arch, new THREE.Mesh(new THREE.BoxGeometry(2 * p.wall + 2.6, 1.6, 0.7), new THREE.MeshBasicMaterial({ map: chequer })), 0, 8, 0);
    const tyres = new THREE.Group(), tyre = new THREE.TorusGeometry(0.55, 0.3, 8, 16).rotateX(Math.PI / 2), tyreM = std(0x26262b);
    const stripe = glow(look.props[0]);
    for (const [x, z] of [[-1, -7], [-1, 7], [1, -7], [1, 7], [-1, 12], [1, 12]])
      for (let k = 0; k < 3; k++) at(tyres, new THREE.Mesh(tyre, k === 1 ? stripe : tyreM), x * (p.wall + 2.5), 0.3 + k * 0.58, z);
    if (!night) for (const [x, z] of [[-1, -7], [-1, 7], [1, -7], [1, 7], [-1, 12], [1, 12]]) blob(tyres, x * (p.wall + 2.5), z, 2.4, 2.4);
    const stand = new THREE.Group(), side = p.wall + 9, standM = std(0xe8e8ee), roofM = glow(look.props[1]);
    for (let k = 0; k < 4; k++) at(stand, new THREE.Mesh(new THREE.BoxGeometry(5 - k * 1.2, 1 + k * 1.1, 26), standM), side + k * 0.6, (1 + k * 1.1) / 2, 4);
    at(stand, new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 28), roofM), side + 1, 7.5, 4);
    for (const z of [-9, 17]) at(stand, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 7.5, 8), standM), side + 3.6, 3.75, z);
    const rnd = mulberry(3), seats: THREE.Matrix4[] = [], shirts: THREE.Color[] = [], ball = new THREE.SphereGeometry(0.35, 8, 6);
    for (let i = 0; i < 60; i++) {
      const k = i % 4; seats.push(new THREE.Matrix4().setPosition(side + k * 0.6 - (5 - k * 1.2) / 2 + 0.6, 1 + k * 1.1 + 0.35, -8 + rnd() * 24));
      shirts.push(new THREE.Color().setHSL(rnd(), 0.7, 0.55));
    }
    stand.add(new THREE.Mesh(bake(ball, seats, shirts), new THREE.MeshLambertMaterial({ vertexColors: true, map: grainTex }))); ball.dispose();
    if (!night) blob(stand, side + 1.5, 4, 9, 32);
    base.add(arch, tyres, stand);
    props = [arch, tyres, stand].map(register);
  }

  /** Rings of hills, dunes, mountains or towers around the track, paler with distance (fog), and a sky (FR-006). */
  function scenery(look: TrackLook, p: Place, horizon: THREE.Color) {
    layers = [];
    look.layers.forEach((layer, n) => {
      const r0 = p.radius + layer.dist, rnd = mulberry(n + 11), ring = new THREE.Group();
      if (layer.kind === LayerKind.Towers) {
        const count = 48 + n * 24, box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
        const windows = texture(64, (c, r) => { c.fillStyle = '#000'; c.fillRect(0, 0, 64, 64); for (let i = 0; i < 40; i++) { c.fillStyle = ['#ff00cc', '#00ffff', '#ffee00'][i % 3]; c.fillRect(Math.floor(r() * 8) * 8 + 2, Math.floor(r() * 8) * 8 + 2, 4, 3); } });
        const where: THREE.Matrix4[] = [];
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + rnd() * 0.05, rr = r0 + rnd() * RING_DEPTH, w = 8 + rnd() * 14, h = layer.height * (0.3 + rnd() * 0.7);
          where.push(new THREE.Matrix4().compose(new THREE.Vector3(p.centre.x + Math.cos(a) * rr, 0, p.centre.z + Math.sin(a) * rr), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a), new THREE.Vector3(w, h, w)));
        }
        ring.add(new THREE.Mesh(bake(box, where), std(layer.color, { emissive: 0xffffff, emissiveMap: windows, emissiveIntensity: 0.8 }))); box.dispose();
      } else { // a shaded band: up from the inner edge to a ridge, then down a little
        const segs = 160, prof = [[0, 0], [0.35, 0.8], [0.6, 1], [1, 0.45]], pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [];
        const c = new THREE.Color(layer.color), cap = new THREE.Color(0xffffff), v = new THREE.Color();
        const waves = [1, 2, 3].map(() => [2 + Math.floor(rnd() * 6), rnd() * 6.3] as const);
        const peak = (a: number) => {
          let s = 0; for (const [k, ph] of waves) s += Math.sin(a * k * (layer.kind === LayerKind.Mountains ? 3 : 1) + ph) / waves.length;
          s = s * 0.5 + 0.5;
          return layer.kind === LayerKind.Mountains ? 0.25 + 0.75 * s ** 2 : layer.kind === LayerKind.Dunes ? 0.4 + 0.6 * Math.abs(Math.sin(a * 5 + s)) : 0.45 + 0.55 * s;
        };
        for (let i = 0; i <= segs; i++) {
          const a = (i / segs) * Math.PI * 2, f = peak(a);
          for (const [d, hh] of prof) {
            const rr = r0 + d * RING_DEPTH, y = hh * f * layer.height;
            pos.push(p.centre.x + Math.cos(a) * rr, y, p.centre.z + Math.sin(a) * rr);
            v.copy(c).lerp(cap, layer.kind === LayerKind.Mountains && y > layer.height * 0.62 ? 0.85 : 0); col.push(v.r, v.g, v.b);
            uv.push(i / 4, d * 4);
          }
        }
        for (let i = 0; i < segs; i++) for (let j = 0; j < prof.length - 1; j++) {
          const a = i * prof.length + j, b = a + prof.length;
          idx.push(a, b, a + 1, a + 1, b, b + 1); // facing up and in, towards the track
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        // textured and tinted like the track's surfaces: the same shader, one program fewer to compile
        const band = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: grainTex }));
        ring.add(band);
      }
      track.add(ring);
      if (n > 0) register(ring); // low detail keeps only the nearest ring
      layers.push({ dist: Math.round(r0), haze: Math.min(1, Math.max(0, (r0 - FOG_NEAR) / (FOG_FAR - FOG_NEAR))) });
    });

    // sky: a dome fading from the top colour to the horizon (the fog's colour), with clouds or stars. Coloured per
    // vertex: a full-screen texture costs software renderers half their frame rate
    const top = new THREE.Color(look.skyTop), dome = new THREE.SphereGeometry(SKY_RADIUS, 32, 16), cols: number[] = [], v = new THREE.Color();
    const ys = dome.getAttribute('position');
    for (let i = 0; i < ys.count; i++) { const e = Math.max(0, ys.getY(i) / SKY_RADIUS); v.copy(horizon).lerp(top, Math.min(1, e * 1.6) ** 0.8); cols.push(v.r, v.g, v.b); }
    dome.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const skyMesh = new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    skyMesh.position.copy(p.centre); skyMesh.renderOrder = RENDER_SKY; track.add(skyMesh);
    register(skyMesh); // low detail: just the horizon's colour (a full-screen pass per view saved)
    scene.background = horizon;
    const rnd = mulberry(29);
    if (look.stars) {
      const g = new THREE.BufferGeometry(), pos: number[] = [];
      for (let i = 0; i < STARS; i++) { const a = rnd() * Math.PI * 2, e = 0.08 + rnd() * 1.3, r = 1400; pos.push(p.centre.x + Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, p.centre.z + Math.sin(a) * Math.cos(e) * r); }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
      track.add(stars); register(stars); // gone with the dome in low detail
    } else {
      // clouds: white on top, a little grey below, coloured per vertex like the sky dome (the same shader)
      const puff = new THREE.SphereGeometry(1, 12, 8), shade: number[] = [], ps = puff.getAttribute('position');
      for (let i = 0; i < ps.count; i++) { const v = 0.86 + 0.14 * (ps.getY(i) * 0.5 + 0.5); shade.push(v, v, v * 1.02); }
      puff.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
      const white = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
      for (let i = 0; i < CLOUDS; i++) {
        const cloud = new THREE.Group(), a = rnd() * Math.PI * 2, r = 700 + rnd() * 500;
        cloud.position.set(p.centre.x + Math.cos(a) * r, 160 + rnd() * 120, p.centre.z + Math.sin(a) * r);
        for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(puff, white); b.position.set((k - 1.5) * 22 + rnd() * 8, rnd() * 8, rnd() * 10); b.scale.set(26 + rnd() * 12, 12 + rnd() * 6, 18); cloud.add(b); }
        track.add(cloud); register(cloud); // and no clouds
      }
    }
  }

  function freeTrack() {
    track.traverse(o => {
      if (!(o instanceof THREE.Mesh || o instanceof THREE.Points)) return;
      if (o.geometry !== blobGeo) o.geometry.dispose();
      for (const m of [o.material].flat()) if (m !== blobMat) { for (const v of Object.values(m)) if (v instanceof THREE.Texture && v !== grainTex) v.dispose(); m.dispose(); }
    });
    scene.remove(track); for (const l of lights) scene.remove(l);
    effect?.dispose(); puff?.dispose();
    lights = []; props = []; hideInLow = []; effect = null; puff = null;
  }

  return {
    hemi,
    /** Builds what surrounds a track: light, scenery, sky, props, its moving effect and drift puffs. */
    setTrack(look: TrackLook, p: Place, horizon: THREE.Color, brightness: number) {
      freeTrack();
      track = new THREE.Group(); scene.add(track);
      const night = look.light === LightKind.Night;
      // the sun from the right of the start, high: at the grid, shadows fall to each kart's left, onto open road
      toSun.copy(p.left).multiplyScalar(-0.75).add(new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading)).multiplyScalar(0.25)).setY(0.7).normalize();
      sun.position.copy(p.centre).addScaledVector(toSun, 200); sun.target.position.copy(p.centre); sun.target.updateMatrixWorld();
      hemi.intensity = brightness; sun.intensity = night ? 0.35 : brightness * 1.05;
      sun.color.set(night ? 0x9a8cff : 0xfff4e0); hemi.groundColor.set(night ? 0x221133 : 0x556644);
      if (night) for (const [c, s] of [[0xff00cc, -1], [0x00ffff, 1], [0xffee00, 0]] as const) {
        const l = new THREE.PointLight(c, 1.2, 120); l.position.copy(p.start).addScaledVector(p.left, s * 20).setY(12); scene.add(l); lights.push(l);
      }
      startProps(look, p, night);
      scenery(look, p, horizon);
      effect = movingEffect(look.effect); track.add(effect.group); register(effect.group);
      puff = puffs(look.puff); track.add(puff.points); register(puff.points);
      track.traverse(o => { if (o.renderOrder === 0) o.renderOrder = RENDER_WORLD; });
      effect.group.traverse(o => { o.renderOrder = RENDER_EFFECT; });
      puff.points.renderOrder = 0;
    },
    /** How far from its foot the shadow of a point `height` above the ground falls (away from the sun). */
    shadowOffset(height: number) { return toSun.clone().multiplyScalar(-height / toSun.y).setY(0); },
    /** Where the shadow of a driver's helmet top falls, for a kart at `pos` (the test aid data-shadow). */
    shadowPoint(pos: THREE.Vector3) { return pos.clone().setY(0.05).add(this.shadowOffset(HELMET_TOP)); },
    /** A soft shadow on the ground (unit size: scale it), for karts. */
    blob: () => new THREE.Mesh(blobGeo, blobMat),
    shadowParts: [blobGeo, blobMat] as const, // shared by every soft shadow: never freed with a track
    /** Soft shadows for many things at once (trees), each `[x, z, radius, height]`, cast away from the sun. */
    blobs(where: [number, number, number, number][]) { // one mesh of many shadows (the karts' shader, not an instanced one)
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(toSun.x, toSun.z)), m = new THREE.Matrix4();
      const parts = where.map(([x, z, r, h]) => blobGeo.clone().applyMatrix4(m.compose(this.shadowOffset(h / 2).add(new THREE.Vector3(x, 0.03, z)), q, new THREE.Vector3(r * 2, 1, r * 2 + h * 0.6))));
      const pos: number[] = [], uv: number[] = [], idx: number[] = [];
      parts.forEach((g, k) => {
        pos.push(...Array.from(g.getAttribute('position').array)); uv.push(...Array.from(g.getAttribute('uv').array));
        idx.push(...Array.from(g.getIndex()!.array, i => i + k * 4)); g.dispose();
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      return new THREE.Mesh(g, blobMat);
    },
    /** The soft shadow along a barrier's foot (band() gives it its shape). */
    edge: edgeMat,
    /** Once a frame: moves the effect and ages the puffs; `scale` sizes particles for the drawing height. */
    update(dt: number, scale: number) {
      if (!low && effect) { effect.step(dt); effect.scale(scale); }
      puff?.update(dt, scale);
    },
    /** Before view `n` draws with `cam`: the moving effect gathers around it. */
    around(cam: THREE.Camera, n: number) { if (!low) effect?.around(cam, n); },
    /** A puff from behind a drifting wheel at `at` (none in low detail). */
    puff(at: THREE.Vector3) { if (!low) puff?.emit(at); },
    /** Low detail: no start-line props, moving effect, drift puffs or farthest scenery ring (FR-009). */
    lowDetail() { low = true; for (const o of hideInLow) o.visible = false; },
    // what the test aids report (contracts/ui.md)
    get props() { return props.filter(o => o.visible).length; },
    get effect() { return effect && effect.group.visible ? effect.kind : ''; },
    get puffs() { return low ? 0 : puff?.live ?? 0; },
    get layers() { return layers.map(l => `${l.dist}:${l.haze.toFixed(2)}`).join(';'); },
    dispose() { freeTrack(); scene.remove(hemi, sun, sun.target); grainTex.dispose(); blobTex.dispose(); edgeTex.dispose(); blobMat.dispose(); edgeMat.dispose(); blobGeo.dispose(); },
  };
}
export type View = ReturnType<typeof createView>;
