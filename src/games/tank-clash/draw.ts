// Drawing (research R1; spec Style): a bright cartoon side view fitted to the canvas — sky and scenery per map, the
// ground from the grid, chunky path-drawn tanks per type in the player's colour, wrecks, name and health bars, the
// active tank's glow and arrow, the shell's fading trail, explosions and crates. All original art.
import { CELL, CRATE_SIZE, GRID_H, GRID_W, TANK_H, TANK_W, WORLD_H, WORLD_W } from './constants.ts';
import { Drop, MapId, Material, Phase, TankType } from './enums.ts';
import { activeTank, facing, type Battle, type Tank } from './sim.ts';
import { TANKS } from './tanks.ts';
import type { Terrain } from './terrain.ts';

type Ctx = CanvasRenderingContext2D;
type Scene = { skyTop: string; skyBottom: string; far: string; near: string; extra: 'farm' | 'forest' | 'lake' | 'peaks' };
const SCENES: Record<Terrain['map'], Scene> = {
  [MapId.GreenHills]: { skyTop: '#5ab4f0', skyBottom: '#cdeeff', far: '#9fd3a4', near: '#7cc184', extra: 'farm' },
  [MapId.TimberGap]: { skyTop: '#f2a65a', skyBottom: '#ffe3b3', far: '#c99a6b', near: '#a9805a', extra: 'forest' },
  [MapId.LakeValley]: { skyTop: '#4fa3e0', skyBottom: '#d8f1ff', far: '#8fc7c0', near: '#6fb0a8', extra: 'lake' },
  [MapId.FrostRidge]: { skyTop: '#8fb8de', skyBottom: '#eef6ff', far: '#c4d4e6', near: '#a9bfd8', extra: 'peaks' },
};
const OUTLINE = '#1d1d24';
const TRACK = '#3a3a42';
const WRECK = '#2e2b2b';
// cell colours (r, g, b)
const RGB: Record<number, [number, number, number]> = {
  [Material.Earth]: [150, 98, 58], [Material.Snow]: [246, 250, 255], [Material.Ice]: [182, 226, 245],
  [Material.Wood]: [168, 112, 60], [Material.Water]: [64, 150, 225],
};
const GRASS: [number, number, number] = [96, 186, 70];
const GRASS_EDGE: [number, number, number] = [206, 170, 92];

/** A colour lighter (f > 1) or darker (f < 1). */
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16), c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

// the ground layer: one pixel per cell, rebuilt when the terrain changes (a blast), drawn scaled up
const layers = new WeakMap<Terrain, { canvas: HTMLCanvasElement; img: ImageData; version: number }>();
const versions = new WeakMap<Terrain, number>();
/** Call after the ground changes, so it is redrawn. */
export const groundChanged = (t: Terrain) => versions.set(t, (versions.get(t) ?? 0) + 1);

function groundLayer(t: Terrain) {
  let layer = layers.get(t);
  const v = versions.get(t) ?? 0;
  if (layer && layer.version === v) return layer.canvas;
  if (!layer) {
    const canvas = document.createElement('canvas');
    canvas.width = GRID_W; canvas.height = GRID_H;
    layer = { canvas, img: canvas.getContext('2d')!.createImageData(GRID_W, GRID_H), version: -1 };
    layers.set(t, layer);
  }
  const d = layer.img.data;
  for (let gx = 0; gx < GRID_W; gx++) {
    let depth = 0; // cells since the last air above
    for (let gy = 0; gy < GRID_H; gy++) {
      const m = t.cells[gy * GRID_W + gx], i = (gy * GRID_W + gx) * 4;
      if (m === Material.Air) { d[i + 3] = 0; depth = 0; continue; }
      let rgb = RGB[m], k = 1;
      if (m === Material.Earth) {
        rgb = depth < 2 ? GRASS : depth < 3 ? GRASS_EDGE : rgb;
        k = depth < 3 ? 1 : Math.max(0.55, 1 - (depth - 3) * 0.006);
      } else if (m === Material.Wood) k = gx % 4 === 0 ? 0.75 : 1; // planks
      else if (m === Material.Water) k = 1 - Math.min(0.35, depth * 0.03);
      d[i] = rgb[0] * k; d[i + 1] = rgb[1] * k; d[i + 2] = rgb[2] * k; d[i + 3] = m === Material.Water ? 215 : 255;
      if (m !== Material.Water) depth++;
    }
  }
  layer.canvas.getContext('2d')!.putImageData(layer.img, 0, 0);
  layer.version = v;
  return layer.canvas;
}

function scenery(ctx: Ctx, s: Scene) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  sky.addColorStop(0, s.skyTop); sky.addColorStop(1, s.skyBottom);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; // clouds
  for (const [x, y, r] of [[220, 120, 34], [640, 80, 28], [1080, 140, 38], [1420, 70, 26]]) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x + r, y + 6, r * 0.8, 0, Math.PI * 2); ctx.arc(x - r, y + 8, r * 0.7, 0, Math.PI * 2); ctx.fill();
  }
  const hills = (color: string, base: number, amp: number, freq: number) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, WORLD_H);
    for (let x = 0; x <= WORLD_W; x += 20) ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * freq) * Math.cos(x * freq * 0.37)));
    ctx.lineTo(WORLD_W, WORLD_H); ctx.fill();
  };
  if (s.extra === 'peaks') { // snowy mountains
    ctx.fillStyle = s.far; ctx.beginPath(); ctx.moveTo(0, 520);
    for (const [x, y] of [[180, 300], [380, 470], [620, 260], [880, 460], [1120, 280], [1380, 450], [1600, 320]]) ctx.lineTo(x, y);
    ctx.lineTo(WORLD_W, WORLD_H); ctx.lineTo(0, WORLD_H); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (const [x, y] of [[180, 300], [620, 260], [1120, 280]]) { ctx.beginPath(); ctx.moveTo(x - 40, y + 40); ctx.lineTo(x, y); ctx.lineTo(x + 40, y + 40); ctx.fill(); }
  } else hills(s.far, 460, 140, 0.004);
  hills(s.near, 540, 90, 0.007);
  if (s.extra === 'farm') for (const x of [300, 1240]) { // farmhouses
    ctx.fillStyle = '#d9534f'; ctx.fillRect(x, 470, 46, 30);
    ctx.fillStyle = '#7a3b2e'; ctx.beginPath(); ctx.moveTo(x - 6, 470); ctx.lineTo(x + 23, 448); ctx.lineTo(x + 52, 470); ctx.fill();
  }
  if (s.extra === 'forest') for (let x = 40; x < WORLD_W; x += 90) { // pines
    ctx.fillStyle = '#5c7a3e'; ctx.beginPath(); ctx.moveTo(x, 470); ctx.lineTo(x + 18, 410 - (x % 3) * 10); ctx.lineTo(x + 36, 470); ctx.fill();
  }
  if (s.extra === 'lake') { ctx.fillStyle = 'rgba(120,190,240,0.6)'; ctx.fillRect(0, 520, WORLD_W, 30); }
}

/** A tank drawn at its bottom centre (x, y), facing `dir` (1 right, −1 left), cannon at `angle` degrees. */
export function drawTank(ctx: Ctx, type: TankType, color: string, x: number, y: number, dir: number, angle: number, wreck = false) {
  const body = wreck ? WRECK : color, dark = wreck ? WRECK : shade(color, 0.7), light = wreck ? WRECK : shade(color, 1.25);
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.lineWidth = 1.6; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round';
  const poly = (fill: string, pts: number[][]) => { ctx.fillStyle = fill; ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill(); ctx.stroke(); };
  const wheel = (cx: number, cy: number, r: number) => { ctx.fillStyle = wreck ? WRECK : '#55555f'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#9a9aa6'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2); ctx.fill(); };
  const cannon = (px: number, py: number, len: number, thick: number, twin = false) => {
    ctx.save(); ctx.translate(px, py); ctx.rotate(-angle * Math.PI / 180);
    for (const off of twin ? [-thick * 0.8, thick * 0.8] : [0]) {
      ctx.fillStyle = dark; ctx.fillRect(0, off - thick / 2, len, thick); ctx.strokeRect(0, off - thick / 2, len, thick);
      ctx.fillStyle = OUTLINE; ctx.fillRect(len - 3, off - thick / 2 - 1, 3, thick + 2); // muzzle
    }
    ctx.restore();
  };
  const rivets = (pts: number[][]) => { ctx.fillStyle = OUTLINE; for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(px, py, 1, 0, Math.PI * 2); ctx.fill(); } };
  const W = TANK_W / 2;
  if (type === TankType.Scout) { // small, light, on big wheels
    cannon(2, -18, 22, 3);
    poly(body, [[-W + 4, -8], [-W + 8, -18], [W - 6, -18], [W - 2, -8]]);
    poly(light, [[-8, -18], [-5, -24], [8, -24], [10, -18]]);
    for (const cx of [-W + 9, 0, W - 9]) wheel(cx, -6, 6);
  } else {
    // tracks with road wheels
    ctx.fillStyle = TRACK; ctx.beginPath(); ctx.roundRect(-W, -11, TANK_W, 11, 5); ctx.fill(); ctx.stroke();
    for (let cx = -W + 6; cx <= W - 6; cx += 9) wheel(cx, -5.5, 3.6);
    if (type === TankType.Heavy) { // wide, armour-heavy, twin cannon
      cannon(4, -24, 24, 4, true);
      poly(body, [[-W, -11], [-W + 3, -21], [W - 3, -21], [W, -11]]);
      poly(dark, [[-W + 2, -15], [W - 2, -15], [W - 1, -12], [-W + 1, -12]]);
      poly(light, [[-12, -21], [-10, -28], [12, -28], [14, -21]]);
      rivets([[-18, -18], [-8, -18], [2, -18], [12, -18], [-6, -25], [6, -25]]);
    } else if (type === TankType.Artillery) { // a long barrel on a light body
      cannon(4, -18, 36, 3.4);
      poly(body, [[-W + 2, -11], [-W + 6, -17], [W - 4, -17], [W - 1, -11]]);
      poly(light, [[-2, -17], [0, -22], [9, -22], [11, -17]]);
      rivets([[-14, -14], [-4, -14], [6, -14], [16, -14]]);
    } else { // the Allrounder: one round turret
      cannon(3, -21, 26, 4);
      poly(body, [[-W + 1, -11], [-W + 5, -19], [W - 5, -19], [W - 1, -11]]);
      ctx.fillStyle = light; ctx.beginPath(); ctx.arc(2, -19, 9, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      rivets([[-14, -15], [-4, -15], [6, -15], [16, -15]]);
    }
  }
  poly(wreck ? WRECK : '#4a4a52', [[-W + 2, -TANK_H + 6], [-W + 6, -TANK_H + 6], [-W + 6, -TANK_H + 12], [-W + 2, -TANK_H + 12]]); // exhaust
  ctx.restore();
}

function crate(ctx: Ctx, x: number, y: number, falling: boolean) {
  const s = CRATE_SIZE;
  if (falling) { // a parachute
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y - s - 26, 22, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e94b3c'; ctx.beginPath(); ctx.arc(x, y - s - 26, 22, Math.PI, Math.PI * 1.33); ctx.lineTo(x, y - s - 26); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 22, y - s - 26); ctx.lineTo(x - s / 2, y - s); ctx.moveTo(x + 22, y - s - 26); ctx.lineTo(x + s / 2, y - s); ctx.stroke();
  }
  ctx.fillStyle = '#c8913e'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6;
  ctx.fillRect(x - s / 2, y - s, s, s); ctx.strokeRect(x - s / 2, y - s, s, s);
  ctx.beginPath(); ctx.moveTo(x - s / 2, y - s); ctx.lineTo(x + s / 2, y); ctx.moveTo(x + s / 2, y - s); ctx.lineTo(x - s / 2, y); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('?', x, y - s / 2 + 5);
}

/** The world → canvas transform for a w × h canvas: the whole field fits, centred. */
export const fit = (w: number, h: number) => { const k = Math.min(w / WORLD_W, h / WORLD_H); return { k, ox: (w - WORLD_W * k) / 2, oy: (h - WORLD_H * k) / 2 }; };

/** The whole battle. `time` (seconds) animates the arrow and smoke. */
export function drawBattle(ctx: Ctx, w: number, h: number, b: Battle, time: number) {
  const { k, ox, oy } = fit(w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = SCENES[b.terrain.map].skyBottom; ctx.fillRect(0, 0, w, h);
  ctx.setTransform(k, 0, 0, k, ox, oy);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, WORLD_W, WORLD_H); ctx.clip();
  scenery(ctx, SCENES[b.terrain.map]);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(groundLayer(b.terrain), 0, 0, GRID_W * CELL, GRID_H * CELL);
  // the middle line
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([10, 12]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(WORLD_W / 2, 0); ctx.lineTo(WORLD_W / 2, WORLD_H); ctx.stroke(); ctx.setLineDash([]);
  for (const c of b.crates) crate(ctx, c.x, c.y, c.falling);
  const active = activeTank(b), aiming = b.phase !== Phase.Over && active.alive;
  for (const t of b.tanks) {
    if (t.gone) continue;
    if (t === active && aiming) { // the active tank's glow (FR-023)
      ctx.save(); ctx.shadowColor = t.look.color; ctx.shadowBlur = 24;
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(t.x, t.y - TANK_H / 2, TANK_W * 0.75, TANK_H, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    drawTank(ctx, t.type, t.look.color, t.x, t.y, facing(t.side), t.angle, !t.alive);
    if (!t.alive) { smoke(ctx, t.x, t.y - TANK_H, time); continue; }
    label(ctx, t, t === active && aiming, time);
  }
  if (b.shell) {
    const tr = b.shell.trail; // fading from the tank end to the shell (FR-004)
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 1; i < tr.length; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${(i / tr.length) * 0.9})`;
      ctx.beginPath(); ctx.moveTo(tr[i - 1][0], tr[i - 1][1]); ctx.lineTo(tr[i][0], tr[i][1]); ctx.stroke();
    }
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(b.shell.x, Math.max(6, b.shell.y), 5, 0, Math.PI * 2); ctx.fill();
    if (b.shell.y < 0) { ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.moveTo(b.shell.x, 2); ctx.lineTo(b.shell.x - 8, 16); ctx.lineTo(b.shell.x + 8, 16); ctx.fill(); }
  }
  if (b.boom && b.boom.t < 0.9) { // a cartoon explosion with smoke
    const { x, y, r, t } = b.boom, p = Math.min(1, t / 0.25);
    ctx.fillStyle = `rgba(80,70,70,${0.5 * (1 - t / 0.9)})`;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + Math.cos(i) * r * 0.6, y - t * 60 + Math.sin(i * 2) * r * 0.4, r * 0.5 * (0.6 + t), 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = `rgba(255,170,40,${1 - t / 0.9})`; ctx.beginPath(); ctx.arc(x, y, r * p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,240,120,${1 - t / 0.6})`; ctx.beginPath(); ctx.arc(x, y, r * p * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function smoke(ctx: Ctx, x: number, y: number, time: number) {
  ctx.fillStyle = 'rgba(90,90,90,0.35)';
  for (let i = 0; i < 3; i++) {
    const p = (time * 0.6 + i / 3) % 1;
    ctx.beginPath(); ctx.arc(x + Math.sin(p * 6 + i) * 6, y - p * 40, 5 + p * 8, 0, Math.PI * 2); ctx.fill();
  }
}

// the name and health bar over a tank (FR-019), and the active tank's bobbing arrow (FR-023)
function label(ctx: Ctx, t: Tank, active: boolean, time: number) {
  const bw = 44, bh = 6, by = t.y - TANK_H - 16, frac = Math.max(0, t.hearts) / TANKS[t.type].hearts;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(t.x - bw / 2 - 1, by - 1, bw + 2, bh + 2);
  ctx.fillStyle = t.look.color; ctx.fillRect(t.x - bw / 2, by, bw * frac, bh);
  ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(t.look.name, t.x, by - 5); ctx.fillStyle = '#ffffff'; ctx.fillText(t.look.name, t.x, by - 5);
  if (t.shield) { ctx.strokeStyle = 'rgba(120,200,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y - TANK_H / 2, TANK_W * 0.7, 0, Math.PI * 2); ctx.stroke(); }
  if (!active) return;
  const ay = by - 30 + Math.sin(time * 6) * 4;
  ctx.fillStyle = '#ffeb3b'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(t.x - 9, ay); ctx.lineTo(t.x + 9, ay); ctx.lineTo(t.x, ay + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
}

/** The garage preview: one tank, big, on a strip of grass. */
export function drawPreview(ctx: Ctx, type: TankType, color: string) {
  const { width: w, height: h } = ctx.canvas, k = Math.min(w / (TANK_W * 2), h / (TANK_H * 2.2));
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = `rgb(${GRASS.join(',')})`; ctx.fillRect(0, h - 10, w, 10);
  ctx.setTransform(k, 0, 0, k, w / 2, h - 10);
  drawTank(ctx, type, color, 0, 0, 1, 35);
}

/** Icons for bonuses a tank holds, for the life panel. */
export const BONUS_ICON: Record<Drop, string> = { [Drop.Repair]: '🔧', [Drop.Power]: '💥', [Drop.GripGear]: '⛓️', [Drop.Shield]: '🛡️' };
