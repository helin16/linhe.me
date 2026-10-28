import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRooms } from './rooms.ts';
import { CloseCode, RelayMsg } from './protocol.ts';

const client = () => {
  const got: unknown[] = [], closed: number[] = [];
  return { got, closed, send: (s: string) => got.push(JSON.parse(s)), close: (c: number) => closed.push(c) };
};
let next = 0;
const codes = () => `C${String(next++).padStart(3, '0')}`; // predictable codes for tests
let n = 0;
const names = () => `Name ${n++}`;
let clock = 1000;
const now = () => clock;
const rooms = (maxRooms = 10) => createRooms({ maxRooms }, codes, names, now);
const made = <T>(r: T | 'busy') => { assert.ok(r !== 'busy'); return r as T; };

test('create gives a code, slot 0, a name, the size and an open room; joiners get the lowest free slot', () => {
  const r = rooms();
  const a = client(), b = client(), c = client();
  const room = made(r.create('g', a, 4));
  assert.deepEqual({ ...room, code: undefined, name: undefined }, { code: undefined, name: undefined, slot: 0, peers: [], size: 4, open: true, openFor: 0 });
  clock += 500;
  assert.deepEqual(r.join('g', room.code, b), { slot: 1, peers: [0], name: room.name, size: 4, open: true, openFor: 500 });
  assert.deepEqual(a.got, [{ t: RelayMsg.Join, slot: 1 }]);
  assert.deepEqual((r.join('g', room.code, c) as { slot: number }).slot, 2);
  r.leave('g', room.code, 1);
  assert.deepEqual(a.got.at(-1), { t: RelayMsg.Leave, slot: 1 });
  assert.equal((r.join('g', room.code, client()) as { slot: number }).slot, 1); // freed slot reused
});

test('a room holds exactly its own size; unknown codes and other games are refused', () => {
  const r = rooms();
  const room = made(r.create('g', client(), 3));
  r.join('g', room.code, client()); r.join('g', room.code, client());
  assert.equal(r.join('g', room.code, client()), 'full');
  const big = made(r.create('g', client(), 12));
  for (let i = 1; i < 12; i++) assert.equal((r.join('g', big.code, client()) as { slot: number }).slot, i);
  assert.equal(r.join('g', big.code, client()), 'full');
  assert.equal(r.join('g', 'NOPE', client()), 'no-room');
  assert.equal(r.join('other', room.code, client()), 'no-room');
});

test('names are unique within a game', () => {
  const fixed = ['Turbo Otter', 'Turbo Otter', 'Rocket Fox'];
  const r = createRooms({ maxRooms: 10 }, codes, taken => { let x; do { x = fixed.shift()!; } while (taken(x)); return x; }, now);
  assert.deepEqual([made(r.create('g', client(), 4)).name, made(r.create('g', client(), 4)).name], ['Turbo Otter', 'Rocket Fox']);
});

test('rooms are deleted the moment they empty, and the total is capped', () => {
  const r = rooms(1);
  const room = made(r.create('g', client(), 4));
  assert.equal(r.create('g', client(), 4), 'busy');
  assert.deepEqual(r.count(), { rooms: 1, clients: 1 });
  r.leave('g', room.code, 0);
  assert.deepEqual(r.count(), { rooms: 0, clients: 0 });
  assert.equal(r.join('g', room.code, client()), 'no-room');
  r.leave('g', room.code, 0); // leaving an already-gone room is harmless
  assert.ok(r.create('g', client(), 4) !== 'busy');
});

test('the host locks and reopens the room; guests are ignored; a locked room refuses joins', () => {
  const r = rooms();
  const a = client(), b = client();
  const room = made(r.create('g', a, 4));
  r.join('g', room.code, b);
  a.got.length = b.got.length = 0;
  assert.equal(r.control('g', room.code, 1, RelayMsg.Lock), false); // a guest can't
  assert.equal(r.control('g', 'NOPE', 0, RelayMsg.Lock), false);
  clock += 2000;
  assert.equal(r.control('g', room.code, 0, RelayMsg.Lock), true);
  for (const c of [a, b]) assert.deepEqual(c.got, [{ t: RelayMsg.Room, open: false, openFor: 2000 }]); // host included
  assert.equal(r.join('g', room.code, client()), 'started');
  assert.deepEqual(r.list('g'), []);
  clock += 3000;
  assert.equal(r.control('g', room.code, 0, RelayMsg.Open), true);
  assert.deepEqual(a.got.at(-1), { t: RelayMsg.Room, open: true, openFor: 0 }); // the countdown restarts
  assert.equal((r.join('g', room.code, client()) as { openFor: number }).openFor, 0);
});

test('after the host leaves, the next player is host', () => {
  const r = rooms();
  const room = made(r.create('g', client(), 4));
  r.join('g', room.code, client());
  r.leave('g', room.code, 0);
  assert.equal(r.control('g', room.code, 0, RelayMsg.Lock), false); // the old host's slot is gone
  assert.equal(r.control('g', room.code, 1, RelayMsg.Lock), true);
});

test('the host closes the room: everyone is closed with 4410 and the room is gone', () => {
  const r = rooms();
  const a = client(), b = client();
  const room = made(r.create('g', a, 4));
  r.join('g', room.code, b);
  assert.equal(r.control('g', room.code, 1, RelayMsg.Close), false);
  assert.equal(r.control('g', room.code, 0, RelayMsg.Close), true);
  assert.deepEqual([a.closed, b.closed], [[CloseCode.Closed], [CloseCode.Closed]]);
  assert.deepEqual(r.count(), { rooms: 0, clients: 0 });
  r.leave('g', room.code, 1); // the closes that follow find nothing
  assert.equal(r.join('g', room.code, client()), 'no-room');
});

test('the list shows a game\'s open rooms with a free spot, newest first', () => {
  const r = rooms();
  const one = made(r.create('g', client(), 2)), two = made(r.create('g', client(), 8)), three = made(r.create('g', client(), 4));
  made(r.create('other', client(), 4));
  r.join('g', one.code, client()); // now full
  r.control('g', three.code, 0, RelayMsg.Lock); // racing
  r.join('g', two.code, client());
  assert.deepEqual(r.list('g'), [{ code: two.code, name: two.name, players: 2, size: 8 }]);
  assert.deepEqual(r.list('nobody'), []);
});

test('broadcast reaches the others with the real sender slot', () => {
  const r = rooms();
  const a = client(), b = client(), c = client();
  const room = made(r.create('g', a, 4));
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
  const r = createRooms({ maxRooms: 10 }, taken => { let c; do { c = fixed.shift()!; } while (taken(c)); return c; }, names, now);
  assert.deepEqual([made(r.create('g', client(), 4)).code, made(r.create('g', client(), 4)).code], ['AAAA', 'BBBB']);
});

test('when no code or name is free, create says busy instead of throwing', () => {
  const noNames = createRooms({ maxRooms: 10 }, codes, () => { throw new Error('no free room name'); }, now);
  assert.equal(noNames.create('g', client(), 4), 'busy');
  assert.deepEqual(noNames.count(), { rooms: 0, clients: 0 });
});

test('the default clock and generators work', () => {
  const r = createRooms({ maxRooms: 10 });
  const room = made(r.create('g', client(), 4));
  assert.match(room.code, /^[A-Z2-9]{4}$/);
  assert.match(room.name, /^[A-Z][a-z]+ [A-Z][a-z]+$/);
});
