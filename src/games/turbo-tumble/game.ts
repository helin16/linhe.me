// Turbo Tumble, ported from the original single-page script. Gameplay, tuning and visuals are unchanged;
// the game now renders into `root` and mount() returns a cleanup that leaves the page as it found it.
import * as THREE from 'three';
import { isIn, KART_STYLES, loadSaved, MAP_NAMES, saveSettings, type KartStyle, type MapName, type PlayerLook } from './settings.ts';

type Vec = THREE.Vector3;
type StyleDef = { speed: number; turn: number; off: number; body: [number, number, number]; wheel: number; bars: [number, number, number] };
type Look = { name: string; color: number; helmet: number; skin: number; style: KartStyle };
type Item = 'turbo' | 'goo' | 'zap';
type Action = 'up' | 'down' | 'left' | 'right' | 'drift' | 'item';
type Input = { accel: number; steer: number; drift: boolean };
type Prop = [THREE.BufferGeometry, THREE.Material, number];
type MapDef = { pts: [number, number][]; sky: number; ground: number; road: number; curb: [number, number]; wall: [number, number]; light: number; glow?: boolean; prop: () => Prop[] };
// x, z, heading, speed, lap, idx, body rotation, spark, finished, finish time
type NetState = [number, number, number, number, number, number, number, number, number, number];
type Kart = Look & {
  pn: number; g: THREE.Group; m: THREE.Group; spark: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  pos: Vec; idx: number; lap: number; lat: number; speed: number; h: number; camH: number;
  boost: number; spin: number; drift: number; charge: number; item: Item | null; itemT: number;
  finished: boolean; finishTime: number; skill: number; lane: number; wrongT: number;
  net: NetState | null; netAt: number; human: boolean; remote: boolean; ai: boolean;
};
type Voice = { out: StereoPannerNode; engine: OscillatorNode; engineGain: GainNode; screechGain: GainNode };
type State = 'menu' | 'count' | 'race' | 'done';
type Net = { slot: number; peers: Set<number>; profiles: Record<number, PlayerLook>; sendT?: number };
type Msg =
  | { t: 'hello'; slot: number; peers: number[] }
  | { t: 'join' | 'leave'; slot: number }
  | { t: 'me'; from: number; p: PlayerLook }
  | { t: 'start'; map: string }
  | { t: 's'; k: [number, ...NetState][] }
  | { t: 'goo'; x: number; z: number; id: string }
  | { t: 'pop'; id: string }
  | { t: 'zap'; by: number; to: number };

const MARKUP = `
<div id="hud">
  <div class="pv"><div class="lap"></div><div class="item"></div><div class="pos"></div><div class="wrong" role="alert">WRONG WAY</div>
    <div class="tc"><div class="steer" aria-label="Steer"><span>◀</span><span>▶</span></div>
      <div class="acts"><button data-a="item" aria-label="Use item">ITEM</button><button data-a="down">BRAKE</button><button data-a="drift">DRIFT</button></div></div></div>
  <div class="pv"><div class="lap"></div><div class="item"></div><div class="pos"></div><div class="wrong" role="alert">WRONG WAY</div>
    <div class="tc"><div class="steer" aria-label="Steer"><span>◀</span><span>▶</span></div>
      <div class="acts"><button data-a="item" aria-label="Use item">ITEM</button><button data-a="down">BRAKE</button><button data-a="drift">DRIFT</button></div></div></div>
  <div id="tbar"><button id="tRestart" aria-label="Restart">⟲</button><button id="tGarage" aria-label="Garage">🏠</button><button id="tMute" aria-label="Mute">🔈</button></div>
  <div id="time"></div><div id="mute">🔇 Muted — press M</div>
  <div id="msg"></div>
  <canvas id="map" width="160" height="160"></canvas>
  <div id="help">↑↓←→ / WASD drive<br>Space (hold + steer) drift → boost<br>E use item · R restart<br>G garage · M mute</div>
</div>
<div id="menu">
  <h1>Turbo Tumble</h1>
  <div>Players<br><span id="cPlayers"></span></div>
  <div id="editRow">Customise<br><span id="cEdit"></span></div>
  <label>Name <input type="text" id="cName" maxlength="10"></label>
  <label>Kart colour <input type="color" id="cColor"></label>
  <label>Helmet <input type="color" id="cHelmet"></label>
  <div>Skin<br><span id="cSkin"></span></div>
  <div>Kart<br><span id="cStyle"></span></div>
  <div id="stats"></div>
  <div>Track<br><span id="cMap"></span></div>
  <div id="keys"></div>
  <div id="netInfo"></div>
  <button id="go">Start race</button>
</div>
<div id="end"><div id="endText"></div></div>`;
const GAME_VIEWPORT = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';

const LAPS = 3, W = 18, N = 600, MAX = 42, ACC = 30, WALL = W / 2 + 10;
// speed/turn multiply the base values; off = top-speed factor on grass; bars = garage display
const STYLES: Record<KartStyle, StyleDef> = {
  Classic: {speed: 1,    turn: 1,    off: 0.45, body: [2.2, 0.7, 3.4], wheel: 0.5,  bars: [3, 3, 2]},
  Buggy:   {speed: 0.95, turn: 1.1,  off: 0.7,  body: [2.6, 0.9, 3.0], wheel: 0.65, bars: [2, 4, 4]},
  Rocket:  {speed: 1.06, turn: 0.88, off: 0.4,  body: [1.8, 0.6, 4.0], wheel: 0.45, bars: [5, 2, 1]},
};
const SKINS = ['#ffe0bd', '#f1c27d', '#c68642', '#8d5524', '#5c3a1e', '#7fdc6a', '#9ec5ff'];
const RACERS: Look[] = [
  {name: 'Blaze', color: 0xff4444, helmet: 0xffffff, skin: 0xffe0bd, style: 'Classic'},
  {name: 'Pip',   color: 0x44aaff, helmet: 0xffee00, skin: 0x8d5524, style: 'Buggy'},
  {name: 'Mango', color: 0xffaa22, helmet: 0x22aa44, skin: 0xf1c27d, style: 'Rocket'},
  {name: 'Rook',  color: 0x9955ee, helmet: 0x222222, skin: 0xc68642, style: 'Classic'},
];
const CONTROLS: Record<Action, string>[] = [
  {up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', drift: 'Space', item: 'KeyE'},
  {up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', drift: 'ShiftRight', item: 'Enter'},
];
const ICON: Record<Item, string> = {turbo: '🚀', goo: '🟢', zap: '⚡'};
const ITEMS = Object.keys(ICON) as Item[];

export function mount(root: HTMLElement): () => void {
  const listening = new AbortController(), signal = listening.signal;
  const viewport = document.querySelector<HTMLMetaElement>('meta[name=viewport]');
  const siteViewport = viewport?.content;
  if (viewport) viewport.content = GAME_VIEWPORT;
  root.classList.add('tt');
  root.innerHTML = MARKUP;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;

  // --- saved garage settings ---
  const cfg = loadSaved();
  const save = () => saveSettings(cfg);

  // --- sound (synthesised, starts on first click). In 2P each player's sounds sit on their side of the stereo field ---
  let ac: AudioContext | undefined, master: GainNode, voices: Voice[] = [], bumpCd = 0;
  const pan = (k: Kart) => cfg.two ? (k.pn ? 0.7 : -0.7) : 0;
  function initAudio() {
    if (ac) return;
    const a = ac = new AudioContext();
    master = a.createGain(); master.gain.value = cfg.muted ? 0 : 0.6; master.connect(a.destination);
    const buf = a.createBuffer(1, a.sampleRate, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    voices = [0, 1].map(() => { // per human: engine hum + drift screech
      const out = a.createStereoPanner(); out.connect(master);
      const engine = a.createOscillator(); engine.type = 'sawtooth';
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
      const engineGain = a.createGain(); engineGain.gain.value = 0;
      engine.connect(lp).connect(engineGain).connect(out); engine.start();
      const noise = a.createBufferSource(); noise.buffer = buf; noise.loop = true;
      const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 3;
      const screechGain = a.createGain(); screechGain.gain.value = 0;
      noise.connect(bp).connect(screechGain).connect(out); noise.start();
      return {out, engine, engineGain, screechGain};
    });
  }
  type ToneOpts = { type?: OscillatorType; vol?: number; to?: number; delay?: number; pan?: number };
  function tone(f: number, dur: number, {type = 'square', vol = 0.15, to, delay = 0, pan = 0}: ToneOpts = {}) {
    if (!ac) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(), p = ac.createStereoPanner();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    p.pan.value = pan;
    o.connect(g).connect(p).connect(master); o.start(t); o.stop(t + dur);
  }
  const SFX = {
    beep: () => tone(440, 0.25),
    go: () => tone(880, 0.6),
    pickup: (pan: number) => [660, 880, 1100].forEach((f, i) => tone(f, 0.08, {delay: i * 0.06, vol: 0.1, pan})),
    boost: (pan: number) => tone(150, 0.6, {type: 'sawtooth', to: 900, vol: 0.12, pan}),
    spin: (pan: number) => tone(700, 0.7, {type: 'triangle', to: 80, vol: 0.2, pan}),
    zap: (pan: number) => tone(1500, 0.3, {type: 'sawtooth', to: 100, vol: 0.1, pan}),
    goo: (pan: number) => tone(200, 0.2, {type: 'sine', to: 60, vol: 0.25, pan}),
    lap: (pan: number) => [784, 1047].forEach((f, i) => tone(f, 0.15, {delay: i * 0.15, pan})),
    finish: (pan: number) => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, {delay: i * 0.18, vol: 0.12, pan})),
  };
  const bump = (k: Kart) => { if (bumpCd <= 0) { tone(90, 0.15, {vol: 0.15, pan: pan(k)}); bumpCd = 0.3; } };

  // --- scene ---
  const scene = new THREE.Scene();
  const sky = new THREE.Color(0x7ec8f0), fog = new THREE.Fog(0x7ec8f0, 150, 450);
  scene.background = sky;
  scene.fog = fog;
  const cams = [0, 1].map(() => new THREE.PerspectiveCamera(70, 1, 0.1, 1000));
  const renderer = new THREE.WebGLRenderer({antialias: true});
  const isTouch = navigator.maxTouchPoints > 0;
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2)); // tablets: trade a little sharpness for frame rate
  renderer.setSize(innerWidth, innerHeight);
  root.prepend(renderer.domElement);
  addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight), {signal});
  const hemi = new THREE.HemisphereLight(0xffffff, 0x447733, 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(100, 200, 50); scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({color: 0x5cb85c}));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  // --- maps: control points (scaled 1.3) + theme. prop() returns the [geometry, material, y] parts of one scenery piece ---
  const lam = (color: number) => new THREE.MeshLambertMaterial({color});
  const trunk = new THREE.CylinderGeometry(0.6, 0.8, 3, 6);
  const leafy: Prop[] = [[trunk, lam(0x8b5a2b), 1.5], [new THREE.ConeGeometry(3, 7, 7), lam(0x2e7d32), 6]];
  const cactusM = lam(0x3a8f3a), cactus: Prop[] = [
    [new THREE.CylinderGeometry(0.7, 0.8, 6, 8), cactusM, 3], [new THREE.BoxGeometry(3.4, 0.8, 0.8), cactusM, 3.2],
    [new THREE.BoxGeometry(0.8, 2.4, 0.8).translate(1.7, 0, 0), cactusM, 4.4], [new THREE.BoxGeometry(0.8, 2.4, 0.8).translate(-1.7, 0, 0), cactusM, 4.4]];
  const pine: Prop[] = [[trunk, lam(0x6b4423), 1.5], [new THREE.ConeGeometry(2.6, 8, 7), lam(0x1f5f3a), 6.5], [new THREE.ConeGeometry(1.4, 3, 7), lam(0xffffff), 9.6]];
  const neonM = [0xff00cc, 0x00ffff, 0xffee00].map(c => new THREE.MeshLambertMaterial({color: 0x1a1a33, emissive: c, emissiveIntensity: 0.35}));
  const MAPS: Record<MapName, MapDef> = {
    Meadow: {
      pts: [[0,0],[80,-10],[150,20],[180,90],[140,150],[60,140],[20,190],[-60,200],[-130,150],[-120,70],[-170,10],[-140,-60],[-60,-50]],
      sky: 0x7ec8f0, ground: 0x5cb85c, road: 0x55555f, curb: [0xdd2222, 0xffffff], wall: [0x2266dd, 0xffffff], light: 0.8,
      prop: () => leafy,
    },
    Desert: {
      pts: [[0,0],[100,0],[170,40],[170,120],[110,150],[60,110],[0,140],[-70,150],[-120,100],[-110,30],[-60,0]],
      sky: 0xf6c28b, ground: 0xe0b872, road: 0x6b5a4a, curb: [0xcc5500, 0xffeecc], wall: [0x8b4513, 0xf4a460], light: 0.9,
      prop: () => cactus,
    },
    Snow: {
      pts: [[0,0],[90,0],[140,-40],[200,-10],[190,60],[120,70],[60,100],[80,160],[20,200],[-60,170],[-50,100],[-110,60],[-90,0]],
      sky: 0xcfe3f3, ground: 0xf4f8fb, road: 0x5a6070, curb: [0x3366cc, 0xffffff], wall: [0xcc2222, 0xffffff], light: 0.8,
      prop: () => pine,
    },
    Neon: {
      pts: [[0,0],[120,0],[120,-60],[200,-60],[200,80],[100,80],[100,160],[-40,160],[-40,80],[-100,80],[-100,0]],
      sky: 0x0b0b2a, ground: 0x1a1a2e, road: 0x2a2a3a, curb: [0xff00cc, 0x00ffff], wall: [0x00ffff, 0xff00cc], light: 0.45, glow: true,
      prop: () => { const h = 10 + Math.random() * 40; return [[new THREE.BoxGeometry(8, h, 8), neonM[Math.floor(Math.random() * 3)], h / 2]]; },
    },
  };

  // --- track: closed spline sampled into N points, with left-pointing normals L ---
  const world = new THREE.Group(); scene.add(world);
  const boxG = new THREE.BoxGeometry(1.8, 1.8, 1.8);
  let P: Vec[] = [], L: Vec[] = [], boxes: { mesh: THREE.Mesh; t: number }[] = [], x0 = 0, x1 = 0, z0 = 0, z1 = 0, sc = 1;
  const at = (i: number, o: number, y: number) => P[i].clone().addScaledVector(L[i], o).setY(y);
  // one quad (6 verts from quad(i, j)) per track segment; glow = unlit so it shines at night
  function strip(quad: (i: number, j: number) => Vec[], colorFn: (i: number) => number, glow?: boolean) {
    const pos: number[] = [], col: number[] = [], c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      c.set(colorFn(i));
      for (const v of quad(i, (i + 1) % N)) { pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const opts = {vertexColors: true, side: THREE.DoubleSide};
    world.add(new THREE.Mesh(g, glow ? new THREE.MeshBasicMaterial(opts) : new THREE.MeshLambertMaterial(opts)));
  }
  const ribbon = (o1: number, o2: number, colorFn: (i: number) => number, y: number, glow?: boolean) =>
    strip((i, j) => [at(i, o1, y), at(i, o2, y), at(j, o1, y), at(i, o2, y), at(j, o2, y), at(j, o1, y)], colorFn, glow);

  function buildTrack() {
    const map = MAPS[cfg.map];
    world.clear(); // ponytail: old geometries aren't disposed; fine for a handful of map switches
    sky.set(map.sky); fog.color.set(map.sky); ground.material.color.set(map.ground);
    hemi.intensity = map.light; sun.intensity = map.light * 0.75;

    const curve = new THREE.CatmullRomCurve3(map.pts.map(([x, z]) => new THREE.Vector3(x * 1.3, 0, z * 1.3)), true);
    // moving-average passes round off sharp corners so the inner barrier never folds over itself
    let pts = curve.getSpacedPoints(N); pts.pop();
    for (let pass = 0; pass < 3; pass++)
      pts = pts.map((_, i) => { const s = new THREE.Vector3(); for (let d = -8; d <= 8; d++) s.add(pts[(i + d + N) % N]); return s.divideScalar(17); });
    P = new THREE.CatmullRomCurve3(pts, true).getSpacedPoints(N); P.pop();
    L = P.map((p, i) => { const t = P[(i + 1) % N].clone().sub(p).normalize(); return new THREE.Vector3(t.z, 0, -t.x); });

    const curb = (i: number) => map.curb[(i >> 2) % 2];
    ribbon(-W / 2, W / 2, () => map.road, 0.02);
    ribbon(W / 2, W / 2 + 2, curb, 0.03, map.glow);
    ribbon(-W / 2 - 2, -W / 2, curb, 0.03, map.glow);
    // visible barriers where karts get stopped (see locate)
    for (const o of [-WALL, WALL])
      strip((i, j) => [at(i, o, 0), at(i, o, 1.4), at(j, o, 0), at(i, o, 1.4), at(j, o, 1.4), at(j, o, 0)], i => map.wall[(i >> 3) % 2], map.glow);

    // start line + banner
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 16;
    const cx = cv.getContext('2d')!;
    for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) { cx.fillStyle = (x + y) % 2 ? '#fff' : '#111'; cx.fillRect(x * 8, y * 8, 8, 8); }
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter;
    const grp = new THREE.Group();
    grp.position.copy(P[0]);
    grp.rotation.y = Math.atan2(P[1].x - P[0].x, P[1].z - P[0].z);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(W, W / 4), new THREE.MeshBasicMaterial({map: tex}));
    line.rotation.x = -Math.PI / 2; line.position.y = 0.05; grp.add(line);
    const postM = lam(0xffcc00);
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), postM); post.position.set(s * (WALL + 0.6), 4, 0); grp.add(post); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2 * WALL + 2, 1.5, 0.6), new THREE.MeshBasicMaterial({map: tex}));
    bar.position.y = 8; grp.add(bar);
    world.add(grp);

    // scenery, kept outside the barriers
    const xs = P.map(p => p.x), zs = P.map(p => p.z);
    [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    sc = 140 / Math.max(x1 - x0, z1 - z0);
    for (let n = 0; n < 250; n++) {
      const x = x0 - 80 + Math.random() * (x1 - x0 + 160), z = z0 - 80 + Math.random() * (z1 - z0 + 160);
      if (P.some((p, i) => i % 5 === 0 && (p.x - x) ** 2 + (p.z - z) ** 2 < (WALL + 6) ** 2)) continue;
      for (const [geo, mat, y] of map.prop()) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); world.add(o); }
    }

    // item boxes
    boxes = [];
    for (const f of [0.15, 0.42, 0.68, 0.88]) for (const o of [-6, -2, 2, 6]) {
      const i = Math.floor(f * N);
      const mesh = new THREE.Mesh(boxG, new THREE.MeshLambertMaterial({color: 0xffdd33, emissive: 0x664400, transparent: true, opacity: 0.85}));
      mesh.position.copy(at(i, o, 1.6));
      world.add(mesh); boxes.push({mesh, t: 0});
    }
  }
  buildTrack();

  // --- karts: g = position/heading, m = visual body (drift lean, spin-outs), rebuilt on customise ---
  const dark = new THREE.MeshLambertMaterial({color: 0x222222});
  function buildKart(k: Kart) {
    const m = k.m, s = STYLES[k.style], [bw, bh, bl] = s.body, r = s.wheel, y = r + 0.2;
    m.clear();
    const add = <M extends THREE.Material>(geo: THREE.BufferGeometry, mat: M, x: number, yy: number, z: number) => {
      const o = new THREE.Mesh(geo, mat); o.position.set(x, yy, z); m.add(o); return o;
    };
    const mat = new THREE.MeshLambertMaterial({color: k.color});
    add(new THREE.BoxGeometry(bw, bh, bl), mat, 0, y, 0);
    if (k.style !== 'Buggy') add(new THREE.BoxGeometry(bw + 0.2, 0.2, 0.6), mat, 0, y + 0.8, -bl / 2 + 0.2);
    if (k.style === 'Rocket') add(new THREE.ConeGeometry(bh / 2 + 0.1, 1.2, 8).rotateX(Math.PI / 2), mat, 0, y, bl / 2 + 0.6);
    if (k.style === 'Buggy') {
      for (const sx of [-0.8, 0.8]) add(new THREE.BoxGeometry(0.15, 1.6, 0.15), dark, sx, y + 1.2, -0.9);
      add(new THREE.BoxGeometry(1.75, 0.15, 0.15), dark, 0, y + 2, -0.9);
    }
    const wheelG = new THREE.CylinderGeometry(r, r, 0.5, 12).rotateZ(Math.PI / 2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(wheelG, dark, sx * (bw / 2 + 0.1), r, sz * (bl / 2 - 0.6));
    const head = add(new THREE.SphereGeometry(0.6, 12, 10), new THREE.MeshLambertMaterial({color: k.skin}), 0, y + 1, -0.3);
    add(new THREE.SphereGeometry(0.66, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({color: k.helmet}), 0, head.position.y, -0.3);
    k.spark = add(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({color: 0xffffff}), 0, 0.4, -bl / 2 - 0.3);
    k.spark.visible = false;
  }
  // karts[0] is always player 1; karts[1] is player 2 in 2P mode, otherwise the AI racer Pip
  // (race fields start at zero here and are set properly by reset())
  const karts: Kart[] = RACERS.map((r, i) => {
    const k: Kart = {
      ...r, pn: i, g: new THREE.Group(), m: new THREE.Group(), spark: new THREE.Mesh(undefined, new THREE.MeshBasicMaterial()),
      pos: new THREE.Vector3(), idx: 0, lap: 0, lat: 0, speed: 0, h: 0, camH: 0, boost: 0, spin: 0, drift: 0, charge: 0,
      item: null, itemT: 0, finished: false, finishTime: 0, skill: 1, lane: 0, wrongT: 0, net: null, netAt: 0,
      human: false, remote: false, ai: false,
    };
    k.g.add(k.m); scene.add(k.g);
    buildKart(k);
    return k;
  });
  const humans = () => karts.slice(0, cfg.two ? 2 : 1);
  const hex = (s: string) => parseInt(String(s).slice(1), 16);

  // --- online: a relay passes JSON between up to 4 browsers. Server slots 0-3 are grid spots;
  // the local player is always karts[0]. Each browser drives its own kart; the host (lowest slot) drives the AI ---
  let es: EventSource | null = null, net: Net | null = null, netErr = ''; // net is set once connected
  const slotOf = (n: number) => net ? (n + net.slot) % 4 : n;
  const kartOf = (s: number) => karts[(s - net!.slot + 4) % 4];
  const isHost = () => !net || net.slot < Math.min(4, ...net.peers);
  const send = (m: object) => net && fetch('send', {method: 'POST', body: JSON.stringify({...m, from: net.slot})}).catch(() => {});
  const sendProfile = () => send({t: 'me', p: cfg.players[0]});
  // human = a person drives it (here or elsewhere); remote = its state arrives over the network
  function roles() {
    karts.forEach((k, n) => {
      const peer = !!net && net.peers.has(slotOf(n));
      k.human = n < humans().length || peer;
      k.remote = peer || (!k.human && !isHost());
      k.ai = !k.remote && (!k.human || k.finished);
    });
  }

  const fromProfile = (p: PlayerLook, fallback: string): Look => ({name: String(p.name).trim().slice(0, 10) || fallback,
    color: hex(p.color), helmet: hex(p.helmet), skin: hex(p.skin), style: isIn(KART_STYLES, p.style) ? p.style : 'Classic'});
  function applyCfg() {
    karts.forEach((k, n) => {
      const s = slotOf(n), p = n === 0 ? cfg.players[0] : n === 1 && cfg.two ? cfg.players[1] : net && net.profiles[s];
      Object.assign(k, p ? fromProfile(p, `Player ${s + 1}`) : RACERS[s]);
      buildKart(k);
    });
  }

  // --- puddles, effects ---
  let puddles: THREE.Mesh[] = [], effects: { obj: THREE.Object3D; t: number }[] = [];
  const puddleG = new THREE.CylinderGeometry(2, 2, 0.1, 16), puddleM = new THREE.MeshLambertMaterial({color: 0x33dd55});
  let puddleN = 0;
  function addPuddle(x: number, z: number, id: string) {
    const p = new THREE.Mesh(puddleG, puddleM);
    p.position.set(x, 0.06, z); p.userData.id = id;
    scene.add(p); puddles.push(p);
  }
  function zapFx(a: Kart, b: Kart) {
    const geo = new THREE.BufferGeometry().setFromPoints([a.pos.clone().setY(1.5), b.pos.clone().setY(1.5)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({color: 0xffff00}));
    scene.add(line); effects.push({obj: line, t: 0.3});
  }

  // --- input ---
  const keys = new Set<string>();
  // browsers can suspend audio (tab switch, output device change); any input wakes it
  addEventListener('pointerdown', () => ac && ac.resume(), {signal});
  let touchDriving = false; // on-screen controls in use: auto-accelerate unless braking
  const toggleMute = () => { cfg.muted = !cfg.muted; save(); if (master) master.gain.value = cfg.muted ? 0 : 0.6; };
  addEventListener('keydown', e => {
    if (ac && ac.state !== 'running') ac.resume();
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    touchDriving = false;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    const n = CONTROLS.findIndex(c => c.item === e.code);
    if (n >= 0) useItem(karts[cfg.two ? n : 0]);
    if (e.code === 'KeyR' && state !== 'menu') startRace();
    if (e.code === 'KeyG') menu();
    if (e.code === 'KeyM') toggleMute();
  }, {signal});
  addEventListener('keyup', e => keys.delete(e.code), {signal});
  function humanInput(k: Kart): Input {
    const c = CONTROLS[k.pn], solo = !cfg.two; // solo: player 1 can use either key set
    const on = (a: Action) => +(keys.has(c[a]) || (solo && keys.has(CONTROLS[1][a])));
    return {accel: touchDriving && !on('down') ? 1 : on('up') - on('down'), steer: on('left') - on('right'), drift: !!on('drift')};
  }

  // --- race state ---
  let state: State = 'menu', clock = 0, raceTime = 0, menuA = 0, edit = 0, leadProg = 0;
  const progress = (k: Kart) => k.lap * N + k.idx;
  const ranked = () => [...karts].sort((a, b) =>
    (a.finished && b.finished) ? a.finishTime - b.finishTime : (+b.finished - +a.finished) || progress(b) - progress(a));

  function reset() {
    karts.forEach((k, n) => {
      const g = slotOf(n), i = N - 6 - Math.floor(g / 2) * 6, side = g % 2 ? -4 : 4;
      Object.assign(k, {
        pos: P[i].clone().addScaledVector(L[i], side), idx: i, lap: 0, lat: side, speed: 0,
        h: Math.atan2(P[(i + 1) % N].x - P[i].x, P[(i + 1) % N].z - P[i].z),
        boost: 0, spin: 0, drift: 0, charge: 0, item: null, itemT: 0, finished: false, finishTime: 0,
        skill: 0.9 + Math.random() * 0.07, lane: (Math.random() - 0.5) * 10, wrongT: 0, net: null,
      });
      k.camH = k.h;
      k.m.rotation.y = 0; k.spark.visible = false;
      k.g.position.copy(k.pos); k.g.rotation.y = k.h;
    });
    roles();
    boxes.forEach(b => { b.t = 0; b.mesh.visible = true; });
    puddles.forEach(p => scene.remove(p)); puddles = [];
    effects.forEach(e => scene.remove(e.obj)); effects = [];
    state = 'count'; clock = 3; raceTime = 0;
    root.classList.toggle('two', cfg.two);
    $('end').style.display = 'none';
    (document.activeElement as HTMLElement | null)?.blur(); // so Space doesn't re-press a focused button
  }

  function menu() {
    reset(); state = 'menu';
    $('menu').style.display = 'flex';
  }
  // online, only the host starts races, and starting puts everyone on the grid
  function startRace() {
    if (net) { if (!isHost()) return; send({t: 'start', map: cfg.map}); }
    initAudio(); $('menu').style.display = 'none'; reset();
  }

  function useItem(k: Kart) {
    if (!k.item || state !== 'race' || k.spin > 0) return;
    const it = k.item; k.item = null;
    if (it === 'turbo') { k.boost = 1.3; if (k.human) SFX.boost(pan(k)); }
    if (it === 'goo') {
      const x = k.pos.x - Math.sin(k.h) * 4, z = k.pos.z - Math.cos(k.h) * 4, id = `${net ? net.slot : 0}-${++puddleN}`;
      addPuddle(x, z, id); send({t: 'goo', x, z, id});
      if (k.human) SFX.goo(pan(k));
    }
    if (it === 'zap') {
      // hits the kart directly ahead in the standings; the leader gets a turbo instead
      const r = ranked(), ahead = r[r.indexOf(k) - 1];
      if (!ahead) { k.boost = 1.3; if (k.human) SFX.boost(pan(k)); return; }
      if (k.human) SFX.zap(pan(k));
      zapFx(k, ahead);
      send({t: 'zap', by: slotOf(k.pn), to: slotOf(ahead.pn)}); // whoever controls the target spins it
      if (!ahead.remote) { ahead.spin = 1.2; if (ahead.human) SFX.spin(pan(ahead)); }
    }
  }

  // remote kart: glide toward where its last update says it should be by now
  function follow(k: Kart, dt: number) {
    if (!k.net) return;
    const [x, z, h, speed, lap, idx, rot, spark, fin, ft] = k.net, age = Math.min(0.3, (performance.now() - k.netAt) / 1000);
    const a = Math.min(1, 12 * dt), d = h - k.h;
    k.pos.x += (x + Math.sin(h) * speed * age - k.pos.x) * a;
    k.pos.z += (z + Math.cos(h) * speed * age - k.pos.z) * a;
    k.h += Math.atan2(Math.sin(d), Math.cos(d)) * a;
    Object.assign(k, {speed, lap, idx, finished: !!fin, finishTime: ft});
    k.m.rotation.y = rot; k.spark.visible = !!spark;
    k.g.position.copy(k.pos); k.g.rotation.y = k.h;
  }

  function onNet(m: Msg) {
    if (m.t === 'hello') {
      net = {slot: m.slot, peers: new Set(m.peers), profiles: {}};
      edit = 0; loadInputs(); refreshMenu(); menu(); // refreshMenu also sends our profile
    }
    const n = net;
    if (!n) return;
    if (m.t === 'join') { n.peers.add(m.slot); sendProfile(); }
    if (m.t === 'leave') { n.peers.delete(m.slot); delete n.profiles[m.slot]; roles(); applyCfg(); }
    if (m.t === 'me') { n.peers.add(m.from); n.profiles[m.from] = m.p; applyCfg(); }
    if (m.t === 'start' && isIn(MAP_NAMES, m.map)) {
      if (m.map !== cfg.map) { cfg.map = m.map; buildTrack(); refreshMenu(); }
      $('menu').style.display = 'none'; reset();
    }
    if (m.t === 's') for (const [s, ...v] of m.k) {
      const k = kartOf(s);
      if (k && k.remote) { k.net = v; k.netAt = performance.now(); }
    }
    if (m.t === 'goo') addPuddle(m.x, m.z, m.id);
    if (m.t === 'pop') puddles = puddles.filter(p => p.userData.id !== m.id || (scene.remove(p), false));
    if (m.t === 'zap') {
      const t = kartOf(m.to);
      zapFx(kartOf(m.by), t);
      if (!t.remote) { t.spin = 1.2; if (t.human) SFX.spin(pan(t)); }
    }
    netInfo();
  }
  function goOnline() {
    if (es) return;
    netErr = '';
    const src = es = new EventSource('events');
    es.onmessage = e => { try { onNet(JSON.parse(e.data)); } catch (err) { console.warn('bad net message', err); } };
    es.onerror = () => {
      if (es !== src || src.readyState !== EventSource.CLOSED) return; // CONNECTING = auto-retry after a dropout
      goOffline(); netErr = "Online play isn't available here (it needs the game server), or the room is full."; netInfo();
    };
  }
  function goOffline() { if (es) { es.close(); es = net = null; } }
  function netInfo() {
    $('netInfo').innerHTML = !es ? netErr : !net ? 'Connecting…'
      : `Online as P${net.slot + 1} · ${net.peers.size + 1}/4 players<br>${isHost() ? 'You are the host: pick a track and start' : 'The host picks the track and starts'}`;
    $<HTMLButtonElement>('go').disabled = !isHost();
    $('go').textContent = isHost() ? 'Start race' : 'Waiting for host…';
    [...$('cPlayers').children].forEach((b, i) => b.classList.toggle('on', i === (es ? 2 : +cfg.two)));
  }

  function locate(k: Kart) {
    let best = Infinity, bi = k.idx;
    for (let d = -25; d <= 25; d++) {
      const i = (k.idx + d + N) % N, dd = (P[i].x - k.pos.x) ** 2 + (P[i].z - k.pos.z) ** 2;
      if (dd < best) { best = dd; bi = i; }
    }
    const delta = bi - k.idx;
    if (delta < -N / 2) {
      k.lap++;
      if (k.human && k.lap > 1 && !k.finished) (k.lap > LAPS ? SFX.finish : SFX.lap)(pan(k));
    } else if (delta > N / 2) k.lap--;
    k.idx = bi;
    k.lat = (k.pos.x - P[bi].x) * L[bi].x + (k.pos.z - P[bi].z) * L[bi].z;
    // barrier past the grass verge (kart half-width keeps the body outside the wall mesh)
    const lim = WALL - 1.3;
    if (Math.abs(k.lat) > lim) {
      const push = Math.abs(k.lat) - lim, s = Math.sign(k.lat);
      k.pos.addScaledVector(L[bi], -s * push); k.lat = s * lim;
      if (k.human && k.speed > 15) bump(k);
      k.speed *= 0.6;
    }
  }

  function aiInput(k: Kart, dt: number): Input {
    const t = (k.idx + 12) % N;
    const want = Math.atan2(P[t].x + L[t].x * k.lane - k.pos.x, P[t].z + L[t].z * k.lane - k.pos.z);
    let d = want - k.h; d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.random() < 0.005) k.lane = (Math.random() - 0.5) * 10;
    if (k.item && (k.itemT -= dt) <= 0) useItem(k);
    return {accel: 1, steer: Math.max(-1, Math.min(1, d * 2.5)), drift: false};
  }

  function drive(k: Kart, dt: number, {accel, steer, drift}: Input) {
    if (k.spin > 0) {
      k.spin -= dt; k.speed *= 1 - 2 * dt; k.m.rotation.y += dt * 15; accel = steer = 0; drift = false;
      if (k.spin <= 0) k.m.rotation.y = 0;
    }
    const st = STYLES[k.style], off = Math.abs(k.lat) > W / 2 + 1;
    let skill = k.skill;
    if (k.ai && !k.human) { // rubber band toward the leading human
      const gap = leadProg - progress(k);
      skill += gap > 40 ? 0.08 : gap < -80 ? -0.06 : 0;
    }
    let max = MAX * st.speed * (k.human ? 1 : skill) * (off ? st.off : 1);
    if (k.boost > 0) { k.boost -= dt; max *= 1.45; k.speed += 60 * dt; }

    if (accel > 0) k.speed += ACC * dt;
    else if (accel < 0) k.speed -= (k.speed > 0 ? ACC * 1.6 : ACC * 0.6) * dt;
    else k.speed *= 1 - 0.8 * dt;
    if (k.speed > max) k.speed += (max - k.speed) * Math.min(1, 3 * dt);
    k.speed = Math.max(k.speed, -MAX * 0.3);

    // drift: hold to slide, release to cash in charge as boost
    if (drift && !k.drift && steer && k.speed > 15 && k.spin <= 0) { k.drift = Math.sign(steer); k.charge = 0; }
    if (k.drift && (!drift || k.speed < 10)) {
      if (k.charge > 1.6) k.boost = 1.1; else if (k.charge > 0.8) k.boost = 0.6;
      if (k.human && k.charge > 0.8) SFX.boost(pan(k));
      k.drift = 0;
    }
    let turn = steer * 1.9 * st.turn;
    if (k.drift) {
      turn = (k.drift * 1.3 + steer * 1.0) * st.turn;
      k.charge += dt * (steer === k.drift ? 1.5 : 0.7);
      k.m.rotation.y = k.drift * 0.35;
    } else if (k.spin <= 0) k.m.rotation.y *= 0.8;
    k.h += turn * Math.min(1, Math.abs(k.speed) / 12) * dt * (k.speed < 0 ? -1 : 1);
    k.pos.x += Math.sin(k.h) * k.speed * dt;
    k.pos.z += Math.cos(k.h) * k.speed * dt;
    locate(k);

    k.spark.visible = (!!k.drift && k.charge > 0.3) || k.boost > 0;
    k.spark.material.color.set(k.boost > 0 ? 0xff6600 : k.charge > 1.6 ? 0xff8800 : k.charge > 0.8 ? 0x33aaff : 0xffffff);
    k.g.position.copy(k.pos); k.g.rotation.y = k.h;

    if (k.lap > LAPS && !k.finished) { k.finished = true; k.finishTime = raceTime; k.ai = true; }
  }

  function chase(cam: THREE.PerspectiveCamera, k: Kart, dt: number) {
    let d = k.h - k.camH; d = Math.atan2(Math.sin(d), Math.cos(d));
    k.camH += d * Math.min(1, 5 * dt);
    const fx = Math.sin(k.camH), fz = Math.cos(k.camH);
    cam.position.set(k.pos.x - fx * 11, 5, k.pos.z - fz * 11);
    cam.lookAt(k.pos.x + fx * 6, 1.5, k.pos.z + fz * 6);
    cam.fov += ((k.boost > 0 ? 82 : 70) - cam.fov) * Math.min(1, 6 * dt);
  }

  function update(dt: number) {
    bumpCd -= dt;
    const hs = humans();
    if (state === 'count') {
      const c = Math.ceil(clock);
      if (clock === 3) SFX.beep();
      clock -= dt;
      if (clock <= 0) { state = 'race'; clock = 1; SFX.go(); }
      else if (Math.ceil(clock) !== c) SFX.beep();
    } else if (state !== 'menu') {
      raceTime += dt; clock -= dt;
      leadProg = Math.max(...karts.filter(k => k.human).map(progress));
      for (const k of karts) k.remote ? follow(k, dt) : drive(k, dt, k.ai ? aiInput(k, dt) : humanInput(k));
      // kart-kart bumps (only karts we control get pushed)
      for (let a = 0; a < karts.length; a++) for (let b = a + 1; b < karts.length; b++) {
        const ka = karts[a], kb = karts[b], A = ka.pos, B = kb.pos, dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
        if (d < 2.6 && d > 0 && !(ka.remote && kb.remote)) {
          const o = (2.6 - d) / d, wa = kb.remote ? 1 : ka.remote ? 0 : 0.5;
          A.x -= dx * o * wa; A.z -= dz * o * wa; B.x += dx * o * (1 - wa); B.z += dz * o * (1 - wa);
          const h = [ka, kb].find(k => k.human && !k.remote);
          if (h) bump(h);
        }
      }
      if (net && (net.sendT = (net.sendT || 0) + dt) > 0.05) { // ~20 updates a second
        net.sendT = 0;
        const r = (v: number) => Math.round(v * 100) / 100;
        send({t: 's', k: karts.filter(k => !k.remote).map(k =>
          [slotOf(k.pn), r(k.pos.x), r(k.pos.z), r(k.h), r(k.speed), k.lap, k.idx, r(k.m.rotation.y), +k.spark.visible, +k.finished, r(k.finishTime)])});
      }
      for (const k of karts.filter(k => !k.remote)) {
        for (const b of boxes) if (b.t <= 0 && k.pos.distanceToSquared(b.mesh.position.clone().setY(0)) < 7) {
          b.t = 3; b.mesh.visible = false;
          if (!k.item) {
            k.item = ITEMS[Math.floor(Math.random() * 3)]; k.itemT = 1 + Math.random() * 3;
            if (k.human) SFX.pickup(pan(k));
          }
        }
        puddles = puddles.filter(p => {
          if (k.pos.distanceToSquared(p.position.clone().setY(0)) < 6) {
            k.spin = 1; scene.remove(p); send({t: 'pop', id: p.userData.id});
            if (k.human) SFX.spin(pan(k));
            return false;
          }
          return true;
        });
      }
      // wrong way: moving against the track direction (track tangent = (-L.z, L.x))
      for (const k of hs) {
        const l = L[k.idx], along = (Math.sin(k.h) * -l.z + Math.cos(k.h) * l.x) * Math.sign(k.speed);
        k.wrongT = along < -0.3 && Math.abs(k.speed) > 5 && !k.finished ? k.wrongT + dt : 0;
      }
      if (state === 'race' && hs.every(k => k.finished)) { state = 'done'; showEnd(); }
    }
    for (const b of boxes) { b.mesh.rotation.y += dt * 2; b.mesh.rotation.x += dt; if (b.t > 0 && (b.t -= dt) <= 0) b.mesh.visible = true; }
    effects = effects.filter(e => (e.t -= dt) > 0 || (scene.remove(e.obj), false));

    if (state === 'menu') { // slow orbit around the kart being customised
      const k = karts[edit];
      menuA += dt * 0.5;
      cams[0].position.set(k.pos.x + Math.sin(menuA) * 7, 3, k.pos.z + Math.cos(menuA) * 7);
      cams[0].lookAt(k.pos.x, 1, k.pos.z);
      cams[0].fov = 70;
    } else hs.forEach((k, n) => chase(cams[n], k, dt));

    const a = ac;
    if (a) voices.forEach((v, n) => {
      const k = karts[n], on = state !== 'menu' && n < hs.length, s = Math.abs(k.speed), t = a.currentTime;
      v.out.pan.value = pan(k);
      // pitch kept above ~90 Hz so laptop speakers can actually play it
      v.engine.frequency.setTargetAtTime(90 + s * 4 + (k.boost > 0 ? 50 : 0), t, 0.05);
      v.engineGain.gain.setTargetAtTime(on ? 0.07 + s / MAX * 0.07 : 0, t, 0.1);
      v.screechGain.gain.setTargetAtTime(on && k.drift ? 0.05 : 0, t, 0.05);
    });
  }

  // --- HUD ---
  const ord = (n: number) => n + ['st', 'nd', 'rd', 'th'][Math.min(n, 4) - 1];
  const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  const mapCtx = $<HTMLCanvasElement>('map').getContext('2d')!;
  const mx = (x: number) => 150 - (x - x0) * sc, mz = (z: number) => 150 - (z - z0) * sc; // flipped so it matches the camera's view
  const pvs = [...root.querySelectorAll<HTMLElement>('.pv')];

  // --- touch controls: they press the same virtual keys as that player's keyboard set ---
  root.classList.toggle('touch', isTouch);
  pvs.forEach((pv, n) => {
    const c = CONTROLS[n], set = (code: string, v: boolean) => v ? keys.add(code) : keys.delete(code);
    const pad = pv.querySelector<HTMLElement>('.steer')!, [l, r] = pad.children;
    const steer = (e: PointerEvent) => {
      const rect = pad.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width;
      set(c.left, x < 0.45); set(c.right, x > 0.55);
      l.classList.toggle('on', x < 0.45); r.classList.toggle('on', x > 0.55);
    };
    pad.onpointerdown = e => { pad.setPointerCapture(e.pointerId); touchDriving = true; steer(e); };
    pad.onpointermove = e => pad.hasPointerCapture(e.pointerId) && steer(e);
    pad.onpointerup = pad.onpointercancel = () => { set(c.left, false); set(c.right, false); l.classList.remove('on'); r.classList.remove('on'); };
    for (const b of pv.querySelectorAll<HTMLButtonElement>('.acts button')) {
      const a = b.dataset.a as 'item' | 'down' | 'drift';
      b.onpointerdown = e => {
        e.preventDefault(); touchDriving = true; b.classList.add('on');
        if (a === 'item') useItem(karts[n]); else set(c[a], true);
      };
      b.onpointerup = b.onpointercancel = () => { b.classList.remove('on'); if (a !== 'item') set(c[a], false); };
    }
  });
  $('tRestart').onclick = () => state !== 'menu' && startRace();
  $('tGarage').onclick = menu;
  $('tMute').onclick = toggleMute;

  function hud() {
    $('hud').style.display = state === 'menu' ? 'none' : '';
    if (state === 'menu') return;
    const order = ranked();
    humans().forEach((k, n) => {
      const q = (c: string) => pvs[n].querySelector<HTMLElement>(c)!;
      q('.lap').textContent = `Lap ${Math.min(Math.max(k.lap, 1), LAPS)}/${LAPS}`;
      q('.item').textContent = k.item ? ICON[k.item] : '';
      q('.wrong').style.display = k.wrongT > 0.7 ? 'block' : 'none';
      q('.pos').textContent = ord(order.indexOf(k) + 1);
    });
    $('time').textContent = fmt(raceTime);
    $('mute').style.display = cfg.muted ? '' : 'none';
    $('tMute').textContent = cfg.muted ? '🔇' : '🔈';
    $('msg').textContent = state === 'count' ? String(Math.ceil(clock)) : state === 'race' && clock > 0 ? 'GO!' : '';
    mapCtx.clearRect(0, 0, 160, 160);
    mapCtx.strokeStyle = '#fff'; mapCtx.lineWidth = 4; mapCtx.beginPath();
    P.forEach((p, i) => i % 4 || mapCtx.lineTo(mx(p.x), mz(p.z))); mapCtx.closePath(); mapCtx.stroke();
    for (const k of [...karts].reverse()) {
      mapCtx.fillStyle = '#' + k.color.toString(16).padStart(6, '0');
      mapCtx.beginPath(); mapCtx.arc(mx(k.pos.x), mz(k.pos.z), k.human ? 6 : 4, 0, 7); mapCtx.fill();
    }
  }

  function showEnd() {
    $('endText').innerHTML = `<b>Race finished!</b><br>` +
      ranked().map((k, i) => `${ord(i + 1)} — ${k.human ? '<b>' : ''}${k.name.replace(/</g, '&lt;')}${k.human ? '</b>' : ''}` +
        (k.finished ? ' · ' + fmt(k.finishTime) : '')).join('<br>') +
      `<br>${isHost() ? '<button data-end="again">Race again</button>' : 'Waiting for the host…'} <button data-end="garage">Garage</button>`;
    const again = $('endText').querySelector<HTMLElement>('[data-end=again]');
    if (again) again.onclick = startRace;
    $('endText').querySelector<HTMLElement>('[data-end=garage]')!.onclick = menu;
    $('end').style.display = 'grid';
  }

  // --- garage menu (edits cfg.players[edit]) ---
  const optRow = <T extends string>(id: string, labels: readonly T[], onPick: (i: number, label: T) => void) => labels.map((label, i) => {
    const b = document.createElement('button'); b.className = 'opt'; b.textContent = label;
    b.onclick = () => onPick(i, label);
    $(id).append(b); return b;
  });
  const cName = $<HTMLInputElement>('cName'), cColor = $<HTMLInputElement>('cColor'), cHelmet = $<HTMLInputElement>('cHelmet');
  function loadInputs() {
    const p = cfg.players[edit];
    cName.value = p.name; cColor.value = p.color; cHelmet.value = p.helmet;
  }
  function refreshMenu() {
    const p = cfg.players[edit];
    [...$('cSkin').children].forEach((b, i) => b.classList.toggle('on', SKINS[i] === p.skin));
    [...$('cStyle').children].forEach(b => b.classList.toggle('on', b.textContent === p.style));
    [...$('cMap').children].forEach(b => b.classList.toggle('on', b.textContent === cfg.map));
    [...$('cEdit').children].forEach((b, i) => b.classList.toggle('on', i === edit));
    $('editRow').style.display = cfg.two ? '' : 'none';
    const bar = (v: number) => '■'.repeat(v) + '□'.repeat(5 - v), [s, h, o] = STYLES[p.style].bars;
    $('stats').innerHTML = `Speed&nbsp;&nbsp;&nbsp;${bar(s)}<br>Handling ${bar(h)}<br>Off-road ${bar(o)}`;
    $('keys').innerHTML = cfg.two
      ? 'P1: WASD · Space drift · E item<br>P2: Arrows · R-Shift drift · Enter item'
      : 'Arrows/WASD · Space drift · E item';
    applyCfg(); save(); netInfo(); sendProfile();
  }
  cName.oninput = () => { cfg.players[edit].name = cName.value; refreshMenu(); };
  cColor.oninput = () => { cfg.players[edit].color = cColor.value; refreshMenu(); };
  cHelmet.oninput = () => { cfg.players[edit].helmet = cHelmet.value; refreshMenu(); };
  for (const s of SKINS) {
    const b = document.createElement('button'); b.className = 'sw'; b.style.background = s;
    b.setAttribute('aria-label', 'Skin tone ' + s);
    b.onclick = () => { cfg.players[edit].skin = s; refreshMenu(); };
    $('cSkin').append(b);
  }
  optRow('cStyle', KART_STYLES, (_, s) => { cfg.players[edit].style = s; refreshMenu(); });
  optRow('cMap', MAP_NAMES, (_, m) => { cfg.map = m; buildTrack(); refreshMenu(); menu(); });
  optRow('cPlayers', ['1 Player', '2 Players', 'Online'], i => {
    cfg.two = i === 1; edit = 0;
    if (i === 2) { initAudio(); goOnline(); } else { goOffline(); netErr = ''; }
    loadInputs(); refreshMenu(); menu();
  });
  optRow('cEdit', ['Player 1', 'Player 2'], i => { edit = i; loadInputs(); refreshMenu(); });
  $('go').onclick = startRace;

  loadInputs();
  refreshMenu();
  menu();
  let last = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    update(dt); hud();
    // split screen: one viewport per human (the garage always uses the full screen)
    const n = state === 'menu' ? 1 : humans().length, w = innerWidth / n, h = innerHeight;
    renderer.setScissorTest(n > 1);
    for (let i = 0; i < n; i++) {
      cams[i].aspect = w / h; cams[i].updateProjectionMatrix();
      renderer.setViewport(i * w, 0, w, h); renderer.setScissor(i * w, 0, w, h);
      renderer.render(scene, cams[i]);
    }
  });

  return () => {
    listening.abort();
    renderer.setAnimationLoop(null);
    renderer.dispose();
    renderer.forceContextLoss();
    ac?.close();
    goOffline();
    if (viewport && siteViewport !== undefined) viewport.content = siteViewport;
    root.innerHTML = '';
    root.classList.remove('tt', 'two', 'touch');
  };
}
