import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CloseCode } from '../../../relay/protocol.ts';
import { GameSlug } from '../../games/index.ts';
import { closeMessage, connect, deadlineFrom, fetchRooms, joinLink, NetText, ROOM_QUERY, roomFromUrl, secondsLeft } from './client.ts';

test('close codes map to the messages players see', () => {
  assert.equal(closeMessage(CloseCode.NoRoom, false), NetText.NoRoom);
  assert.equal(closeMessage(CloseCode.Full, false), NetText.Full);
  assert.equal(closeMessage(CloseCode.Started, false), NetText.Started);
  for (const had of [false, true]) assert.equal(closeMessage(CloseCode.Closed, had), NetText.Closed);
  for (const c of [CloseCode.BadRequest, CloseCode.Busy, 1006, 1000]) assert.equal(closeMessage(c, false), NetText.Unavailable, String(c));
  for (const c of [1006, 1000, CloseCode.TooBig, CloseCode.TooMany]) assert.equal(closeMessage(c, true), NetText.Disconnected, String(c));
  assert.equal(NetText.Unavailable, "Online play isn't available right now");
  assert.equal(NetText.NoRoom, 'No room with that code');
  assert.equal(NetText.Full, 'That room is full');
  assert.equal(NetText.Disconnected, 'Disconnected from the room');
  assert.equal(NetText.Started, 'That race has already started');
  assert.equal(NetText.Closed, 'The host closed the room');
});

test('join links point at the game page with the room code', () => {
  assert.equal(ROOM_QUERY, 'room');
  assert.equal(joinLink('https://example.com', GameSlug.TurboTumble, 'K7QP'), 'https://example.com/games/turbo-tumble/?room=K7QP');
  assert.equal(joinLink('https://example.com', 'snake-duel' as GameSlug, 'K7QP'), 'https://example.com/games/snake-duel/?room=K7QP');
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
const events = () => { const log: unknown[] = []; return { log, on: { hello: (h: unknown) => log.push(['hello', h]), room: (r: unknown) => log.push(['room', r]), message: (m: unknown) => log.push(['msg', m]), closed: (t: string) => log.push(['closed', t]) } }; };

test('connect: hello, then messages; send only when open; closes report once', () => {
  const s = fakeSocket(), e = events();
  const conn = connect('new', GameSlug.TurboTumble, e.on, { size: 8, base: 'https://example.com/relay/', open: url => { s.url = url; return s; }, timeout: 1000 });
  assert.equal(s.url, 'wss://example.com/relay/turbo-tumble/new?size=8');
  s.onmessage!({ data: '{"t":"me"}' }); // ignored before hello
  s.onmessage!({ data: 'not json' });   // ignored
  s.onmessage!({ data: '{"t":"hello","slot":0,"peers":[],"code":"K7QP"}' });
  s.onmessage!({ data: '{"t":"s","from":1}' });
  s.onmessage!({ data: '{"t":"room","open":false,"openFor":5}' });
  conn.send({ t: 'me' });
  s.readyState = 3;
  conn.send({ t: 'me' }); // not open: dropped
  s.onclose!({ code: 1006 });
  s.onclose!({ code: 1006 }); // reported once
  assert.deepEqual(e.log, [['hello', { t: 'hello', slot: 0, peers: [], code: 'K7QP' }], ['msg', { t: 's', from: 1 }], ['room', { t: 'room', open: false, openFor: 5 }], ['closed', NetText.Disconnected]]);
  assert.deepEqual(s.sent, ['{"t":"me"}']);
});

test('connect: refusals and the no-hello timeout give the right message; leaving on purpose is silent', async () => {
  const s1 = fakeSocket(), e1 = events();
  connect('ZZZZ', GameSlug.TurboTumble, e1.on, { base: 'https://example.com/relay/', open: () => s1, timeout: 1000 });
  s1.onclose!({ code: CloseCode.NoRoom });
  assert.deepEqual(e1.log, [['closed', NetText.NoRoom]]);

  const s2 = fakeSocket(), e2 = events();
  connect('K7QP', GameSlug.TurboTumble, e2.on, { base: 'https://example.com/relay/', open: () => s2, timeout: 20 });
  await new Promise(r => setTimeout(r, 40));
  assert.deepEqual(e2.log, [['closed', NetText.Unavailable]]);
  assert.ok(s2.closed);

  const s3 = fakeSocket(), e3 = events();
  const c3 = connect('K7QP', GameSlug.TurboTumble, e3.on, { base: 'https://example.com/relay/', open: () => s3, timeout: 20 });
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
    connect('K7QP', GameSlug.TurboTumble, e.on); // default base and default socket
    await new Promise(r => setTimeout(r, 1500));
    assert.deepEqual(e.log, [['closed', NetText.Unavailable]]);
  } finally {
    if (!had) delete g.location;
  }
});

test('the room list: validated entries, empty on any failure', async () => {
  const ok = { code: 'K7QP', name: 'Turbo Otter', players: 2, size: 8 };
  const answer = (body: unknown, status = 200) => (async (url: string | URL | Request) => {
    assert.equal(String(url), 'https://example.com/relay/turbo-tumble/rooms');
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }) as typeof fetch;
  const base = 'https://example.com/relay/';
  assert.deepEqual(await fetchRooms(GameSlug.TurboTumble, base, answer({ rooms: [ok, { ...ok, code: 'BAD!' }, { ...ok, players: 0 }, { ...ok, size: 13 }, { ...ok, name: 'x'.repeat(33) }, null] })), [ok]);
  assert.deepEqual(await fetchRooms(GameSlug.TurboTumble, base, answer({ rooms: 'x' })), []);
  assert.deepEqual(await fetchRooms(GameSlug.TurboTumble, base, answer('not json')), []);
  assert.deepEqual(await fetchRooms(GameSlug.TurboTumble, base, answer({ rooms: [ok] }, 429)), []);
  assert.deepEqual(await fetchRooms(GameSlug.TurboTumble, base, (async () => { throw new Error('offline'); }) as typeof fetch), []);
});

test('the countdown clock', () => {
  assert.equal(deadlineFrom(15_000, 60_000, 100_000), 145_000);
  assert.equal(secondsLeft(145_000, 100_000), 45);
  assert.equal(secondsLeft(145_000, 144_001), 1);
  assert.equal(secondsLeft(145_000, 200_000), 0);
  assert.ok(Math.abs(deadlineFrom(0, 60_000) - Date.now() - 60_000) < 50 && secondsLeft(Date.now() + 2500) === 3);
});
