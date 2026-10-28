import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRooms } from './rooms.ts';
import { RelayMsg } from './protocol.ts';

const client = () => { const got: unknown[] = []; return { got, send: (s: string) => got.push(JSON.parse(s)) }; };
let next = 0;
const codes = () => `C${String(next++).padStart(3, '0')}`; // predictable codes for tests

test('create gives a code and slot 0; joiners get the lowest free slot and the peers', () => {
  const r = createRooms({ roomSize: 4, maxRooms: 10 }, codes);
  const a = client(), b = client(), c = client();
  const room = r.create('g', a);
  assert.ok(room !== 'busy');
  assert.equal(room.slot, 0);
  assert.deepEqual(r.join('g', room.code, b), { slot: 1, peers: [0] });
  assert.deepEqual(a.got, [{ t: RelayMsg.Join, slot: 1 }]);
  assert.deepEqual(r.join('g', room.code, c), { slot: 2, peers: [0, 1] });
  r.leave('g', room.code, 1);
  assert.deepEqual(a.got.at(-1), { t: RelayMsg.Leave, slot: 1 });
  assert.deepEqual(r.join('g', room.code, client()), { slot: 1, peers: [0, 2] }); // freed slot reused
});

test('full rooms, unknown codes and other games are refused', () => {
  const r = createRooms({ roomSize: 2, maxRooms: 10 }, codes);
  const room = r.create('g', client());
  assert.ok(room !== 'busy');
  r.join('g', room.code, client());
  assert.equal(r.join('g', room.code, client()), 'full');
  assert.equal(r.join('g', 'NOPE', client()), 'no-room');
  assert.equal(r.join('other', room.code, client()), 'no-room');
});

test('rooms are deleted the moment they empty, and the total is capped', () => {
  const r = createRooms({ roomSize: 4, maxRooms: 1 }, codes);
  const room = r.create('g', client());
  assert.ok(room !== 'busy');
  assert.equal(r.create('g', client()), 'busy');
  assert.deepEqual(r.count(), { rooms: 1, clients: 1 });
  r.leave('g', room.code, 0);
  assert.deepEqual(r.count(), { rooms: 0, clients: 0 });
  assert.equal(r.join('g', room.code, client()), 'no-room');
  r.leave('g', room.code, 0); // leaving an already-gone room is harmless
  assert.ok(r.create('g', client()) !== 'busy');
});

test('broadcast reaches the others with the real sender slot', () => {
  const r = createRooms({ roomSize: 4, maxRooms: 10 }, codes);
  const a = client(), b = client(), c = client();
  const room = r.create('g', a);
  assert.ok(room !== 'busy');
  r.join('g', room.code, b); r.join('g', room.code, c);
  a.got.length = b.got.length = c.got.length = 0;
  r.broadcast('g', room.code, 1, { t: 'x', from: 99 });
  assert.deepEqual(a.got, [{ t: 'x', from: 1 }]);
  assert.deepEqual(b.got, []);
  assert.deepEqual(c.got, [{ t: 'x', from: 1 }]);
  r.broadcast('g', 'NOPE', 0, { t: 'x' }); // unknown room: nothing happens
});

test('codes are unique per game, so a taken code is skipped', () => {
  const fixed = ['AAAA', 'AAAA', 'BBBB'];
  const r = createRooms({ roomSize: 4, maxRooms: 10 }, taken => { let c; do { c = fixed.shift()!; } while (taken(c)); return c; });
  const one = r.create('g', client()), two = r.create('g', client());
  assert.ok(one !== 'busy' && two !== 'busy');
  assert.deepEqual([one.code, two.code], ['AAAA', 'BBBB']);
});
