// Drawing on a 2D canvas (research R1): the arena, orbs, snakes with their pattern and eyes, name labels, the
// minimap and the garage preview. Original art, all drawn from shapes (FR-015).
import { ARENA_RADIUS, SEGMENT, START_LENGTH } from './constants.ts';
import { SnakeEyes, SnakePattern } from './enums.ts';
import type { SnakeLook } from './settings.ts';
import { orbRadius, radius, segments, type Arena, type Pt, type Snake } from './sim.ts';

const BG = '#10131a', GRID_DOT = '#232a38', EDGE = '#ff4d6d';
const DOT_GAP = 60;
const LABEL_FONT = '600 13px system-ui, sans-serif';
const ZOOM_MIN = 0.55, ZOOM_SHRINK = 900; // the view zooms out as a snake grows
export const MINI_SIZE = 140;

/** The part of the arena a view shows: centred on (x, y), `zoom` screen pixels per unit, `w`×`h` pixels. */
export type View = { x: number; y: number; zoom: number; w: number; h: number; ox: number; oy: number };

export function viewFor(s: Snake | undefined, ox: number, oy: number, w: number, h: number): View {
  const scale = Math.min(w, h) / 900, grow = s ? Math.max(ZOOM_MIN, 1 - (segments(s) - START_LENGTH) / ZOOM_SHRINK) : 1;
  return { x: s?.path[0].x ?? 0, y: s?.path[0].y ?? 0, zoom: scale * grow, w, h, ox, oy };
}

function toScreen(v: View, p: Pt) { return { x: v.ox + v.w / 2 + (p.x - v.x) * v.zoom, y: v.oy + v.h / 2 + (p.y - v.y) * v.zoom }; }

function eyesAt(ctx: CanvasRenderingContext2D, head: Pt, heading: number, r: number, eyes: SnakeEyes) {
  const side = { x: -Math.sin(heading), y: Math.cos(heading) }, fwd = { x: Math.cos(heading), y: Math.sin(heading) };
  for (const k of [-1, 1]) {
    const e = { x: head.x + side.x * r * 0.5 * k + fwd.x * r * 0.3, y: head.y + side.y * r * 0.5 * k + fwd.y * r * 0.3 };
    if (eyes === SnakeEyes.Starry) {
      ctx.fillStyle = '#ffe74d'; ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = heading + i * Math.PI / 5, rr = i % 2 ? r * 0.16 : r * 0.38;
        ctx.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr);
      }
      ctx.fill(); continue;
    }
    ctx.fillStyle = '#fff'; ctx.beginPath();
    if (eyes === SnakeEyes.Sleepy) ctx.arc(e.x, e.y, r * 0.34, heading - Math.PI / 2, heading + Math.PI / 2);
    else ctx.arc(e.x, e.y, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(e.x + fwd.x * r * 0.12, e.y + fwd.y * r * 0.12, r * 0.16, 0, Math.PI * 2); ctx.fill();
    if (eyes === SnakeEyes.Angry) { // slanted brows
      ctx.strokeStyle = '#111'; ctx.lineWidth = r * 0.14; ctx.beginPath();
      ctx.moveTo(e.x - fwd.x * r * 0.1 + side.x * r * 0.3 * k, e.y - fwd.y * r * 0.1 + side.y * r * 0.3 * k);
      ctx.lineTo(e.x + fwd.x * r * 0.35 - side.x * r * 0.1 * k, e.y + fwd.y * r * 0.35 - side.y * r * 0.1 * k);
      ctx.stroke();
    }
  }
}

/** A snake along `points` (head first) with `r` half-width, in world units under the current transform. */
function snakeBody(ctx: CanvasRenderingContext2D, points: Pt[], heading: number, r: number, look: SnakeLook, glow: boolean) {
  if (points.length < 2) return;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (from = 0, to = points.length) => { ctx.beginPath(); ctx.moveTo(points[from].x, points[from].y); for (let i = from + 1; i < to; i++) ctx.lineTo(points[i].x, points[i].y); ctx.stroke(); };
  if (glow) { ctx.strokeStyle = look.color + '55'; ctx.lineWidth = r * 2.8; line(); }
  ctx.strokeStyle = look.color; ctx.lineWidth = r * 2; line();
  ctx.fillStyle = look.accent; ctx.strokeStyle = look.accent;
  if (look.pattern === SnakePattern.Stripes) { ctx.lineWidth = r * 2; for (let i = 2; i + 2 < points.length; i += 4) line(i, i + 2); }
  if (look.pattern === SnakePattern.Spots) for (let i = 3; i < points.length; i += 3) { ctx.beginPath(); ctx.arc(points[i].x, points[i].y, r * 0.4, 0, Math.PI * 2); ctx.fill(); }
  if (look.pattern === SnakePattern.TwoTone) { ctx.lineWidth = r * 0.8; line(1); }
  const head = points[0];
  ctx.fillStyle = look.color; ctx.beginPath(); ctx.arc(head.x, head.y, r * 1.1, 0, Math.PI * 2); ctx.fill();
  eyesAt(ctx, head, heading, r, look.eyes);
}

/** One view of the arena: background, edge, orbs, snakes (players labelled); the viewer's own snake glows. */
export function drawArena(ctx: CanvasRenderingContext2D, v: View, arena: Arena, me?: Snake, labels = true) {
  ctx.save();
  ctx.beginPath(); ctx.rect(v.ox, v.oy, v.w, v.h); ctx.clip();
  ctx.fillStyle = BG; ctx.fillRect(v.ox, v.oy, v.w, v.h);
  ctx.translate(v.ox + v.w / 2, v.oy + v.h / 2); ctx.scale(v.zoom, v.zoom); ctx.translate(-v.x, -v.y);
  const halfW = v.w / 2 / v.zoom, halfH = v.h / 2 / v.zoom;
  const left = v.x - halfW, right = v.x + halfW, top = v.y - halfH, bottom = v.y + halfH;
  const seen = (p: Pt, pad: number) => p.x > left - pad && p.x < right + pad && p.y > top - pad && p.y < bottom + pad;
  ctx.fillStyle = GRID_DOT;
  for (let x = Math.ceil(left / DOT_GAP) * DOT_GAP; x < right; x += DOT_GAP)
    for (let y = Math.ceil(top / DOT_GAP) * DOT_GAP; y < bottom; y += DOT_GAP)
      if (x * x + y * y < ARENA_RADIUS * ARENA_RADIUS) ctx.fillRect(x - 2, y - 2, 4, 4);
  ctx.strokeStyle = EDGE; ctx.lineWidth = 8 / v.zoom; ctx.beginPath(); ctx.arc(0, 0, ARENA_RADIUS, 0, Math.PI * 2); ctx.stroke();
  for (const o of arena.orbs.values()) {
    const r = orbRadius(o);
    if (!seen(o, r * 3)) continue;
    ctx.fillStyle = o.color + '40'; ctx.beginPath(); ctx.arc(o.x, o.y, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.fill();
  }
  for (const s of arena.snakes) if (s.alive && s.path.some(p => seen(p, radius(s) * 3)))
    snakeBody(ctx, s.path, s.heading, radius(s), s.look, s === me || s.boost);
  ctx.restore();
  if (!labels) return;
  ctx.font = LABEL_FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  for (const s of arena.snakes) if (s.alive && s.slot !== null && s !== me) {
    const p = toScreen(v, s.path[0]);
    if (p.x > v.ox && p.x < v.ox + v.w && p.y > v.oy && p.y < v.oy + v.h) ctx.fillText(s.look.name, p.x, p.y - radius(s) * v.zoom - 10);
  }
}

/** The minimap: the arena circle, players as dots (the viewer's bigger), others faint. */
export function drawMinimap(ctx: CanvasRenderingContext2D, arena: Arena, me?: Snake) {
  const half = MINI_SIZE / 2, k = (half - 4) / ARENA_RADIUS;
  ctx.clearRect(0, 0, MINI_SIZE, MINI_SIZE);
  ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.arc(half, half, half - 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = EDGE; ctx.lineWidth = 2; ctx.stroke();
  for (const s of arena.snakes) if (s.alive) {
    ctx.fillStyle = s.slot === null ? '#ffffff55' : s.look.color;
    ctx.beginPath(); ctx.arc(half + s.path[0].x * k, half + s.path[0].y * k, s === me ? 4 : s.slot === null ? 1.5 : 3, 0, Math.PI * 2); ctx.fill();
  }
}

/** The garage preview: a curled snake with this look. */
export function drawPreview(ctx: CanvasRenderingContext2D, look: SnakeLook) {
  const { width: w, height: h } = ctx.canvas, points: Pt[] = [];
  for (let i = 0; i < 26; i++) points.push({ x: w * 0.78 - i * SEGMENT * 1.2, y: h / 2 + Math.sin(i / 3.5) * h * 0.18 });
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
  snakeBody(ctx, points, Math.atan2(points[0].y - points[1].y, points[0].x - points[1].x), Math.min(h * 0.11, 14), look, true);
}
