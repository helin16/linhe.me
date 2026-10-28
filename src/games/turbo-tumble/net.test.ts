import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CloseCode } from '../../../relay/protocol.ts';
import { allowedFrom, closeMessage, connect, joinLink, NetText, parseGameMessage, ROOM_QUERY, roomFromUrl, type Msg } from './net.ts';

test('close codes map to the messages players see', () => {
  assert.equal(closeMessage(CloseCode.NoRoom, false), NetText.NoRoom);
  assert.equal(closeMessage(CloseCode.Full, false), NetText.Full);
  for (const c of [CloseCode.BadRequest, CloseCode.Busy, 1006, 1000]) assert.equal(closeMessage(c, false), NetText.Unavailable, String(c));
  for (const c of [1006, 1000, CloseCode.TooBig, CloseCode.TooMany]) assert.equal(closeMessage(c, true), NetText.Disconnected, String(c));
  assert.equal(NetText.Unavailable, "Online play isn't available right now");
  assert.equal(NetText.NoRoom, 'No room with that code');
  assert.equal(NetText.Full, 'That room is full');
  assert.equal(NetText.Disconnected, 'Disconnected from the room');
});

test('join links point at the game page with the room code', () => {
  assert.equal(ROOM_QUERY, 'room');
  assert.equal(joinLink('https://example.com', 'K7QP'), 'https://example.com/games/turbo-tumble/?room=K7QP');
});

test('a room code is read from a join link, normalised, or null', () => {
  assert.equal(roomFromUrl('https://example.com/games/turbo-tumble/?room=k7qp'), 'K7QP');
  assert.equal(roomFromUrl('https://example.com/games/turbo-tumble/?room=k7%20qp'), 'K7QP');
  for (const u of ['https://example.com/games/turbo-tumble/', 'https://example.com/?room=', 'https://example.com/?room=K7Q0', 'https://example.com/?room=TOOLONG'])
    assert.equal(roomFromUrl(u), null, u);
});

// a stand-in socket the test drives by hand
function fakeSocket() {
  const s = {
    url: '', sent: [] as string[], closed: false, readyState: 1,
    onmessage: null as ((e: { data: unknown }) => void) | null, onclose: null as ((e: { code: number }) => void) | null,
    send(d: string) { s.sent.push(d); }, close() { s.closed = true; },
  };
  return s;
}
const events = () => { const log: unknown[] = []; return { log, on: { hello: (h: unknown) => log.push(['hello', h]), message: (m: unknown) => log.push(['msg', m]), closed: (t: string) => log.push(['closed', t]) } }; };

test('connect: hello, then messages; send only when open; closes report once', () => {
  const s = fakeSocket(), e = events();
  const conn = connect('new', e.on, 'https://example.com/relay/', url => { s.url = url; return s; }, 1000);
  assert.equal(s.url, 'wss://example.com/relay/turbo-tumble/new');
  s.onmessage!({ data: '{"t":"me"}' }); // ignored before hello
  s.onmessage!({ data: 'not json' });   // ignored
  s.onmessage!({ data: '{"t":"hello","slot":0,"peers":[],"code":"K7QP"}' });
  s.onmessage!({ data: '{"t":"s","from":1}' });
  conn.send({ t: 'me' });
  s.readyState = 3;
  conn.send({ t: 'me' }); // not open: dropped
  s.onclose!({ code: 1006 });
  s.onclose!({ code: 1006 }); // reported once
  assert.deepEqual(e.log, [['hello', { t: 'hello', slot: 0, peers: [], code: 'K7QP' }], ['msg', { t: 's', from: 1 }], ['closed', NetText.Disconnected]]);
  assert.deepEqual(s.sent, ['{"t":"me"}']);
});

test('connect: refusals and the no-hello timeout give the right message; leaving on purpose is silent', async () => {
  const s1 = fakeSocket(), e1 = events();
  connect('ZZZZ', e1.on, 'https://example.com/relay/', () => s1, 1000);
  s1.onclose!({ code: CloseCode.NoRoom });
  assert.deepEqual(e1.log, [['closed', NetText.NoRoom]]);

  const s2 = fakeSocket(), e2 = events();
  connect('K7QP', e2.on, 'https://example.com/relay/', () => s2, 20);
  await new Promise(r => setTimeout(r, 40));
  assert.deepEqual(e2.log, [['closed', NetText.Unavailable]]);
  assert.ok(s2.closed);

  const s3 = fakeSocket(), e3 = events();
  const c3 = connect('K7QP', e3.on, 'https://example.com/relay/', () => s3, 20);
  c3.close();
  s3.onclose!({ code: 1000 });
  await new Promise(r => setTimeout(r, 40));
  assert.deepEqual(e3.log, []);
});

test('connect: defaults to the same-site relay and a real WebSocket', async () => {
  const g = globalThis as { location?: unknown };
  const had = 'location' in g;
  g.location = { origin: 'http://127.0.0.1:1' }; // nothing listens on port 1
  try {
    const e = events();
    connect('K7QP', e.on); // default base and default socket
    await new Promise(r => setTimeout(r, 1500));
    assert.deepEqual(e.log, [['closed', NetText.Unavailable]]);
  } finally {
    if (!had) delete g.location;
  }
});

test('parseGameMessage keeps well-formed peer messages and drops the rest (US2)', () => {
  const look = { name: 'Ann', color: '#112233', helmet: '#445566', skin: '#ffe0bd', style: 'Rocket' };
  const state = [1, 1.5, -2, 0.3, 20, 1, 100, 0, 1, 0, 0];
  const good = [
    { t: 'join', slot: 2 }, { t: 'leave', slot: 3 },
    { t: 'me', from: 1, p: look }, { t: 'start', map: 'Neon', from: 0 },
    { t: 's', k: [state, [2, ...state.slice(1)]], from: 1 },
    { t: 'goo', x: 1, z: -3.5, id: '1-7', from: 1 }, { t: 'pop', id: '1-7', from: 2 }, { t: 'zap', by: 1, to: 0, from: 1 },
  ];
  for (const m of good) assert.deepEqual(parseGameMessage(m), m, JSON.stringify(m));

  // a peer's look is cleaned like a saved one; an unusable name becomes empty so the game shows "Player N"
  assert.deepEqual(parseGameMessage({ t: 'me', from: 1, p: { name: 7, color: 'red', style: 'Hover' } }),
    { t: 'me', from: 1, p: { name: '', color: '#ff4444', helmet: '#ffffff', skin: '#ffe0bd', style: 'Classic' } });

  const bad = [
    null, 'x', [1], {}, { t: 'nope' }, { t: 'join', slot: 4 }, { t: 'leave', slot: -1 }, { t: 'me', from: 9, p: look },
    { t: 'start', map: 'Moon' }, { t: 's', k: 'x' }, { t: 's', k: [[1, 2]] }, { t: 's', k: [[5, ...state.slice(1)]] },
    { t: 's', k: [[1, ...state.slice(1, 10), 'x']] }, { t: 's', k: [state, state, state, state, state] },
    { t: 'goo', x: Infinity, z: 0, id: 'a' }, { t: 'goo', x: 0, z: 0, id: 'x'.repeat(33) }, { t: 'pop', id: 5 },
    { t: 'zap', by: 1, to: 7 }, { t: 'hello', slot: 0, peers: [], code: 'K7QP' }, // hello is the relay's, handled by connect()
    { t: 'join', slot: 1, from: 2 }, { t: 'leave', slot: 0, from: 2 }, // stamped by the relay: a player faked it
    { t: 'start', map: 'Neon' }, { t: 's', k: [state] }, { t: 'zap', by: 1, to: 0 }, // game messages need the relay's stamp
  ];
  for (const m of bad) assert.equal(parseGameMessage(m), null, JSON.stringify(m));
});

test("allowedFrom: players can't move others' karts, zap as others, or start races unless host", () => {
  const st = (slot: number) => [slot, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as [number, ...number[]];
  const me = 1, peers = [0, 2]; // slot 0 is the host; slot 3 is an AI kart
  const msg = (m: object) => m as Msg;
  assert.deepEqual(allowedFrom(msg({ t: 'join', slot: 3 }), me, peers), { t: 'join', slot: 3 });
  assert.deepEqual(allowedFrom(msg({ t: 's', from: 2, k: [st(2), st(0), st(3)] }), me, peers), { t: 's', from: 2, k: [st(2)] });
  assert.deepEqual(allowedFrom(msg({ t: 's', from: 0, k: [st(0), st(3), st(2)] }), me, peers), { t: 's', from: 0, k: [st(0), st(3)] });
  assert.equal(allowedFrom(msg({ t: 's', from: 2, k: [st(0)] }), me, peers), null);
  assert.equal(allowedFrom(msg({ t: 'start', from: 2, map: 'Neon' }), me, peers), null);
  assert.ok(allowedFrom(msg({ t: 'start', from: 0, map: 'Neon' }), me, peers));
  assert.equal(allowedFrom(msg({ t: 'zap', from: 2, by: 0, to: 1 }), me, peers), null);
  assert.ok(allowedFrom(msg({ t: 'zap', from: 2, by: 2, to: 1 }), me, peers));
  assert.ok(allowedFrom(msg({ t: 'zap', from: 0, by: 3, to: 1 }), me, peers)); // the host fires for an AI kart
  assert.equal(allowedFrom(msg({ t: 'zap', from: 2, by: 3, to: 1 }), me, peers), null); // only the host does
  assert.ok(allowedFrom(msg({ t: 'goo', from: 2, x: 0, z: 0, id: '2-7' }), me, peers));
  assert.equal(allowedFrom(msg({ t: 'goo', from: 2, x: 0, z: 0, id: '0-7' }), me, peers), null); // another's id
  assert.ok(allowedFrom(msg({ t: 'pop', from: 2, id: '0-7' }), me, peers));
});
