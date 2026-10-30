import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Detail, detailProbe } from './detail.ts';

const run = (p: ReturnType<typeof detailProbe>, fps: number, seconds: number, drew = true) => {
  let dropped = false;
  for (let i = 0; i < Math.round(fps * seconds); i++) dropped = p.frame(1 / fps, drew) || dropped;
  return dropped;
};

test('full until asked to measure', () => {
  const p = detailProbe(2, 55);
  assert.equal(p.detail, Detail.Full);
  assert.equal(run(p, 10, 3), false); // slow, but nobody asked
  assert.equal(p.detail, Detail.Full);
});

test('a fast device stays full, a slow one drops to low once', () => {
  const fast = detailProbe(2, 55);
  fast.restart(); assert.equal(fast.detail, Detail.Probing);
  assert.equal(run(fast, 60, 1), false); assert.equal(fast.detail, Detail.Probing);
  assert.equal(run(fast, 60, 1.5), false); assert.equal(fast.detail, Detail.Full);
  const slow = detailProbe(2, 55);
  slow.restart();
  assert.equal(run(slow, 30, 2.5), true);
  assert.equal(slow.detail, Detail.Low);
  assert.equal(run(slow, 30, 1), false); // drops once only
});

test('frames that drew nothing, and the frame after one, are not counted', () => {
  const p = detailProbe(2, 55);
  p.restart();
  run(p, 10, 5, false); // idle: nothing counted
  assert.equal(p.detail, Detail.Probing);
  for (let i = 0; i < 200; i++) { p.frame(0.1, i % 2 === 0); } // never two drawn frames in a row
  assert.equal(p.detail, Detail.Probing);
  for (let i = 0; i < 200; i++) { p.skip(); p.frame(0.1, true); } // every frame skipped
  assert.equal(p.detail, Detail.Probing);
});

test('restart measures again only while not low; lower forces low', () => {
  const p = detailProbe();
  p.restart(); run(p, 60, 3); assert.equal(p.detail, Detail.Full);
  p.restart(); assert.equal(p.detail, Detail.Probing);
  p.lower(); assert.equal(p.detail, Detail.Low);
  p.restart(); assert.equal(p.detail, Detail.Low);
});
