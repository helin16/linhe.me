// The relay: game-agnostic rooms over WebSockets (specs/003-online-relay). Listens on localhost only;
// Caddy proxies /relay/* to it. Run with `yarn relay`, or as the bundled dist-relay/relay.mjs in production.
import { createServer, type IncomingMessage } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { loadConfig, type Config } from './config.ts';
import { addressCounter, addressKey, tokenBucket } from './limits.ts';
import { CloseCode, isRelayMsg, MIN_ROOM_SIZE, parseRelayPath, RelayMsg } from './protocol.ts';
import { createRooms, type Control } from './rooms.ts';

type Target = Exclude<NonNullable<ReturnType<typeof parseRelayPath>>, { list: true }>;
const CONTROLS: unknown[] = [RelayMsg.Lock, RelayMsg.Open, RelayMsg.Close]; // the host's frames to the relay
const CLIENT_ADDRESS = 'cf-connecting-ip'; // set by Cloudflare; only Cloudflare can reach the server (firewall)
const MISSED_PINGS = 2; // drop a client that misses this many pings in a row

export function startRelay(config: Config, log?: (line: string) => void) {
  const rooms = createRooms(config);
  const addresses = addressCounter(config.perAddress);
  const missed = new Map<WebSocket, number>();
  // the library's own cap is a backstop; anything over maxMessage is refused below with our own code
  const wss = new WebSocketServer({ noServer: true, maxPayload: config.maxMessage * 2 });
  const address = (req: IncomingMessage) => {
    const header = req.headers[CLIENT_ADDRESS];
    return addressKey((Array.isArray(header) ? header[0] : header) || req.socket.remoteAddress || '');
  };
  // the room list: plain GET, rate limited per address; buckets are dropped with each count log (nothing kept)
  const listBuckets = new Map<string, () => boolean>();
  const http = createServer((req, res) => {
    const target = parseRelayPath(new URL(req.url ?? '', 'http://relay').pathname);
    if (req.method !== 'GET' || !target || !('list' in target)) return void res.writeHead(404).end();
    const key = address(req);
    let allow = listBuckets.get(key);
    if (!allow) listBuckets.set(key, allow = tokenBucket(config.listRate));
    if (!allow()) return void res.writeHead(429).end();
    // public data, and the relay may sit on another origin (VITE_RELAY_URL), so any page may read it
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' })
      .end(JSON.stringify({ rooms: rooms.list(target.game) }));
  });
  // a broken connection just closes; Node leaves errors on upgrade sockets unhandled, which would crash us
  const onSocketError = (err: Error) => log?.(`client error: ${(err as NodeJS.ErrnoException).code ?? err.name}`); // no payloads

  http.on('upgrade', (req, socket, head) => {
    socket.on('error', onSocketError);
    const url = new URL(req.url ?? '', 'http://relay');
    const target = parseRelayPath(url.pathname, url.search);
    if (!target || 'list' in target) return void socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    const key = address(req);
    wss.handleUpgrade(req, socket, head, ws => welcome(ws, target, key));
  });

  function welcome(ws: WebSocket, target: Target, address: string) {
    ws.on('error', onSocketError);
    if (!addresses.add(address)) return ws.close(CloseCode.Busy);
    ws.on('close', () => { addresses.remove(address); missed.delete(ws); });
    // a peer that stops reading would make us buffer the room's traffic without end: drop it instead
    const peer = {
      send: (data: string) => ws.bufferedAmount > config.maxBuffer ? ws.terminate() : ws.send(data),
      close: (code: number) => ws.close(code),
    };
    let code: string, room: Exclude<ReturnType<typeof rooms.join>, string>;
    if ('create' in target) {
      if (target.size < MIN_ROOM_SIZE || target.size > config.roomSize) return ws.close(CloseCode.BadRequest);
      const made = rooms.create(target.game, peer, target.size);
      if (made === 'busy') return ws.close(CloseCode.Busy);
      ({ code, ...room } = made);
    } else {
      const joined = rooms.join(target.game, target.code, peer);
      if (joined === 'no-room') return ws.close(CloseCode.NoRoom);
      if (joined === 'full') return ws.close(CloseCode.Full);
      if (joined === 'started') return ws.close(CloseCode.Started);
      code = target.code;
      room = joined;
    }
    const { slot } = room;
    const allow = tokenBucket(config.rate);
    missed.set(ws, 0);
    ws.on('pong', () => missed.set(ws, 0));
    ws.send(JSON.stringify({ t: RelayMsg.Hello, ...room, code }));
    ws.on('message', (data, binary) => {
      if ((data as Buffer).byteLength > config.maxMessage) return ws.close(CloseCode.TooBig);
      if (!allow()) return ws.close(CloseCode.TooMany);
      let msg: unknown;
      try { msg = binary ? null : JSON.parse(String(data)); } catch { msg = null; }
      if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return ws.close(CloseCode.BadRequest);
      const t = (msg as { t?: unknown }).t;
      if (CONTROLS.includes(t)) return void rooms.control(target.game, code, slot, t as Control); // ignored unless host
      if (isRelayMsg(t)) return ws.close(CloseCode.BadRequest); // a faked hello/join/leave/room
      rooms.broadcast(target.game, code, slot, msg);
    });
    ws.on('close', () => rooms.leave(target.game, code, slot));
  }

  // pings keep idle connections open through Cloudflare (it drops them after 100 s) and find dead ones
  const pinger = setInterval(() => {
    for (const [ws, n] of missed) {
      if (n >= MISSED_PINGS) { ws.terminate(); continue; }
      missed.set(ws, n + 1);
      ws.ping();
    }
  }, config.pingMs);
  const counter = setInterval(() => {
    const { rooms: open, clients } = rooms.count();
    log?.(`connections=${clients} rooms=${open}`);
    listBuckets.clear();
  }, config.logMs);

  return new Promise<{ port: number; close: () => Promise<void> }>(resolve => http.listen(config.port, '127.0.0.1', () => {
    const address = http.address();
    resolve({
      port: typeof address === 'object' && address ? address.port : config.port,
      close: () => new Promise<void>(done => {
        clearInterval(pinger); clearInterval(counter);
        for (const ws of wss.clients) ws.terminate();
        wss.close();
        http.close(() => done());
      }),
    });
  }));
}

if (import.meta.main) {
  const { port } = await startRelay(loadConfig(process.env), console.log);
  console.log(`relay listening on 127.0.0.1:${port}`);
}
