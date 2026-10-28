// End-to-end: the real relay on a free port, real WebSocket clients (constitution V: isolation tests).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { DEFAULTS, type Config } from './config.ts';
import { CloseCode, RelayMsg } from './protocol.ts';
import { startRelay } from './server.ts';

type Frame = { t: string; [k: string]: unknown };
type Client = { ws: WebSocket; frames: Frame[]; next: () => Promise<Frame>; closed: Promise<number>; send: (m: object) => void };

function client(port: number, path: string, headers: Record<string, string> = {}, autoPong = true): Client {
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, { headers, autoPong });
  const frames: Frame[] = [], waiting: ((f: Frame) => void)[] = [];
  ws.on('message', data => {
    const f = JSON.parse(String(data)) as Frame;
    const w = waiting.shift();
    if (w) w(f); else frames.push(f);
  });
  const closed = new Promise<number>(resolve => ws.on('close', code => resolve(code)));
  ws.on('error', () => {}); // refusals surface as close codes
  return {
    ws, frames, closed,
    next: () => frames.length ? Promise.resolve(frames.shift()!) : new Promise(r => waiting.push(r)),
    send: m => ws.send(JSON.stringify(m)),
  };
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function withRelay(config: Partial<Config>) {
  const relay = await startRelay({ ...DEFAULTS, port: 0, ...config });
  return { relay, open: (path: string, headers?: Record<string, string>, autoPong?: boolean) => client(relay.port, path, headers, autoPong) };
}

describe('the relay process', () => {
  test('answers plain HTTP with 404 and bad paths without upgrading', async () => {
    const { relay } = await withRelay({});
    try {
      assert.equal((await fetch(`http://127.0.0.1:${relay.port}/relay/test-game/new`)).status, 404);
    } finally { await relay.close(); }
  });

  test('`yarn relay` starts it from the environment and says where it listens', async () => {
    const child = spawn(process.execPath, ['relay/server.ts'], { env: { ...process.env, RELAY_PORT: '0' } });
    try {
      const line = await new Promise<string>(resolve => child.stdout.once('data', d => resolve(String(d))));
      assert.match(line, /^relay listening on 127\.0\.0\.1:\d+/);
    } finally { child.kill(); }
  });
});

describe('rooms: create, join, forward, leave', () => {
  let r: Awaited<ReturnType<typeof withRelay>>;
  before(async () => { r = await withRelay({}); });
  after(() => r.relay.close());

  test('create, join by code (any case, spaces), forward with the real slot, leave', async () => {
    const a = r.open('/relay/test-game/new');
    const helloA = await a.next();
    assert.equal(helloA.t, RelayMsg.Hello);
    assert.deepEqual([helloA.slot, helloA.peers], [0, []]);
    const code = String(helloA.code);
    assert.match(code, /^[A-Z2-9]{4}$/);

    const b = r.open(`/relay/test-game/${code.toLowerCase().slice(0, 2)}%20${code.toLowerCase().slice(2)}`);
    const helloB = await b.next();
    assert.deepEqual({ ...helloB, openFor: 0 }, { t: RelayMsg.Hello, slot: 1, peers: [0], code, name: helloA.name, size: 4, open: true, openFor: 0 });
    assert.deepEqual(await a.next(), { t: RelayMsg.Join, slot: 1 });

    b.send({ t: 'x', from: 99, n: 1 });
    assert.deepEqual(await a.next(), { t: 'x', from: 1, n: 1 });
    await sleep(50);
    assert.deepEqual(b.frames, []); // the sender doesn't get its own message

    b.ws.close();
    assert.deepEqual(await a.next(), { t: RelayMsg.Leave, slot: 1 });
    a.ws.close();
    await a.closed;
    await sleep(50);
    const late = r.open(`/relay/test-game/${code}`);
    assert.equal(await late.closed, CloseCode.NoRoom); // the room went when it emptied
  });

  test('a fifth player is refused; an unknown code is refused', async () => {
    const host = r.open('/relay/test-game/new');
    const { code } = await host.next();
    const others = [1, 2, 3].map(() => r.open(`/relay/test-game/${code}`));
    for (const o of others) assert.equal((await o.next()).t, RelayMsg.Hello);
    const fifth = r.open(`/relay/test-game/${code}`);
    assert.equal(await fifth.closed, CloseCode.Full);
    assert.equal(await r.open('/relay/test-game/ZZZZ').closed, CloseCode.NoRoom);
    for (const c of [host, ...others]) c.ws.close();
  });

  test('every kart update arrives, in order, at race rate (SC-004)', async () => {
    const host = r.open('/relay/test-game/new');
    const { code } = await host.next();
    const players = [host, r.open(`/relay/test-game/${code}`), r.open(`/relay/test-game/${code}`)];
    for (const p of players.slice(1)) await p.next();
    await sleep(50);
    for (const p of players) p.frames.length = 0;
    for (let i = 0; i < 60; i++) { // 20 a second for 3 seconds, from each player
      players.forEach((p, slot) => p.send({ t: 's', slot, i }));
      await sleep(50);
    }
    await sleep(200);
    players.forEach((p, me) => {
      for (const from of [0, 1, 2].filter(s => s !== me)) {
        const seen = p.frames.filter(f => f.from === from).map(f => f.i);
        assert.deepEqual(seen, Array.from({ length: 60 }, (_, i) => i), `player ${me} from ${from}`);
      }
    });
    for (const p of players) p.ws.close();
  });
});


describe('lobby: sizes, names, open/lock/close, the room list (feature 004)', () => {
  let r: Awaited<ReturnType<typeof withRelay>>;
  before(async () => { r = await withRelay({ perAddress: 1000, rate: 1000, listRate: 1000 }); });
  after(() => r.relay.close());
  const list = async (game = 'lobby-game') => {
    const res = await fetch(`http://127.0.0.1:${r.relay.port}/relay/${game}/rooms`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    return ((await res.json()) as { rooms: { code: string; name: string; players: number; size: number }[] }).rooms;
  };
  const host = async (size: number, game = 'lobby-game') => {
    const c = r.open(`/relay/${game}/new?size=${size}`);
    const hello = await c.next();
    return { c, code: String(hello.code), hello };
  };
  const join = async (code: string) => { const c = r.open(`/relay/lobby-game/${code}`); return { c, hello: await c.next() }; };

  test('a host picks the size; the room holds exactly that many; sizes outside 2..12 are refused', async () => {
    const { c, code, hello } = await host(8);
    assert.deepEqual([hello.size, hello.open, hello.openFor], [8, true, 0]);
    assert.match(String(hello.name), /^[A-Z][a-z]+ [A-Z][a-z]+$/);
    const guests = await Promise.all(Array.from({ length: 7 }, () => join(code)));
    assert.equal(await r.open(`/relay/lobby-game/${code}`).closed, CloseCode.Full);
    for (const size of [1, 13]) assert.equal(await r.open(`/relay/lobby-game/new?size=${size}`).closed, CloseCode.BadRequest, String(size));
    for (const x of [c, ...guests.map(g => g.c)]) x.ws.close();
    await sleep(50);
  });

  test('the host locks, reopens and closes; guests are ignored; locked rooms refuse joins', async () => {
    const { c: a, code } = await host(4);
    const { c: b } = await join(code);
    await a.next(); // b's join
    b.send({ t: RelayMsg.Lock });
    await sleep(50);
    assert.deepEqual(a.frames, []); // a guest's lock does nothing
    a.send({ t: RelayMsg.Lock });
    for (const x of [a, b]) assert.deepEqual({ ...(await x.next()), openFor: 0 }, { t: RelayMsg.Room, open: false, openFor: 0 });
    assert.equal(await r.open(`/relay/lobby-game/${code}`).closed, CloseCode.Started);
    a.send({ t: RelayMsg.Open });
    for (const x of [a, b]) assert.deepEqual(await x.next(), { t: RelayMsg.Room, open: true, openFor: 0 });
    b.send({ t: RelayMsg.Close });
    await sleep(50);
    assert.equal(b.ws.readyState, b.ws.OPEN);
    a.send({ t: RelayMsg.Close });
    assert.deepEqual([await a.closed, await b.closed], [CloseCode.Closed, CloseCode.Closed]);
    assert.equal(await r.open(`/relay/lobby-game/${code}`).closed, CloseCode.NoRoom);
  });

  test('when the host leaves, the next player takes over the controls', async () => {
    const { c: a, code } = await host(4);
    const { c: b } = await join(code);
    const { c: c } = await join(code);
    await b.next(); // c's join
    a.ws.close();
    assert.deepEqual(await b.next(), { t: RelayMsg.Leave, slot: 0 });
    c.send({ t: RelayMsg.Lock }); // slot 2 isn't host
    await sleep(50);
    assert.deepEqual(b.frames, []);
    b.send({ t: RelayMsg.Close });
    assert.deepEqual([await b.closed, await c.closed], [CloseCode.Closed, CloseCode.Closed]);
  });

  test('the list shows only open rooms with a free spot, newest first, per game', async () => {
    const full = await host(2), racing = await host(4), open = await host(8), other = await host(4, 'other-game');
    await join(full.code);
    racing.c.send({ t: RelayMsg.Lock });
    await racing.c.next();
    await join(open.code);
    assert.deepEqual(await list(), [{ code: open.code, name: open.hello.name, players: 2, size: 8 }]);
    assert.deepEqual((await list('other-game')).map(x => x.code), [other.code]);
    assert.equal((await fetch(`http://127.0.0.1:${r.relay.port}/relay/lobby-game/rooms`, { method: 'POST' })).status, 404);
    assert.equal((await fetch(`http://127.0.0.1:${r.relay.port}/relay/lobby-game/K7QP`)).status, 404);
    assert.equal(await r.open('/relay/lobby-game/rooms').closed, 1006); // no socket on the list route (404)
    for (const x of [full, racing, open, other]) x.c.ws.close();
    await sleep(50);
  });

  test('12 players at race rate: every update arrives, in order (SC-008)', async () => {
    const first = await host(12);
    const players = [first.c, ...(await Promise.all(Array.from({ length: 11 }, () => join(first.code)))).map(j => j.c)];
    await sleep(100);
    for (const p of players) p.frames.length = 0;
    for (let i = 0; i < 60; i++) {
      players.forEach((p, slot) => p.send({ t: 's', slot, i }));
      await sleep(50);
    }
    await sleep(300);
    players.forEach((p, me) => {
      for (let from = 0; from < 12; from++) if (from !== me)
        assert.deepEqual(p.frames.filter(f => f.from === from).map(f => f.i), Array.from({ length: 60 }, (_, i) => i), `${me} from ${from}`);
    });
    for (const p of players) p.ws.close();
  });
});

describe('isolation between rooms and games (US2)', () => {
  let r: Awaited<ReturnType<typeof withRelay>>;
  before(async () => { r = await withRelay({ perAddress: 1000, rate: 1000 }); }); // shared address; bursts are fine here
  after(() => r.relay.close());

  test('two rooms in one game never see each other', async () => {
    const room = async () => {
      const a = r.open('/relay/test-game/new');
      const { code } = await a.next();
      const b = r.open(`/relay/test-game/${code}`);
      await b.next(); await a.next(); // hello, join
      return { a, b, code };
    };
    const one = await room(), two = await room();
    assert.notEqual(one.code, two.code);
    for (let i = 0; i < 50; i++) { one.a.send({ t: 'x', room: 1, i }); two.a.send({ t: 'x', room: 2, i }); }
    await sleep(300);
    assert.equal(one.b.frames.length, 50);
    assert.equal(two.b.frames.length, 50);
    assert.ok(one.b.frames.every(f => f.room === 1) && two.b.frames.every(f => f.room === 2));
    for (const c of [one.a, one.b, two.a, two.b]) c.ws.close();
  });

  test("another game can't use a room's code, and reaches nobody", async () => {
    const host = r.open('/relay/turbo-tumble/new');
    const { code } = await host.next();
    const stranger = r.open(`/relay/other-game/${code}`);
    assert.equal(await stranger.closed, CloseCode.NoRoom);
    await sleep(100);
    assert.deepEqual(host.frames, []);
    host.ws.close();
  });

  test('bad paths get 404 without upgrading; bad frames close the sender', async () => {
    for (const path of ['/relay/Bad_Game/new', '/relay/turbo-tumble/', '/relay/turbo-tumble/K7Q0', '/elsewhere']) {
      const c = r.open(path);
      const status = await new Promise<number>(res => c.ws.once('unexpected-response', (_, resp) => res(resp.statusCode ?? 0)));
      assert.equal(status, 404, path);
    }
    for (const bad of ['not json', '[1,2]', '42', 'null']) {
      const c = r.open('/relay/test-game/new');
      await c.next();
      c.ws.send(bad);
      assert.equal(await c.closed, CloseCode.BadRequest, bad);
    }
    const c = r.open('/relay/test-game/new');
    await c.next();
    c.ws.send(Buffer.from('{"t":"x"}'), { binary: true });
    assert.equal(await c.closed, CloseCode.BadRequest, 'binary');
  });

  test('codes are unique across many rooms', async () => {
    const clients: Client[] = [], codes: string[] = [];
    for (let batch = 0; batch < 4; batch++) { // 50 at a time: macOS resets bursts over its 128-connection backlog
      const opened = Array.from({ length: 50 }, () => r.open('/relay/test-game/new'));
      codes.push(...await Promise.all(opened.map(async c => String((await c.next()).code))));
      clients.push(...opened);
    }
    assert.equal(new Set(codes).size, 200);
    for (const c of clients) c.ws.close();
  });
});

describe('logging keeps no player data (FR-007)', () => {
  test('only counts and error codes are logged', async () => {
    const lines: string[] = [];
    const relay = await startRelay({ ...DEFAULTS, port: 0, logMs: 30, maxMessage: 64 }, line => lines.push(line));
    try {
      const a = client(relay.port, '/relay/test-game/new');
      const { code, name } = await a.next();
      const b = client(relay.port, `/relay/test-game/${code}`);
      await b.next();
      a.send({ t: 'me', p: { name: 'Secret Name' } });
      b.ws.send('x'.repeat(500)); // over the library's cap: an error gets logged
      await b.closed;
      await sleep(100);
      assert.ok(lines.some(l => /^connections=\d+ rooms=\d+$/.test(l)), lines.join('|'));
      assert.ok(lines.some(l => /^client error: /.test(l)), lines.join('|'));
      assert.ok(lines.every(l => !l.includes(String(code)) && !l.includes(String(name)) && !l.includes('Secret')), lines.join('|'));
      a.ws.close();
    } finally { await relay.close(); }
  });
});

describe('limits for a public relay (US4)', () => {
  let r: Awaited<ReturnType<typeof withRelay>>;
  before(async () => { r = await withRelay({ maxMessage: 1024, rate: 5, perAddress: 3, maxRooms: 2, pingMs: 100 }); });
  after(() => r.relay.close());
  const ip = (n: number) => ({ 'CF-Connecting-IP': `203.0.113.${n}` });

  test('a message over the size limit closes the sender; others carry on', async () => {
    const a = r.open('/relay/test-game/new', ip(1));
    const { code } = await a.next();
    const b = r.open(`/relay/test-game/${code}`, ip(2));
    await b.next(); await a.next();
    b.ws.send(JSON.stringify({ t: 'x', pad: 'x'.repeat(1024) })); // just over 1024 bytes
    assert.equal(await b.closed, CloseCode.TooBig);
    assert.deepEqual(await a.next(), { t: RelayMsg.Leave, slot: 1 });
    const c = r.open(`/relay/test-game/${code}`, ip(3));
    assert.equal((await c.next()).t, RelayMsg.Hello); // the room still works
    c.ws.send('x'.repeat(5000)); // far over: the socket library itself refuses it
    assert.equal(await c.closed, 1009); // WebSocket "message too big"
    a.ws.close();
  });

  test('flooding past the rate limit closes the sender', async () => {
    const a = r.open('/relay/test-game/new', ip(4));
    await a.next();
    for (let i = 0; i < 6; i++) a.send({ t: 'x', i });
    assert.equal(await a.closed, CloseCode.TooMany);
  });

  test('the room list is rate limited per address (429), other addresses unaffected', async () => {
    const get = (n: number) => fetch(`http://127.0.0.1:${r.relay.port}/relay/test-game/rooms`, { headers: ip(n) }).then(x => x.status);
    const burst = await Promise.all(Array.from({ length: DEFAULTS.listRate + 1 }, () => get(20)));
    assert.deepEqual(burst.sort(), [...Array(DEFAULTS.listRate).fill(200), 429]);
    assert.equal(await get(21), 200);
  });

  test('the total room cap refuses new rooms', async () => {
    const rooms = [r.open('/relay/test-game/new', ip(30)), r.open('/relay/test-game/new', ip(31))];
    for (const c of rooms) await c.next();
    assert.equal(await r.open('/relay/test-game/new', ip(32)).closed, CloseCode.Busy); // cap is 2
    for (const c of rooms) { c.ws.close(); await c.closed; }
  });

  test('too many connections from one address are refused; other addresses are unaffected', async () => {
    await sleep(50);
    const host = r.open('/relay/test-game/new', ip(9));
    const { code } = await host.next();
    const two = r.open(`/relay/test-game/${code}`, ip(9)), three = r.open(`/relay/test-game/${code}`, ip(9));
    for (const c of [two, three]) assert.equal((await c.next()).t, RelayMsg.Hello); // 3 from this address: the limit
    assert.equal(await r.open(`/relay/test-game/${code}`, ip(9)).closed, CloseCode.Busy); // a 4th is refused
    const other = r.open(`/relay/test-game/${code}`, ip(10));
    assert.equal((await other.next()).t, RelayMsg.Hello);
    three.ws.close(); await three.closed; await sleep(50);
    other.ws.close(); await other.closed; await sleep(50);
    const again = r.open(`/relay/test-game/${code}`, ip(9));
    assert.equal((await again.next()).t, RelayMsg.Hello); // a freed connection can be reused
    for (const c of [host, two, again]) c.ws.close();
  });

  test('a client that stops answering pings is dropped and its peers told', async () => {
    const a = r.open('/relay/test-game/new', ip(20));
    const { code } = await a.next();
    const silent = r.open(`/relay/test-game/${code}`, ip(21), false);
    await silent.next(); await a.next();
    assert.deepEqual(await a.next(), { t: RelayMsg.Leave, slot: 1 }); // dropped after two missed pings
    a.ws.close();
  });
});

describe('abuse a public relay must survive (review fixes)', () => {
  let r: Awaited<ReturnType<typeof withRelay>>;
  before(async () => { r = await withRelay({ perAddress: 1000, rate: 100000, maxMessage: 8192, maxBuffer: 65536 }); });
  after(() => r.relay.close());

  test("a client can't fake the relay's join or leave messages", async () => {
    const a = r.open('/relay/test-game/new');
    const { code } = await a.next();
    const b = r.open(`/relay/test-game/${code}`);
    await b.next(); await a.next();
    for (const t of [RelayMsg.Leave, RelayMsg.Join, RelayMsg.Hello, RelayMsg.Room]) {
      const c = r.open(`/relay/test-game/${code}`);
      await c.next(); await a.next(); // its hello; a hears the real join
      c.send({ t, slot: 0 });
      assert.equal(await c.closed, CloseCode.BadRequest, t);
      assert.deepEqual(await a.next(), { t: RelayMsg.Leave, slot: 2 }); // only the real leave
    }
    a.ws.close(); b.ws.close();
  });

  test('a player who stops reading is dropped before the relay buffers too much', async () => {
    const a = r.open('/relay/test-game/new');
    const { code } = await a.next();
    const stuck = r.open(`/relay/test-game/${code}`);
    await stuck.next(); await a.next();
    stuck.ws.pause(); // stops reading: everything sent to it piles up on the server
    const pad = 'x'.repeat(8000);
    for (let i = 0; i < 400; i++) a.send({ t: 'x', pad, i }); // ~3 MB, far over the 64 KB cap
    assert.deepEqual(await a.next(), { t: RelayMsg.Leave, slot: 1 });
    a.ws.close();
  });

  test('a socket that errors during the handshake does not crash the relay', async () => {
    const { connect } = await import('node:net');
    for (let i = 0; i < 20; i++) {
      const s = connect(r.relay.port, '127.0.0.1');
      s.on('error', () => {});
      s.write('GET /relay/Bad_Game/new HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
      s.resetAndDestroy();
    }
    await sleep(100);
    const ok = r.open('/relay/test-game/new');
    assert.equal((await ok.next()).t, RelayMsg.Hello); // still running
    ok.ws.close();
  });
});
