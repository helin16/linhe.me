import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CELL, GRID_H, GRID_W, HILL_MAX_H, TANK_W, WORLD_H, WORLD_W } from './constants.ts';
import { MapId, Material } from './enums.ts';
import { seeded } from './seed.ts';
import { build, carve, cellAt, generate, groundBelow, isSolid, PLAYABLE_MAPS, startSpots, surfaceAt, type Terrain } from './terrain.ts';

const count = (t: Terrain, m: Material) => t.cells.reduce((n, c) => n + (c === m ? 1 : 0), 0);
// runs of columns whose top is a material (lakes, snow areas, gaps)
function runs(t: Terrain, is: (x: number) => boolean) {
  let n = 0, inRun = false;
  for (let gx = 0; gx < GRID_W; gx++) { const on = is((gx + 0.5) * CELL); if (on && !inRun) n++; inRun = on; }
  return n;
}

test('the same seed builds the same battlefield; different seeds differ', () => {
  for (const map of PLAYABLE_MAPS) {
    assert.deepEqual(build(seeded(3), map).cells, build(seeded(3), map).cells, map);
    assert.notDeepEqual(build(seeded(3), map).cells, build(seeded(4), map).cells, map);
  }
});

test('no hill rises above half the field; there is ground everywhere on Green Hills', () => {
  for (let s = 1; s <= 30; s++) {
    const t = build(seeded(s), MapId.GreenHills);
    for (let gx = 0; gx < GRID_W; gx++) {
      const top = surfaceAt(t, (gx + 0.5) * CELL)!;
      assert.ok(top.y >= WORLD_H * (1 - HILL_MAX_H) - CELL, `seed ${s} col ${gx}`);
      assert.equal(top.m, Material.Earth);
    }
  }
});

test('Timber Gap: 1–2 gaps to the bottom, each crossed by a wooden bridge', () => {
  for (let s = 1; s <= 20; s++) {
    const t = build(seeded(s), MapId.TimberGap);
    const bridges = runs(t, x => surfaceAt(t, x)?.m === Material.Wood);
    assert.ok(bridges >= 1 && bridges <= 2, `seed ${s}: ${bridges}`);
    const x = [...Array(GRID_W).keys()].map(g => (g + 0.5) * CELL).find(x => surfaceAt(t, x)?.m === Material.Wood)!;
    const below = groundBelow(t, x, surfaceAt(t, x)!.y + 2 * CELL);
    assert.equal(below, null, 'nothing under the bridge');
  }
});

test('Lake Valley: 1–3 lakes, never spilling off the field', () => {
  let some = 0;
  for (let s = 1; s <= 20; s++) {
    const t = build(seeded(s), MapId.LakeValley);
    const lakes = runs(t, x => surfaceAt(t, x)?.m === Material.Water);
    assert.ok(lakes <= 3, `seed ${s}`);
    assert.notEqual(surfaceAt(t, CELL / 2)!.m, Material.Water);
    assert.notEqual(surfaceAt(t, WORLD_W - CELL / 2)!.m, Material.Water);
    if (lakes) some++;
  }
  assert.ok(some >= 15, 'most seeds have a lake');
});

test('Frost Ridge: 1–3 snow areas, some with ice', () => {
  let ice = 0;
  for (let s = 1; s <= 20; s++) {
    const t = build(seeded(s), MapId.FrostRidge);
    assert.ok(count(t, Material.Snow) > 0, `seed ${s}`);
    if (count(t, Material.Ice)) ice++;
    assert.equal(count(t, Material.Water) + count(t, Material.Wood), 0);
  }
  assert.ok(ice > 0 && ice < 20);
});

test('carving clears within the radius, wood within a bigger one, never water; it can reach the bottom', () => {
  const t = build(seeded(1), MapId.GreenHills), x = 400, top = surfaceAt(t, x)!.y;
  carve(t, x, top + 20, 30);
  assert.equal(cellAt(t, x, top + 20), Material.Air);
  assert.ok(isSolid(cellAt(t, x + 60, top + 20)), 'outside the radius');
  for (let y = top; y < WORLD_H + 40; y += 40) carve(t, x, y, 40);
  assert.equal(groundBelow(t, x, 0), null, 'a hole to the bottom');

  const w = build(seeded(1), MapId.GreenHills);
  w.cells.fill(Material.Wood, 100 * GRID_W, 101 * GRID_W);
  w.cells.fill(Material.Water, 102 * GRID_W, 103 * GRID_W);
  carve(w, 200, 100 * CELL + 2, 20);
  assert.equal(cellAt(w, 200 + 25, 100 * CELL + 2), Material.Air, 'wood at 1.25 r breaks');
  carve(w, 200, 102 * CELL + 2, 20);
  assert.equal(cellAt(w, 200, 102 * CELL + 2), Material.Water, 'water stays');
  assert.equal(cellAt(w, -5, 10), Material.Air);
  assert.equal(groundBelow(w, -5, 0), null);
});

test('start spots: in their halves, apart, never on or next to water; null when they cannot fit', () => {
  for (const map of PLAYABLE_MAPS) for (let s = 1; s <= 10; s++) {
    const { terrain, spots } = generate(seeded(s), map, 5, 5);
    assert.equal(spots.length, 10);
    spots.slice(0, 5).forEach(x => assert.ok(x < WORLD_W / 2));
    spots.slice(5).forEach(x => assert.ok(x > WORLD_W / 2));
    for (const a of spots) for (const b of spots) if (a !== b) assert.ok(Math.abs(a - b) >= TANK_W);
    for (const x of spots) for (let cx = x - TANK_W; cx <= x + TANK_W; cx += CELL)
      assert.notEqual(surfaceAt(terrain, cx)?.m, Material.Water, `${map} ${s}`);
  }
  const flat = build(seeded(1), MapId.GreenHills);
  assert.equal(startSpots(flat, seeded(1), 40, 0), null, 'too many for a half');
});

test('when nothing fits, a flat field with evenly spread spots', () => {
  const { terrain, spots } = generate(seeded(1), MapId.LakeValley, 30, 30);
  assert.equal(spots.length, 60);
  assert.equal(terrain.map, MapId.GreenHills);
  assert.equal(surfaceAt(terrain, 10)!.y, surfaceAt(terrain, WORLD_W - 10)!.y);
  assert.ok(GRID_H > 0);
});
