import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_SNAKES, NET_HZ, ORB_TARGET, SEGMENT } from './constants.ts';
import { Difficulty, MatchType, SnakeMsg } from './enums.ts';
import { seeded } from './seed.ts';
import { defaults } from './settings.ts';
import { addSnake, createArena, knockOut, playerStarts, step, topUp, type Arena, type Events } from './sim.ts';
import { MAX_LENGTH, MAX_MASS } from './constants.ts';
import { fillBots } from './bots.ts';
import {
  addOrbs, allowedFrom, applySnap, coast, encodeBegin, encodeSnaps, nextRunner, ORB_CHUNK, orbChunks, parseMessage, VIEW_LAG_MS, type Msg,
} from './messages.ts';

const look = defaults().players[0];
const full = () => {
  const a = createArena(seeded(1));
  playerStarts(4).forEach((at, i) => addSnake(a, i, look, at));
  fillBots(a, false);
  while (a.orbs.size < ORB_TARGET) topUp(a);
  return a;
};
const noEvents = (): Events => ({ eaten: [], added: [], out: [] });
const snap = (a: Arena, ev: Events) => encodeSnaps(a, ev)[0] as Extract<Msg, { t: 'snap' }>;
const bytes = (m: object) => new TextEncoder().encode(JSON.stringify(m)).length;

test('good messages pass; looks are cleaned; anything malformed or unstamped is dropped', () => {
  const a = full(), from = 0;
  const good = [
    { t: SnakeMsg.Input, from, h: 1.2, b: true }, { t: SnakeMsg.Input, from, r: -1, b: false },
    { t: SnakeMsg.Mode, from, type: MatchType.Quick, level: Difficulty.Hard },
    { t: SnakeMsg.Round, from, winner: 1, wins: [[0, 0], [1, 1]] }, { t: SnakeMsg.Round, from, winner: null, wins: [] },
    { t: SnakeMsg.Clock, from, left: 1000 }, { t: SnakeMsg.Match, from, winner: null }, { t: SnakeMsg.Hand, from, to: 2 },
    { ...snap(a, noEvents()), from }, ...orbChunks(a).map(c => ({ ...c, from })),
  ];
  for (const m of good) assert.ok(parseMessage(m), JSON.stringify(m).slice(0, 80));
  assert.deepEqual(parseMessage({ t: SnakeMsg.Look, from, p: { name: 7, color: 'red' } }), { t: SnakeMsg.Look, from, p: { ...look, name: '' } });
  const begin = parseMessage({ ...encodeBegin(a, MatchType.Deathmatch, 1), from }) as Extract<Msg, { t: 'begin' }>;
  assert.equal(begin.snakes.length, ARENA_SNAKES);
  assert.equal(begin.snakes[0][6].name, look.name);
  const bad = [
    null, 'x', [1], { t: SnakeMsg.Input, h: 1 }, { t: 'nope', from }, { t: SnakeMsg.Input, from, h: Infinity },
    { t: SnakeMsg.Input, from, r: 2 }, { t: SnakeMsg.Mode, from, type: 'Forever', level: Difficulty.Easy },
    { t: SnakeMsg.Begin, from, type: MatchType.Quick, round: 1.5, snakes: [] },
    { t: SnakeMsg.Begin, from, type: MatchType.Quick, round: 1, snakes: [[1, -2, 0, 0, 0, 10, look]] },
    { t: SnakeMsg.Snap, from, s: [[1, 0, 0, 0, 10, 2, 1]], eat: [], add: [], out: [] },
    { t: SnakeMsg.Snap, from, s: Array(ARENA_SNAKES + 1).fill([1, 0, 0, 0, 10, 0, 1]), eat: [], add: [], out: [] },
    { t: SnakeMsg.Snap, from, s: [], eat: [0], add: [], out: [] }, { t: SnakeMsg.Snap, from, s: [[1, 1e9, 0, 0, 10, 0, 1]], eat: [], add: [], out: [] },
    { t: SnakeMsg.Orbs, from, o: [[1, 0, 0, 1, 'red']] }, { t: SnakeMsg.Orbs, from, o: Array(ORB_CHUNK + 1).fill([1, 0, 0, 1, '#ffffff']) },
    { t: SnakeMsg.Round, from, winner: -1, wins: [] }, { t: SnakeMsg.Round, from, winner: 1, wins: [[1]] },
    { t: SnakeMsg.Clock, from, left: -1 }, { t: SnakeMsg.Match, from, winner: 'x' }, { t: SnakeMsg.Hand, from, to: 99 },
  ];
  for (const m of bad) assert.equal(parseMessage(m), null, JSON.stringify(m)?.slice(0, 80));
});

test('arena messages only from the runner; match set-up from the host or runner; looks and steering from anyone', () => {
  const msg = (t: string, from: number) => ({ t, from }) as Msg;
  for (const t of [SnakeMsg.Snap, SnakeMsg.Orbs, SnakeMsg.Round, SnakeMsg.Clock, SnakeMsg.Match, SnakeMsg.Hand]) {
    assert.ok(allowedFrom(msg(t, 1), 1, 0), t);
    assert.equal(allowedFrom(msg(t, 0), 1, 0), false, t); // not even the host, once it handed the arena on
  }
  for (const t of [SnakeMsg.Mode, SnakeMsg.Begin]) { // the host starts the next match even if a guest ran the last one
    assert.ok(allowedFrom(msg(t, 0), 1, 0) && allowedFrom(msg(t, 1), 1, 0), t);
    assert.equal(allowedFrom(msg(t, 2), 1, 0), false, t);
  }
  assert.ok(allowedFrom(msg(SnakeMsg.Input, 2), 1, 0) && allowedFrom(msg(SnakeMsg.Look, 2), 1, 0));
});

test('two long snakes out at once: the snapshot still fits, the extra orbs follow in chunks', () => {
  const a = full(), ev = noEvents();
  for (const s of a.snakes.slice(0, 2)) {
    s.mass = MAX_MASS;
    s.path = Array.from({ length: MAX_LENGTH + 1 }, (_, i) => ({ x: s.path[0].x - i * SEGMENT * 0.1, y: s.path[0].y }));
    knockOut(a, s, ev);
  }
  const msgs = encodeSnaps(a, ev);
  assert.ok(msgs.length > 1);
  for (const m of msgs) { assert.ok(bytes(m) < 8192); assert.ok(parseMessage({ ...m, from: 0 })); }
  assert.equal(msgs.reduce((n, m) => n + ((m as { add?: unknown[]; o?: unknown[] }).add ?? (m as { o: unknown[] }).o).length, 0), ev.added.length);
});

test("a mirror's new ids come after every id it was sent", () => {
  const m = createArena(seeded(1));
  addOrbs(m, [[500, 0, 0, 1, '#ffffff']]);
  assert.equal(m.nextId, 501);
  applySnap(m, { t: SnakeMsg.Snap, s: [[900, 0, 0, 0, 10, 0, 1]], eat: [], add: [[700, 0, 0, 1, '#ffffff']], out: [] });
  assert.equal(m.nextId, 901);
});

test('the runner hands over when its tab is hidden, or the lowest slot takes over when it leaves', () => {
  assert.equal(nextRunner(0, [0, 1, 3]), 0);
  assert.equal(nextRunner(0, [0, 1, 3], { t: SnakeMsg.Hand, from: 0, to: 3 }), 3);
  assert.equal(nextRunner(0, [0, 1, 3], { t: SnakeMsg.Hand, from: 1, to: 3 }), 0); // only the runner can hand over
  assert.equal(nextRunner(0, [1, 3]), 1);
});

test('snapshots fit the relay, orbs come in chunks, and the view lag stays far under half a second', () => {
  const a = full();
  assert.ok(bytes(snap(a, noEvents())) < 8192);
  const chunks = orbChunks(a);
  assert.equal(chunks.reduce((n, c) => n + c.o.length, 0), a.orbs.size);
  assert.ok(chunks.every(c => c.o.length <= ORB_CHUNK && bytes(c) < 8192));
  assert.deepEqual(chunks.map(c => c.first), [1, 0, 0]);
  assert.deepEqual(orbChunks(createArena(seeded(1))).map(c => c.o.length), [0]); // an empty arena still says "clear"
  assert.ok(bytes(encodeBegin(a, MatchType.Quick, 1)) < 8192);
  assert.ok(VIEW_LAG_MS <= 1000 / NET_HZ + 100 && VIEW_LAG_MS < 500);
});

test('a guest mirror follows the runner: heads, bodies, orbs, outs and respawns', () => {
  const run = full(), mirror = createArena(seeded(9));
  for (const [id, slot, x, y, heading, mass, l] of encodeBegin(run, MatchType.Deathmatch, 1).snakes)
    addSnake(mirror, slot < 0 ? null : slot, l, { x, y, heading }).id = id; // as a guest builds it from `begin`
  for (const o of run.orbs.values()) mirror.orbs.set(o.id, { ...o });
  let ev = noEvents();
  for (let i = 0; i < 30; i++) {
    const e = step(run, new Map(), 1 / 60);
    ev = { eaten: [...ev.eaten, ...e.eaten], added: [...ev.added, ...e.added], out: [...ev.out, ...e.out] };
    if (i % 3 === 2) { applySnap(mirror, snap(run, ev)); ev = noEvents(); }
  }
  for (const s of run.snakes) {
    const m = mirror.snakes.find(x => x.id === s.id)!;
    assert.ok(Math.hypot(m.path[0].x - s.path[0].x, m.path[0].y - s.path[0].y) < 0.01);
    assert.ok(m.path.length > 2);
  }
  assert.deepEqual([...mirror.orbs.keys()].sort(), [...run.orbs.keys()].sort());
  const gone = run.snakes[1], e = noEvents();
  knockOut(run, gone, e);
  applySnap(mirror, snap(run, e));
  assert.equal(mirror.snakes.find(x => x.id === gone.id)!.alive, false);
  gone.alive = true; gone.path[0] = { x: 100, y: 100 };
  applySnap(mirror, snap(run, noEvents())); // back in: a fresh body where it reappeared
  const back = mirror.snakes.find(x => x.id === gone.id)!;
  assert.ok(back.alive && Math.hypot(back.path[0].x - 100, back.path[0].y - 100) < 0.01 && back.path.length <= 3);
  applySnap(mirror, { ...snap(run, noEvents()), s: [[999, 0, 0, 0, 10, 0, 1]] }); // unknown snakes are ignored
});

test('between snapshots a guest coasts each snake straight on', () => {
  const a = createArena(seeded(1)), s = addSnake(a, 0, look, { x: 0, y: 0, heading: 0 });
  coast(a, 1, () => SEGMENT * 3);
  assert.ok(Math.abs(s.path[0].x - SEGMENT * 3) < 1e-9);
  assert.ok(s.path.length <= 11);
  knockOut(a, s, noEvents());
  coast(a, 1, () => 100); // out snakes stay put
  assert.ok(Math.abs(s.path[0].x - SEGMENT * 3) < 1e-9);
});
