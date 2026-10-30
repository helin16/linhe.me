// The battle camera (specs/008-tank-focus-camera; specs/009-tank-semi-3d research R7): where the view should be for
// a turn (close on the tank in turn), a shot (the firing tank and the shell), a player looking around, or the end (the
// whole field); kept inside the field and glided there without jumps. Pure: views are in field units (sim axes, y
// down), and every function takes the screen's aspect (width ÷ height), since that decides how tall a view is.
import { CLOSE_HALF_W, FOLLOW_BAND, GLIDE_S, LOOK_STEP, MAX_STEP, SHOT_PAD, STEP_HZ, WORLD_H, WORLD_W } from './constants.ts';

/** The part of the field shown: its centre and half its width (half its height is halfW ÷ aspect). */
export type View = { cx: number; cy: number; halfW: number };
type Point = { x: number; y: number };
const TANK_LOW = 1 / 3; // the tank in turn sits this share of half the view's height below its middle

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Half the width that shows the whole field, both its width and its height. */
export const wholeHalfW = (aspect: number) => Math.max(WORLD_W / 2, (WORLD_H / 2) * aspect);

/** A view kept inside the field: no closer than the close view, no wider than the whole field, never past its sides,
 *  top or bottom (centred where it is wider or taller than the field). */
export function clampView(v: View, aspect: number): View {
  const halfW = clamp(v.halfW, CLOSE_HALF_W, wholeHalfW(aspect)), halfH = halfW / aspect;
  return {
    cx: halfW >= WORLD_W / 2 ? WORLD_W / 2 : clamp(v.cx, halfW, WORLD_W - halfW),
    cy: halfH >= WORLD_H / 2 ? WORLD_H / 2 : clamp(v.cy, halfH, WORLD_H - halfH),
    halfW,
  };
}
/** The whole field (008 FR-013). */
export const wholeView = (aspect: number) => clampView({ cx: WORLD_W / 2, cy: WORLD_H / 2, halfW: wholeHalfW(aspect) }, aspect);

/** The close view on the tank in turn (008 FR-001, FR-002). A new turn (`prev` null, or a wider view) centres on it;
 *  after that the view only moves sideways when the tank leaves its middle third. The tank sits a little low, leaving
 *  room above for its shot. */
export function followView(tank: Point, prev: View | null, aspect: number): View {
  const halfW = CLOSE_HALF_W, cy = tank.y - (halfW / aspect) * TANK_LOW, band = halfW * FOLLOW_BAND;
  const cx = !prev || prev.halfW !== halfW ? tank.x : clamp(prev.cx, tank.x - band, tank.x + band);
  return clampView({ cx, cy, halfW }, aspect);
}

/** The smallest view holding the firing tank and the shell, with room around them, never narrower than `prev` while
 *  the shell flies (so it doesn't pump in and out) and never wider than the whole field (008 FR-003). */
export function shotView(tank: Point, shell: Point, prev: View, aspect: number): View {
  const need = Math.max(Math.abs(shell.x - tank.x) / 2 + SHOT_PAD, (Math.abs(shell.y - tank.y) / 2 + SHOT_PAD) * aspect);
  return clampView({ cx: (tank.x + shell.x) / 2, cy: (tank.y + shell.y) / 2, halfW: Math.max(prev.halfW, need) }, aspect);
}

/** One frame of gliding towards a target: eased, but never moving the centre or changing the width by more than
 *  MAX_STEP of the view's width per 60th of a second (no jumps: 008 FR-002); with reduced motion it jumps (FR-010).
 *  `track` drops the easing (keeping the cap), for following a fast shell without trailing behind it. */
export function glide(view: View, target: View, dt: number, reduced: boolean, track = false): View {
  if (reduced) return target;
  const k = track ? 1 : 1 - Math.exp(-dt / GLIDE_S), cap = MAX_STEP * 2 * view.halfW * dt * STEP_HZ;
  const step = (from: number, to: number, max: number) => from + clamp((to - from) * k, -max, max);
  return { cx: step(view.cx, target.cx, cap), cy: step(view.cy, target.cy, cap), halfW: step(view.halfW, target.halfW, cap / 2) };
}

/** A player moved the view to centre on field x (the overview map): same zoom, kept inside the field. */
export const heldView = (cx: number, view: View, aspect: number) => clampView({ ...view, cx }, aspect);
/** `[` or `]`: the view moves LOOK_STEP left (−1) or right (1). */
export const lookStep = (view: View, dir: number, aspect: number) => clampView({ ...view, cx: view.cx + dir * LOOK_STEP }, aspect);

/** Between a point across the overview map (pixels, the map `width` wide) and field x. */
export const fieldXOf = (px: number, width: number) => clamp(px / width * WORLD_W, 0, WORLD_W);
export const mapXOf = (x: number, width: number) => clamp(x / WORLD_W * width, 0, width);
