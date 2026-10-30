// The overview map (specs/008-tank-focus-camera US3): the whole field drawn flat and small — the ground one pixel per
// cell, tanks and wrecks as dots in their colours, crates and shells — with a frame showing what the main view shows.
// Dragging the frame or tapping a spot (mouse, touch or pen) moves the main view there. Browser-only (end-to-end tested).
import { GRID_H, GRID_W, TANK_H, WORLD_H, WORLD_W } from './constants.ts';
import { Material } from './enums.ts';
import { fieldXOf, mapXOf, type View } from './camera.ts';
import type { Battle } from './sim.ts';
import type { Terrain } from './terrain.ts';

// cell colours (r, g, b), as the 2D look had them; earth's top cells are grass
const RGB: Record<number, [number, number, number]> = {
  [Material.Earth]: [150, 98, 58], [Material.Snow]: [246, 250, 255], [Material.Ice]: [182, 226, 245],
  [Material.Wood]: [168, 112, 60], [Material.Water]: [64, 150, 225],
};
const GRASS: [number, number, number] = [96, 186, 70];
const GRASS_CELLS = 2;

/** The overview map on `canvas`; `onLook(x)` is called with the field x a player drags or taps to. */
export function createOverview(canvas: HTMLCanvasElement, onLook: (x: number) => void) {
  const ctx = canvas.getContext('2d')!, layer = document.createElement('canvas');
  layer.width = GRID_W; layer.height = GRID_H;
  const lctx = layer.getContext('2d')!, img = lctx.createImageData(GRID_W, GRID_H);
  let terrain: Terrain | null = null, stale = true;

  function drawGround(t: Terrain) {
    const d = img.data;
    for (let gx = 0; gx < GRID_W; gx++) {
      let depth = 0; // cells since the last air above
      for (let gy = 0; gy < GRID_H; gy++) {
        const m = t.cells[gy * GRID_W + gx], i = (gy * GRID_W + gx) * 4;
        if (m === Material.Air) { d[i + 3] = 0; depth = 0; continue; }
        const rgb = m === Material.Earth && depth < GRASS_CELLS ? GRASS : RGB[m];
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
        if (m !== Material.Water) depth++;
      }
    }
    lctx.putImageData(img, 0, 0);
  }

  // dragging: the pointer's x across the map is where the main view centres
  let dragging = false;
  const look = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); onLook(fieldXOf(e.clientX - r.left, r.width)); };
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); dragging = true; canvas.setPointerCapture(e.pointerId); look(e); });
  canvas.addEventListener('pointermove', e => { if (dragging) look(e); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  return {
    /** The ground changed: redraw it on the next draw. */
    groundChanged: () => { stale = true; },
    draw(b: Battle, view: View, aspect: number) {
      const dpr = Math.min(devicePixelRatio, 2), w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      if (b.terrain !== terrain || stale) { terrain = b.terrain; stale = false; drawGround(terrain); }
      const kx = w / WORLD_W, ky = h / WORLD_H;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(20,40,70,0.55)'; ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(layer, 0, 0, w, h);
      for (const c of b.crates) { ctx.fillStyle = '#c8913e'; ctx.fillRect(c.x * kx - 2, c.y * ky - 4, 4, 4); }
      for (const t of b.tanks) {
        if (t.gone) continue;
        ctx.fillStyle = t.alive ? t.look.color : '#2e2b2b'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(t.x * kx, (t.y - TANK_H / 2) * ky, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      if (b.shell) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.shell.x * kx, Math.max(2, b.shell.y * ky), 2, 0, Math.PI * 2); ctx.fill(); }
      const halfH = view.halfW / aspect, x0 = mapXOf(view.cx - view.halfW, w), x1 = mapXOf(view.cx + view.halfW, w);
      const y0 = Math.max(0, (view.cy - halfH) * ky), y1 = Math.min(h, (view.cy + halfH) * ky);
      ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 2; ctx.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2);
    },
  };
}
