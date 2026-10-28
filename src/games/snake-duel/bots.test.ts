import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_RADIUS, ARENA_SNAKES, BOT_RESPAWN_MS, SAFE_SPAWN } from './constants.ts';
import { Difficulty } from './enums.ts';
import { seeded } from './seed.ts';
import { defaults } from './settings.ts';
import { BOT_THINK_STEPS, botInput, botLook, driveBots, fillBots, safeSpawn } from './bots.ts';
import { addOrb, addSnake, createArena, knockOut, type Arena } from './sim.ts';

const look = defaults().players[0];
const arena = () => createArena(seeded(1));
const never = () => 0.99, always = () => 0;
const bot = (a: Arena, x: number, y: number, heading: number) => addSnake(a, null, botLook(0), { x, y, heading });

test('a bot turns toward the best nearby orb', () => {
  const a = arena(), b = bot(a, 0, 0, 0);
  addOrb(a, 0, 200, 3, '#fff'); // above it (+y): turn left (positive)
  assert.ok(botInput(a, b, Difficulty.Normal, never).turn! > 0);
  const c = arena(), d = bot(c, 0, 0, 0);
  addOrb(c, 0, -200, 3, '#fff');
  assert.ok(botInput(c, d, Difficulty.Normal, never).turn! < 0);
});

test('with no orbs in sight it wanders, turning only a little', () => {
  const a = arena(), b = bot(a, 0, 0, 0);
  assert.ok(Math.abs(botInput(a, b, Difficulty.Normal, () => 0.5).turn!) < 1e-9);
});

test('it turns away from a body ahead, and from the edge', () => {
  const a = arena(), b = bot(a, 0, 0, 0);
  const wall = addSnake(a, 1, look, { x: 120, y: 200, heading: -Math.PI / 2 }); // a body across its path
  wall.mass = 60; wall.path = Array.from({ length: 45 }, (_, i) => ({ x: 120, y: 200 - i * 9 }));
  addOrb(a, 400, 0, 5, '#fff'); // the orb it wants is behind the wall
  assert.notEqual(botInput(a, b, Difficulty.Normal, never).turn, 0);
  const e = arena(), f = bot(e, ARENA_RADIUS - 100, 0, 0); // heading straight at the edge
  assert.notEqual(botInput(e, f, Difficulty.Normal, never).turn, 0);
});

test('when nothing ahead is clear it turns hard', () => {
  const a = arena(), b = bot(a, ARENA_RADIUS - 70, 0, 0);
  assert.equal(Math.abs(botInput(a, b, Difficulty.Hard, never).turn!), 1);
});

test('Hard bots hunt a nearby player and boost when close; Easy ones turn away; boosts come by chance', () => {
  const a = arena(), b = bot(a, 0, 0, 0);
  addSnake(a, 0, look, { x: 200, y: 100, heading: 0 });
  const hunt = botInput(a, b, Difficulty.Hard, never);
  assert.ok(hunt.turn! > 0 && hunt.boost); // toward the point ahead of the player, boosting
  const easy = botInput(a, b, Difficulty.Easy, never);
  assert.ok(easy.turn! < 0 && !easy.boost); // away from the player
  const c = arena(), d = bot(c, 0, 0, 0);
  addOrb(c, 100, 0, 1, '#fff');
  assert.equal(botInput(c, d, Difficulty.Normal, always).boost, true);
  assert.equal(botInput(c, d, Difficulty.Normal, never).boost, false);
});

test('the arena is filled to 20 snakes; computer snakes come back after a while; still ones are parked', () => {
  const a = arena();
  addSnake(a, 0, look, { x: 0, y: 0, heading: 0 });
  fillBots(a, true);
  assert.equal(a.snakes.length, ARENA_SNAKES);
  assert.ok(a.snakes.filter(s => s.slot === null).every(s => s.still));
  const b = a.snakes[1];
  knockOut(a, b, { eaten: [], added: [], out: [] });
  fillBots(a, true);
  assert.equal(b.alive, false);
  a.time += BOT_RESPAWN_MS;
  fillBots(a, true);
  assert.equal(b.alive, true);
  assert.equal(a.snakes.length, ARENA_SNAKES);
  assert.notDeepEqual(botLook(0), botLook(1));
});

test('bots decide again every BOT_THINK_STEPS steps; parked ones never get an input', () => {
  const a = arena(), b = bot(a, 0, 0, 0), parked = bot(a, 500, 500, 0);
  parked.still = true;
  addOrb(a, 0, 200, 3, '#fff');
  const memory = driveBots(a, Difficulty.Normal, never, 0, new Map());
  assert.ok(memory.has(b.id) && !memory.has(parked.id));
  memory.delete(b.id);
  driveBots(a, Difficulty.Normal, never, 1, memory);
  assert.ok(!memory.has(b.id)); // not a thinking step
  driveBots(a, Difficulty.Normal, never, BOT_THINK_STEPS, memory);
  assert.ok(memory.has(b.id));
});

test('a Hard bot hunts the nearer of two players', () => {
  const a = arena(), b = bot(a, 0, 0, 0);
  addSnake(a, 1, look, { x: 500, y: -300, heading: 0 }); // farther, below-right (negative turn)
  addSnake(a, 0, look, { x: 150, y: 120, heading: 0 });  // nearer, above-right (positive turn)
  assert.ok(botInput(a, b, Difficulty.Hard, never).turn! > 0);
});

test('computer snakes never appear next to a player', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const a = createArena(seeded(seed)), me = addSnake(a, 0, look, { x: 0, y: 0, heading: 0 });
    fillBots(a, false);
    for (const s of a.snakes) if (s !== me) assert.ok(Math.hypot(s.path[0].x, s.path[0].y) >= SAFE_SPAWN, `seed ${seed}`);
  }
  // crowded: no spot is far enough, so it takes the farthest it found
  const c = createArena(seeded(1));
  for (let i = 0; i < 60; i++) addSnake(c, i, look, { x: Math.cos(i) * 1500 * Math.sqrt(i / 60), y: Math.sin(i) * 1500 * Math.sqrt(i / 60), heading: 0 });
  const p = safeSpawn(c);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.heading));
});
