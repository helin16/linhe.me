import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedFrom, COUNTDOWN_MS, MAX_SLOTS, parseGameMessage, ROOM_SIZES, type Msg } from './net.ts';

test('parseGameMessage keeps well-formed peer messages and drops the rest (US2)', () => {
  const look = { name: 'Ann', color: '#112233', helmet: '#445566', skin: '#ffe0bd', style: 'Rocket' };
  const state = [1, 1.5, -2, 0.3, 20, 1, 100, 0, 1, 0, 0];
  const good = [
    { t: 'me', from: 1, p: look }, { t: 'start', map: 'Neon', from: 0 },
    { t: 's', k: [state, [2, ...state.slice(1)]], from: 1 },
    { t: 'goo', x: 1, z: -3.5, id: '1-7', from: 1 }, { t: 'pop', id: '1-7', from: 2 }, { t: 'zap', by: 1, to: 0, from: 1 },
  ];
  for (const m of good) assert.deepEqual(parseGameMessage(m), m, JSON.stringify(m));

  // a peer's look is cleaned like a saved one; an unusable name becomes empty so the game shows "Player N"
  assert.deepEqual(parseGameMessage({ t: 'me', from: 1, p: { name: 7, color: 'red', style: 'Hover' } }),
    { t: 'me', from: 1, p: { name: '', color: '#ff4444', helmet: '#ffffff', skin: '#ffe0bd', style: 'Classic' } });

  const bad = [
    null, 'x', [1], {}, { t: 'nope' }, { t: 'me', from: 12, p: look },
    { t: 'start', map: 'Moon' }, { t: 's', k: 'x' }, { t: 's', k: [[1, 2]] }, { t: 's', k: [[12, ...state.slice(1)]] },
    { t: 's', k: [[1, ...state.slice(1, 10), 'x']] }, { t: 's', k: Array(13).fill(state) },
    { t: 'goo', x: Infinity, z: 0, id: 'a' }, { t: 'goo', x: 0, z: 0, id: 'x'.repeat(33) }, { t: 'pop', id: 5 },
    { t: 'zap', by: 1, to: 12 }, { t: 'hello', slot: 0, peers: [], code: 'K7QP' }, // hello is the relay's, handled by connect()
    { t: 'join', slot: 1, from: 2 }, { t: 'leave', slot: 0 }, // the relay's own frames are the lobby's, never a game message
    { t: 'start', map: 'Neon' }, { t: 's', k: [state] }, { t: 'zap', by: 1, to: 0 }, // game messages need the relay's stamp
  ];
  for (const m of bad) assert.equal(parseGameMessage(m), null, JSON.stringify(m));
});

test("allowedFrom: players can't move others' karts, zap as others, or start races unless host", () => {
  const st = (slot: number) => [slot, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as [number, ...number[]];
  const me = 1, peers = [0, 2]; // slot 0 is the host; slot 3 is an AI kart
  const msg = (m: object) => m as Msg;
  assert.deepEqual(allowedFrom(msg({ t: 's', from: 2, k: [st(2), st(0), st(3)] }), me, peers, 4), { t: 's', from: 2, k: [st(2)] });
  assert.deepEqual(allowedFrom(msg({ t: 's', from: 0, k: [st(0), st(3), st(2)] }), me, peers, 4), { t: 's', from: 0, k: [st(0), st(3)] });
  assert.equal(allowedFrom(msg({ t: 's', from: 2, k: [st(0)] }), me, peers, 4), null);
  assert.equal(allowedFrom(msg({ t: 'start', from: 2, map: 'Neon' }), me, peers, 4), null);
  assert.ok(allowedFrom(msg({ t: 'start', from: 0, map: 'Neon' }), me, peers, 4));
  assert.equal(allowedFrom(msg({ t: 'zap', from: 2, by: 0, to: 1 }), me, peers, 4), null);
  assert.ok(allowedFrom(msg({ t: 'zap', from: 2, by: 2, to: 1 }), me, peers, 4));
  assert.ok(allowedFrom(msg({ t: 'zap', from: 0, by: 3, to: 1 }), me, peers, 4)); // the host fires for an AI kart
  assert.equal(allowedFrom(msg({ t: 'zap', from: 2, by: 3, to: 1 }), me, peers, 4), null); // only the host does
  assert.ok(allowedFrom(msg({ t: 'goo', from: 2, x: 0, z: 0, id: '2-7' }), me, peers, 4));
  assert.equal(allowedFrom(msg({ t: 'goo', from: 2, x: 0, z: 0, id: '0-7' }), me, peers, 4), null); // another's id
  assert.ok(allowedFrom(msg({ t: 'pop', from: 2, id: '0-7' }), me, peers, 4));
  // slots past the room size don't exist: the host can't drive or zap them, nor zap at them
  assert.deepEqual(allowedFrom(msg({ t: 's', from: 0, k: [st(0), st(4), st(11)] }), me, peers, 4), { t: 's', from: 0, k: [st(0)] });
  assert.ok(allowedFrom(msg({ t: 's', from: 0, k: [st(11)] }), me, peers, 12));
  assert.equal(allowedFrom(msg({ t: 'zap', from: 0, by: 5, to: 1 }), me, peers, 4), null);
  assert.equal(allowedFrom(msg({ t: 'zap', from: 2, by: 2, to: 6 }), me, peers, 4), null);
});

test('room sizes and the countdown length', () => {
  assert.deepEqual(ROOM_SIZES, [4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(MAX_SLOTS, 12);
  assert.equal(COUNTDOWN_MS, 60_000);
});
