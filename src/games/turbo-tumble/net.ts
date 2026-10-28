// Turbo Tumble's connection to the relay (specs/003-online-relay/contracts/relay-protocol.md).
import { CloseCode, isRoomCode, normaliseCode, RELAY_PATH, RelayMsg, relayUrl, type Hello } from '../../../relay/protocol.ts';
import { isMember } from '../../shared/enum.ts';
import { gameRoute } from '../../shared/routes.ts';
import { GameSlug } from '../index.ts';
import { MsgType } from './enums.ts';
import { defaults, fixLook, Track, type PlayerLook } from './settings.ts';

export const SLOTS = 4; // grid spots: four karts per race

// x, z, heading, speed, lap, idx, body rotation, spark, finished, finish time
export type NetState = [number, number, number, number, number, number, number, number, number, number];
export type Msg =
  | { t: typeof MsgType.Hello; slot: number; peers: number[]; code: string }
  | { t: typeof MsgType.Join | typeof MsgType.Leave; slot: number }
  | { t: typeof MsgType.Me; from: number; p: PlayerLook }
  | { t: typeof MsgType.Start; from: number; map: string }
  | { t: typeof MsgType.State; from: number; k: [number, ...NetState][] }
  | { t: typeof MsgType.Goo; from: number; x: number; z: number; id: string }
  | { t: typeof MsgType.Pop; from: number; id: string }
  | { t: typeof MsgType.Zap; from: number; by: number; to: number };

const MAX_ID = 32; // puddle ids are short ("<slot>-<n>")
const NET_STATE_LENGTH = 10;
const isSlot = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < SLOTS;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_ID;
const kartState = (e: unknown) => Array.isArray(e) && e.length === NET_STATE_LENGTH + 1 && isSlot(e[0]) && e.every(isNum);

/** Checks a message from another player; returns it (a profile cleaned like a saved look) or null if it's malformed.
 *  The relay stamps every player's message with `from`; its own join/leave have none, so a stamped one is faked. */
export function parseGameMessage(raw: unknown): Msg | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  if (m.t === MsgType.Join || m.t === MsgType.Leave) return isSlot(m.slot) && !('from' in m) ? raw as Msg : null;
  if (!isSlot(m.from)) return null;
  switch (m.t) {
    case MsgType.Me: return { ...m, p: fixLook(m.p, { ...defaults().players[0], name: '' }) } as Msg;
    case MsgType.Start: return isMember(Track, m.map) ? raw as Msg : null;
    case MsgType.State: return Array.isArray(m.k) && m.k.length <= SLOTS && m.k.every(kartState) ? raw as Msg : null;
    case MsgType.Goo: return isNum(m.x) && isNum(m.z) && isId(m.id) ? raw as Msg : null;
    case MsgType.Pop: return isId(m.id) ? raw as Msg : null;
    case MsgType.Zap: return isSlot(m.by) && isSlot(m.to) ? raw as Msg : null;
    default: return null;
  }
}

/** What a peer may do: move its own kart (the host also the AI karts), zap as itself, and only the host starts races.
 *  Returns the message (kart updates trimmed to allowed karts) or null; takes our own slot and the other players' slots. */
export function allowedFrom(m: Msg, me: number, peers: Iterable<number>): Msg | null {
  if (!('from' in m)) return m; // the relay's own join/leave
  const players = new Set([me, ...peers]), host = Math.min(...players), from = m.from;
  if (m.t === MsgType.Start) return from === host ? m : null;
  const ai = (slot: number) => from === host && !players.has(slot); // the host drives empty grid spots
  if (m.t === MsgType.Zap) return m.by === from || ai(m.by) ? m : null;
  if (m.t === MsgType.Goo) return m.id.startsWith(`${from}-`) ? m : null; // puddle ids are "<slot>-<n>"
  if (m.t !== MsgType.State) return m;
  const k = m.k.filter(([slot]) => slot === from || ai(slot));
  return k.length ? { ...m, k } : null;
}

export const ROOM_QUERY = 'room'; // join links: /games/turbo-tumble/?room=K7QP
export const CONNECT_TIMEOUT_MS = 5000; // no hello by then → relay unavailable (SC-005)

/** What players see when a connection ends. */
export const NetText = {
  Unavailable: "Online play isn't available right now",
  NoRoom: 'No room with that code',
  Full: 'That room is full',
  Disconnected: 'Disconnected from the room',
} as const;
export type NetText = typeof NetText[keyof typeof NetText];

export function closeMessage(code: number, hadHello: boolean): NetText {
  if (hadHello) return NetText.Disconnected;
  if (code === CloseCode.NoRoom) return NetText.NoRoom;
  if (code === CloseCode.Full) return NetText.Full;
  return NetText.Unavailable;
}

export const joinLink = (origin: string, code: string) =>
  `${origin}${gameRoute(GameSlug.TurboTumble)}?${ROOM_QUERY}=${encodeURIComponent(code)}`;

/** The room code in a join link, normalised, or null. */
export function roomFromUrl(url: string): string | null {
  const raw = new URL(url).searchParams.get(ROOM_QUERY);
  const code = raw && normaliseCode(raw);
  return code && isRoomCode(code) ? code : null;
}

export type Handlers = { hello: (h: Hello) => void; message: (m: unknown) => void; closed: (text: NetText) => void };
type Socket = {
  readyState: number; send: (data: string) => void; close: () => void;
  onmessage: ((e: { data: unknown }) => void) | null; onclose: ((e: { code: number }) => void) | null;
};

const defaultBase = () => import.meta.env?.VITE_RELAY_URL ?? location.origin + RELAY_PATH;

/** Opens a room connection (`room` is a code, or NEW_ROOM to create one). `closed` fires once, with the reason. */
export function connect(room: string, on: Handlers, base = defaultBase(),
  open: (url: string) => Socket = url => new WebSocket(url) as unknown as Socket, timeout = CONNECT_TIMEOUT_MS) {
  const ws = open(relayUrl(base, GameSlug.TurboTumble, room));
  let hadHello = false, done = false;
  const finish = (text: NetText) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    ws.close();
    on.closed(text);
  };
  const timer = setTimeout(() => finish(NetText.Unavailable), timeout);
  ws.onmessage = e => {
    let msg: unknown;
    try { msg = JSON.parse(String(e.data)); } catch { return; }
    if (hadHello) return on.message(msg);
    if ((msg as Hello | null)?.t !== RelayMsg.Hello) return;
    hadHello = true;
    clearTimeout(timer);
    on.hello(msg as Hello);
  };
  ws.onclose = e => finish(closeMessage(e.code, hadHello));
  return {
    send: (m: object) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); },
    /** Leave on purpose: no `closed` callback. */
    close: () => { done = true; clearTimeout(timer); ws.close(); },
  };
}
