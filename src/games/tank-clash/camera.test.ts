import { test } from 'node:test';
import assert from 'node:assert/strict';
import { values } from '../../shared/enum.ts';
import { CLOSE_HALF_W, FOLLOW_BAND, LOOK_STEP, MAX_STEP, STEP_HZ, WORLD_H, WORLD_W } from './constants.ts';
import { clampView, fieldXOf, followView, glide, heldView, lookStep, mapXOf, shotView, wholeHalfW, wholeView, type View } from './camera.ts';
import { MapId, Side, TankType, Variant } from './enums.ts';
import { seeded } from './seed.ts';
import { createBattle, Flying, flyStep, makeShell, tiltOf } from './sim.ts';
import { specOf } from './tanks.ts';

const ASPECTS = [16 / 9, 19.5 / 9, 4 / 3, 9 / 19.5]; // desktop, a phone sideways, an iPad, a phone upright
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const inside = (v: View, x: number, y: number, aspect: number) =>
  Math.abs(x - v.cx) <= v.halfW + 1e-6 && Math.abs(y - v.cy) <= v.halfW / aspect + 1e-6;

test('the whole field fits both ways on every screen shape', () => {
  for (const a of ASPECTS) {
    const w = wholeView(a), halfH = w.halfW / a;
    assert.equal(w.halfW, Math.max(WORLD_W / 2, WORLD_H / 2 * a));
    assert.equal(wholeHalfW(a), w.halfW);
    assert.ok(w.halfW >= WORLD_W / 2 && halfH >= WORLD_H / 2 - 1e-9, `${a}: all of it`);
    assert.ok(near(w.halfW, WORLD_W / 2) || near(halfH, WORLD_H / 2), `${a}: and no more than needed`);
    assert.deepEqual([w.cx, w.cy], [WORLD_W / 2, WORLD_H / 2]);
  }
});

test('clampView keeps the view inside the field and between the close and whole views', () => {
  for (const a of ASPECTS) {
    for (const v of [{ cx: -500, cy: -500, halfW: 10 }, { cx: 5000, cy: 5000, halfW: 99999 }, { cx: 30, cy: WORLD_H, halfW: CLOSE_HALF_W }]) {
      const c = clampView(v, a), halfH = c.halfW / a;
      assert.ok(c.halfW >= CLOSE_HALF_W && c.halfW <= wholeHalfW(a));
      if (c.halfW < WORLD_W / 2) assert.ok(c.cx - c.halfW >= -1e-9 && c.cx + c.halfW <= WORLD_W + 1e-9, 'not past the sides');
      else assert.equal(c.cx, WORLD_W / 2);
      if (halfH < WORLD_H / 2) assert.ok(c.cy + halfH <= WORLD_H + 1e-9 && c.cy - halfH >= -1e-9, 'not past the bottom or top');
      else assert.equal(c.cy, WORLD_H / 2);
    }
  }
});

test('follow: a new turn centres on the tank at the close view; driving moves the view only past the middle third', () => {
  const a = 16 / 9, start = followView({ x: 800, y: 600 }, null, a);
  assert.deepEqual([start.cx, start.halfW], [800, CLOSE_HALF_W]);
  assert.ok(start.cy < 600, 'the tank sits low, room above for the shot');
  const band = CLOSE_HALF_W * FOLLOW_BAND;
  assert.equal(followView({ x: 800 + band - 1, y: 600 }, start, a).cx, 800, 'inside the band: the view stays');
  assert.equal(followView({ x: 800 + band + 30, y: 600 }, start, a).cx, 830, 'past it: the view moves just enough');
  assert.equal(followView({ x: 900, y: 600 }, { ...start, halfW: 700 }, a).cx, 900, 'after a wider shot view: centre again');
  assert.equal(followView({ x: 10, y: 600 }, null, a).cx, CLOSE_HALF_W, 'at the field’s edge it stops at the edge');
  for (const asp of ASPECTS) assert.equal(followView({ x: 800, y: 600 }, null, asp).halfW, CLOSE_HALF_W, 'half the field wide on every screen');
});

test('glide: within 1% of the target in under a second, no jumps bigger than MAX_STEP a frame, a jump with reduced motion', () => {
  const dt = 1 / STEP_HZ, cases: [View, View][] = [
    [{ cx: 400, cy: 600, halfW: CLOSE_HALF_W }, { cx: 1200, cy: 600, halfW: CLOSE_HALF_W }], // a turn change across the field
    [{ cx: 800, cy: 450, halfW: wholeHalfW(19.5 / 9) }, { cx: 300, cy: 650, halfW: CLOSE_HALF_W }], // after a whole-field shot view
  ];
  for (const [from, to] of cases) {
    let v = from, frames = 0;
    const far = () => Math.max(Math.abs(v.cx - to.cx) / Math.abs(from.cx - to.cx || 1), Math.abs(v.halfW - to.halfW) / Math.abs(from.halfW - to.halfW || 1));
    while (far() > 0.01 && frames < 600) {
      const next = glide(v, to, dt, false);
      assert.ok(Math.abs(next.cx - v.cx) <= MAX_STEP * 2 * v.halfW + 1e-9 && Math.abs(next.halfW - v.halfW) * 2 <= MAX_STEP * 2 * v.halfW + 1e-9, 'no jump');
      v = next; frames++;
    }
    assert.ok(frames <= STEP_HZ, `settled in ${frames} frames`);
  }
  assert.deepEqual(glide(cases[0][0], cases[0][1], dt, true), cases[0][1], 'reduced motion: straight there');
  const tracked = glide(cases[0][0], { ...cases[0][0], cx: cases[0][0].cx + 10 }, dt, false, true);
  assert.equal(tracked.cx, cases[0][0].cx + 10, 'tracking: a small move is made at once');
  assert.equal(glide(cases[0][0], cases[0][1], dt, false, true).cx, cases[0][0].cx + MAX_STEP * 2 * CLOSE_HALF_W, 'a big one still only by the cap');
});

test('a shot: the smallest view holding tank and shell, never shrinking mid-flight, capped at the whole field', () => {
  const a = 16 / 9, start = followView({ x: 300, y: 600 }, null, a);
  const v = shotView({ x: 300, y: 600 }, { x: 330, y: 590 }, start, a);
  assert.equal(v.halfW, CLOSE_HALF_W, 'a short shot keeps the close view');
  const far = shotView({ x: 300, y: 600 }, { x: 1300, y: 300 }, start, a);
  assert.ok(far.halfW >= 500 + 80 && inside(far, 300, 600, a) && inside(far, 1300, 300, a));
  assert.equal(shotView({ x: 300, y: 600 }, { x: 900, y: 600 }, far, a).halfW, far.halfW, 'never narrower than before during the flight');
  assert.ok(shotView({ x: 0, y: 900 }, { x: 1600, y: -2000 }, start, a).halfW <= wholeHalfW(a), 'a shell above the field: no wider than the whole field');
});

test('every shot of every tank type stays on screen with its tank, frame by frame (008 SC-002)', () => {
  for (const aspect of ASPECTS) for (const type of values(TankType)) for (const side of [Side.Left, Side.Right]) {
    const look = { name: 'T', color: '#ffffff', type, variant: Variant.B, side };
    const b = createBattle(seeded(3), MapId.GreenHills, [{ side: Side.Left, owner: null, look }, { side: Side.Right, owner: null, look }]);
    const t = b.tanks[side === Side.Left ? 0 : 1], spec = specOf(look), tilt = tiltOf(b, t);
    for (let angle = spec.minAngle; angle <= spec.maxAngle; angle += 15) for (let power = 10; power <= spec.topPower; power += 15) {
      for (const missile of [false, true]) {
        t.missile = missile;
        const s = makeShell(t, angle, power, 0, tilt);
        let target = followView(t, null, aspect), view = target;
        for (let i = 0; i < 2000; i++) {
          const r = flyStep(b, s, 1 / STEP_HZ);
          if (r !== Flying.On) break;
          target = shotView(t, s, target, aspect); view = glide(view, target, 1 / STEP_HZ, false, true);
          if (s.y < 0) continue; // above the field: the view goes no wider than the whole field
          assert.ok(inside(view, s.x, s.y, aspect) && inside(view, t.x, t.y, aspect),
            `${type} ${side} ${angle}° power ${power}${missile ? ' missile' : ''} aspect ${aspect.toFixed(2)}: frame ${i}`);
        }
      }
    }
  }
});

test('looking around: the overview map and [ ] move the view at the same zoom, inside the field', () => {
  const a = 16 / 9, v = followView({ x: 800, y: 600 }, null, a);
  assert.deepEqual(heldView(1400, v, a), { ...v, cx: WORLD_W - CLOSE_HALF_W });
  assert.equal(heldView(500, v, a).cx, 500);
  assert.equal(lookStep(v, 1, a).cx, 800 + LOOK_STEP);
  assert.equal(lookStep({ ...v, cx: CLOSE_HALF_W }, -1, a).cx, CLOSE_HALF_W, 'stops at the edge');
  assert.equal(fieldXOf(100, 200), WORLD_W / 2);
  assert.deepEqual([fieldXOf(-5, 200), fieldXOf(500, 200)], [0, WORLD_W]);
  assert.equal(mapXOf(WORLD_W / 4, 200), 50);
  assert.deepEqual([mapXOf(-1, 200), mapXOf(WORLD_W * 2, 200)], [0, 200]);
});
