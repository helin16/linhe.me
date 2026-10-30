import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CELL, CHUNK_CELLS, GRID_H, GRID_W, GROUND_DEPTH, WORLD_H, WORLD_W } from './constants.ts';
import { GroundPart, MapId, Material } from './enums.ts';
import { CHUNKS, chunkMesh, dirtyChunks, type ChunkMesh, type PartMesh } from './ground.ts';
import { carve, type Terrain } from './terrain.ts';

/** A grid with `m` from row `top` down (an optional pocket of `pocket` in rows/columns given). */
function slab(top: number, m: number = Material.Earth) {
  const c = new Uint8Array(GRID_W * GRID_H);
  for (let j = top; j < GRID_H; j++) c.fill(m, j * GRID_W, (j + 1) * GRID_W);
  return c;
}
const all = (cells: Uint8Array, original = cells) => Array.from({ length: CHUNKS }, (_, i) => chunkMesh(cells, original, i));
const tris = (p: PartMesh | undefined) => (p?.positions.length ?? 0) / 9;
/** Faces towards the camera (normal +z) and walls (normal in the x/y plane) of one part, across chunks. */
function split(meshes: ChunkMesh[], part: GroundPart) {
  const front: number[][] = [], walls: number[][] = [];
  for (const m of meshes) {
    const p = m[part];
    if (!p) continue;
    for (let t = 0; t < p.positions.length / 9; t++) {
      const tri = [0, 1, 2].map(v => p.positions.slice(t * 9 + v * 3, t * 9 + v * 3 + 3));
      (p.normals[t * 9 + 2] === 1 ? front : walls).push([...tri.flat(), ...p.normals.slice(t * 9, t * 9 + 3)]);
    }
  }
  return { front, walls };
}
const area = (t: number[]) => Math.abs((t[3] - t[0]) * (t[7] - t[1]) - (t[4] - t[1]) * (t[6] - t[0])) / 2;

test('a flat field: grass and soil fronts cover it exactly, a grass top strip faces up', () => {
  const top = 150, meshes = all(slab(top));
  const fronts = [GroundPart.Grass, GroundPart.Soil].flatMap(p => split(meshes, p).front.filter(t => t[2] === GROUND_DEPTH / 2));
  const surface = WORLD_H - top * CELL; // marching squares meet halfway between cell centres: the cells' own top edge
  assert.ok(Math.abs(fronts.reduce((s, t) => s + area(t), 0) - WORLD_W * surface) < 1e-6, 'the front covers the solid ground exactly, once');
  const grass = split(meshes, GroundPart.Grass);
  assert.ok(grass.front.length > 0, 'grass along the top of the front');
  assert.ok(grass.walls.length > 0 && grass.walls.every(t => t[9] === 0 && t[10] === 1), 'the top strip faces straight up');
  assert.ok(grass.walls.every(t => [1, 4, 7].every(k => t[k] === surface)), 'at the surface');
  assert.ok(grass.walls.some(t => [t[2], t[5], t[8]].includes(-GROUND_DEPTH / 2)), 'running back through the depth');
  assert.equal(split(meshes, GroundPart.Soil).walls.length, 0, 'no walls at the sides or bottom');
  const xs = grass.walls.flatMap(t => [t[0], t[3], t[6]]);
  assert.deepEqual([Math.min(...xs), Math.max(...xs)], [0, WORLD_W], 'from edge to edge');
});

test('front faces face the camera and walls face away from the ground (winding agrees with the normal)', () => {
  const c = slab(150); carve({ cells: c, map: MapId.GreenHills } as Terrain, 800, 150 * CELL, 40);
  for (const m of all(c, slab(150))) for (const p of Object.values(m)) for (let t = 0; t < p.positions.length / 9; t++) {
    const v = [0, 1, 2].map(k => p.positions.slice(t * 9 + k * 3, t * 9 + k * 3 + 3)), n = p.normals.slice(t * 9, t * 9 + 3);
    const u = v[1].map((x, i) => x - v[0][i]), w = v[2].map((x, i) => x - v[0][i]);
    const cross = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    assert.ok(cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] > 0);
  }
});

test('no ground, no surfaces', () => {
  for (const m of all(new Uint8Array(GRID_W * GRID_H))) assert.deepEqual(m, {});
});

test('a crater shows soil, not grass: walls facing the hole are soil, even the ones facing up', () => {
  const original = slab(150), cells = slab(150);
  carve({ cells, map: MapId.GreenHills } as Terrain, 800, 150 * CELL, 40);
  const chunk = Math.floor((800 / CELL + 1) / CHUNK_CELLS), crater = chunkMesh(cells, original, chunk);
  const soilWalls = split([crater], GroundPart.Soil).walls;
  assert.ok(soilWalls.length > 0, 'the crater has soil walls');
  assert.ok(soilWalls.some(t => t[10] > 0.5), 'its floor faces up and is soil');
  const back = split([crater], GroundPart.Soil).front.filter(t => t[2] < 0);
  assert.ok(back.length > 0 && back.every(t => t[2] === -GROUND_DEPTH / 2 + 0.2), 'its back is soil where the ground was');
  assert.equal(split([chunkMesh(original, original, chunk)], GroundPart.Soil).front.filter(t => t[2] < 0).length, 0, 'untouched ground has no back');
  assert.ok(split([crater], GroundPart.Grass).walls.every(t => Math.abs(t[0] - 800) > 30 || Math.abs(t[3] - 800) > 30), 'grass stays outside it');
  assert.equal(split([chunkMesh(cells, cells, chunk)], GroundPart.Soil).walls.filter(t => t[10] > 0.5).length, 0,
    'compared with itself its floor is plain surface (grass)');
});

test('snow, ice and wood make their own fronts and walls; water its own front and surface; earth under snow has none', () => {
  for (const [m, part] of [[Material.Snow, GroundPart.Snow], [Material.Ice, GroundPart.Ice], [Material.Wood, GroundPart.Wood]] as const) {
    const c = slab(150); c.fill(m, 150 * GRID_W, 152 * GRID_W);
    const s = split(all(c), part);
    assert.ok(s.front.length > 0 && s.walls.length > 0, part);
    assert.equal(split(all(c), GroundPart.Grass).walls.length, 0, `${part}: the top strip is ${part}`);
  }
  const c = slab(150); for (let j = 150; j < 160; j++) c.fill(Material.Water, j * GRID_W + 100, j * GRID_W + 140);
  const w = all(c).map(m => m[GroundPart.Water]).filter(Boolean);
  assert.ok(w.length && w.every(p => tris(p) > 0) && w.every(p => p!.normals.every((v, i) => i % 3 !== 2 || v === 1)), 'water: front faces only');
});

test('a blast only changes the chunks dirtyChunks names', () => {
  const field = slab(120); for (let j = 120; j < 126; j++) field.fill(Material.Wood, j * GRID_W + 300, j * GRID_W + 330);
  for (const [x, r] of [[0, 40], [10, 40], [640, 40], [1220, 60], [WORLD_W - 1, 40], [WORLD_W / 2, 90]]) {
    const before = all(field), after = field.slice();
    carve({ cells: after, map: MapId.TimberGap } as Terrain, x, 120 * CELL, r);
    const changed = all(after, field).map((m, i) => JSON.stringify(m) !== JSON.stringify(before[i]) ? i : -1).filter(i => i >= 0);
    const dirty = dirtyChunks(x, r);
    assert.ok(changed.every(i => dirty.includes(i)), `x ${x}: changed ${changed} within ${dirty}`);
    assert.ok(dirty.every(i => i >= 0 && i < CHUNKS));
  }
  assert.deepEqual(dirtyChunks(-500, 10), [0], 'clamped to the field');
  assert.deepEqual(dirtyChunks(WORLD_W + 500, 10), [CHUNKS - 1]);
});
