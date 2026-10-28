import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_RADIUS, BOOST_COST, BOOST_SPEED, MAX_MASS, ORB_TARGET, ORB_TOPUP, OUT_ORB_SIZE, QUICK_MS, REJOIN_MS, SEGMENT, SPEED, START_LENGTH,
  STEP_HZ, TURN_RATE, WIN_ROUNDS,
} from './constants.ts';
import { MatchState, MatchType } from './enums.ts';
import { seeded } from './seed.ts';
import { defaults } from './settings.ts';
import {
  addOrb, addSnake, createArena, createMatch, knockOut, leadOrbs, nextRound, orbRadius, playerStarts, radius, randomPoint, segments,
  spawnPoint, step, topUp, updateMatch, type Arena, type Input,
} from './sim.ts';

const DT = 1 / STEP_HZ;
const look = defaults().players[0];
const empty = () => { const a = createArena(seeded(1)); return a; };
const run = (a: Arena, inputs: Map<number, Input>, steps: number) => { for (let i = 0; i < steps; i++) step(a, inputs, DT); };
const near = (x: number, y: number, eps = 1e-6) => assert.ok(Math.abs(x - y) < eps, `${x} ≈ ${y}`);

test('players start in fixed places: 1 in the centre facing right, 2 facing each other, online around a ring', () => {
  assert.deepEqual(playerStarts(1), [{ x: 0, y: 0, heading: 0 }]);
  const [a, b] = playerStarts(2);
  assert.ok(a.x < 0 && b.x > 0 && a.y === 0 && b.y === 0 && a.heading === 0 && b.heading === Math.PI);
  const ring = playerStarts(5);
  assert.equal(ring.length, 5);
  for (const p of ring) near(Math.hypot(p.x, p.y), Math.hypot(ring[0].x, ring[0].y));
});

test('a new snake lies straight behind its head, START_LENGTH segments long', () => {
  const a = empty(), s = addSnake(a, 0, look, { x: 0, y: 0, heading: 0 });
  assert.equal(s.path.length, START_LENGTH + 1);
  assert.equal(segments(s), START_LENGTH);
  near(s.path[1].x, -SEGMENT); near(s.path[START_LENGTH].x, -SEGMENT * START_LENGTH);
  const bot = addSnake(a, null, look); // anywhere open
  assert.ok(Math.hypot(bot.path[0].x, bot.path[0].y) < ARENA_RADIUS);
});

test('the lead orbs lie straight ahead, so going straight eats them', () => {
  const a = empty(), at = playerStarts(1)[0], s = addSnake(a, 0, look, at);
  leadOrbs(a, at);
  assert.equal(a.orbs.size, 5);
  for (const o of a.orbs.values()) assert.ok(o.y === 0 && o.x > 0);
  run(a, new Map(), STEP_HZ * 2);
  assert.ok(segments(s) >= START_LENGTH + 5);
});

test('snakes move at SPEED and turn at most TURN_RATE toward a target, or by a key turn rate', () => {
  const a = empty(), s = addSnake(a, 0, look, { x: 0, y: 0, heading: 0 });
  step(a, new Map(), DT);
  near(s.path[0].x, SPEED * DT);
  step(a, new Map([[s.id, { target: Math.PI / 2 }]]), DT);
  near(s.heading, TURN_RATE * DT);
  const before = s.heading;
  step(a, new Map([[s.id, { target: before + 0.001 }]]), DT); // a small correction: reached at once
  near(s.heading, before + 0.001);
  step(a, new Map([[s.id, { turn: -5 }]]), DT); // a key turn is clamped to full rate
  near(s.heading, before + 0.001 - TURN_RATE * DT);
});

test('the body keeps points about SEGMENT apart and the snake its length', () => {
  const a = empty(), s = addSnake(a, 0, look, { x: 0, y: 0, heading: 0 });
  run(a, new Map([[s.id, { turn: 1 }]]), STEP_HZ);
  assert.equal(s.path.length, START_LENGTH + 1);
  for (let i = 2; i < s.path.length; i++) near(Math.hypot(s.path[i].x - s.path[i - 1].x, s.path[i].y - s.path[i - 1].y), SEGMENT, 1.5);
});

test('a snake stops growing at MAX_MASS', () => {
  const a = empty(), s = addSnake(a, 0, look, { x: 0, y: 0, heading: 0 });
  s.mass = MAX_MASS - 1;
  addOrb(a, 3, 0, 5, '#ffffff');
  step(a, new Map(), DT);
  assert.equal(s.mass, MAX_MASS);
});

test('eating an orb adds its size', () => {
  const a = empty(), s = addSnake(a, 0, look, { x: 0, y: 0, heading: 0 });
  addOrb(a, 3, 0, 4, '#ffffff');
  const ev = step(a, new Map(), DT);
  assert.equal(segments(s), START_LENGTH + 4);
  assert.equal(ev.eaten.length, 1);
});

test('boost goes faster, costs length (dropped as orbs) and stops at the start length', () => {
  const a = empty(), s = addSnake(a, 0, look, { x: 0, y: 0, heading: 0 });
  s.mass = START_LENGTH + 2;
  const x0 = s.path[0].x, boost = new Map([[s.id, { boost: true }]]);
  step(a, boost, DT);
  assert.ok(s.boost);
  near(s.path[0].x - x0, BOOST_SPEED * DT);
  near(s.mass, START_LENGTH + 2 - BOOST_COST * DT);
  run(a, boost, STEP_HZ); // a second: costs 4, but only 2 to spend
  near(s.mass, START_LENGTH);
  assert.equal(s.boost, false);
  assert.ok([...a.orbs.values()].some(o => o.color === look.color)); // dropped behind
  step(a, boost, DT);
  assert.equal(s.boost, false); // no boost at the start length
});

test('leaving the arena takes a snake out and its body turns into orbs', () => {
  const a = empty(), s = addSnake(a, 0, look, { x: ARENA_RADIUS - 1, y: 0, heading: 0 });
  const ev = step(a, new Map(), DT);
  assert.equal(s.alive, false);
  assert.deepEqual(ev.out, [s.id]);
  assert.ok(ev.added.some(o => o.size === OUT_ORB_SIZE && o.color === look.color));
  step(a, new Map(), DT); // out snakes don't move
  assert.ok(s.path[0].x > ARENA_RADIUS - 1);
});

test("a head on another snake's body is out; the body's owner is fine; a snake's own body is harmless", () => {
  const a = empty();
  const wall = addSnake(a, 1, look, { x: 0, y: 40, heading: -Math.PI / 2 }); // body lies along y = 40 … 130
  const hitter = addSnake(a, 0, look, { x: -radius(wall) * 3, y: 60, heading: 0 });
  run(a, new Map([[wall.id, { turn: 0 }]]), 1); // wall moves down a little
  wall.path.forEach(p => { p.x = 0; }); // keep the wall straight on x = 0 for the test
  run(a, new Map(), 20);
  assert.equal(hitter.alive, false);
  assert.equal(wall.alive, true);

  const b = empty(), coil = addSnake(b, 0, look, { x: 0, y: 0, heading: 0 });
  coil.mass = 80;
  run(b, new Map([[coil.id, { turn: 1 }]]), STEP_HZ * 3); // circles over its own body
  assert.equal(coil.alive, true);
});

test('head to head: both are out', () => {
  const a = empty();
  const one = addSnake(a, 0, look, { x: -30, y: 0, heading: 0 }), two = addSnake(a, 1, look, { x: 30, y: 0, heading: Math.PI });
  run(a, new Map(), 20);
  assert.equal(one.alive, false);
  assert.equal(two.alive, false);
});

test('orbs are topped up to ORB_TARGET, a few per step, inside the arena', () => {
  const a = empty();
  topUp(a);
  assert.equal(a.orbs.size, ORB_TOPUP);
  run(a, new Map(), Math.ceil(ORB_TARGET / ORB_TOPUP) + 2);
  assert.equal(a.orbs.size, ORB_TARGET);
  for (const o of a.orbs.values()) assert.ok(Math.hypot(o.x, o.y) + orbRadius(o) <= ARENA_RADIUS);
});

test('the same seed gives the same arena', () => {
  const build = () => {
    const a = createArena(seeded(3));
    for (let i = 0; i < 3; i++) addSnake(a, null, look);
    run(a, new Map(), 30);
    return JSON.stringify([a.snakes.map(s => s.path[0]), [...a.orbs.values()].slice(0, 20)]);
  };
  assert.equal(build(), build());
  const p = randomPoint(createArena(seeded(4)), 100);
  assert.ok(Math.hypot(p.x, p.y) <= ARENA_RADIUS - 100);
  assert.ok(Number.isFinite(spawnPoint(createArena(seeded(5))).heading));
});

// --- matches ---

const duo = () => {
  const a = empty(), [s1, s2] = playerStarts(2);
  return { a, p1: addSnake(a, 0, look, s1), p2: addSnake(a, 1, look, s2), bot: addSnake(a, null, look) };
};
const ev = () => ({ eaten: [], added: [], out: [] });

test('Deathmatch: the last player in wins the round; computer snakes do not count', () => {
  const { a, p2, bot } = duo(), m = createMatch(MatchType.Deathmatch, [0, 1]);
  assert.equal(updateMatch(m, a, 16), null);
  knockOut(a, bot, ev());
  assert.equal(updateMatch(m, a, 16), null);
  knockOut(a, p2, ev());
  assert.deepEqual(updateMatch(m, a, 16), { over: MatchState.RoundOver, winner: 0 });
  assert.equal(m.wins.get(0), 1);
  assert.equal(updateMatch(m, a, 16), null); // nothing more until the next round
  nextRound(m);
  assert.deepEqual([m.round, m.state], [2, MatchState.Playing]);
});

test('Deathmatch: both out together is a draw; first to WIN_ROUNDS takes the match', () => {
  const d = duo(), m = createMatch(MatchType.Deathmatch, [0, 1]);
  knockOut(d.a, d.p1, ev()); knockOut(d.a, d.p2, ev());
  assert.deepEqual(updateMatch(m, d.a, 16), { over: MatchState.RoundOver, winner: null });
  for (let r = 0; r < WIN_ROUNDS; r++) {
    nextRound(m);
    const x = duo();
    knockOut(x.a, x.p2, ev());
    const e = updateMatch(m, x.a, 16);
    assert.equal(e!.over, r === WIN_ROUNDS - 1 ? MatchState.MatchOver : MatchState.RoundOver);
  }
  assert.equal(m.winner, 0);
});

test('Deathmatch alone (an online host with nobody else): over when that player is out, no winner', () => {
  const a = empty(), me = addSnake(a, 0, look, playerStarts(1)[0]), m = createMatch(MatchType.Deathmatch, [0]);
  assert.equal(updateMatch(m, a, 16), null);
  knockOut(a, me, ev());
  assert.deepEqual(updateMatch(m, a, 16), { over: MatchState.MatchOver, winner: null });
});

test('Quick match: a timer, rejoins after REJOIN_MS, and at 0 the longer player wins (ties draw)', () => {
  const { a, p1, p2 } = duo(), m = createMatch(MatchType.Quick, [0, 1]);
  assert.equal(m.timeLeft, QUICK_MS);
  knockOut(a, p2, ev());
  assert.equal(updateMatch(m, a, 1000), null);
  assert.equal(p2.alive, false);
  a.time += REJOIN_MS;
  updateMatch(m, a, 1000);
  assert.equal(p2.alive, true);
  assert.equal(p2.mass, START_LENGTH);
  p1.mass = START_LENGTH + 5;
  assert.deepEqual(updateMatch(m, a, QUICK_MS), { over: MatchState.MatchOver, winner: 0 });
  const t = duo(), tie = createMatch(MatchType.Quick, [0, 1]);
  assert.deepEqual(updateMatch(tie, t.a, QUICK_MS), { over: MatchState.MatchOver, winner: null });
  const n = duo(), none = createMatch(MatchType.Quick, [0, 1]);
  knockOut(n.a, n.p1, ev()); knockOut(n.a, n.p2, ev());
  assert.deepEqual(updateMatch(none, n.a, QUICK_MS), { over: MatchState.MatchOver, winner: null });
});
