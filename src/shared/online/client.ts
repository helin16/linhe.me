// The relay client every game's online play uses (features 003/004): connecting to a room, close reasons, the room
// list, join links and the waiting room's countdown clock. Game messages are each game's own.
import { CloseCode, isRoomCode, normaliseCode, RELAY_PATH, RelayMsg, relayUrl, roomsUrl, type Hello, type RoomFrame, type RoomInfo } from '../../../relay/protocol.ts';
import { gameRoute } from '../routes.ts';
import type { GameSlug } from '../../games/index.ts';

export const ROOM_QUERY = 'room'; // join links: /games/<game>/?room=K7QP
export const LIST_POLL_MS = 1000;   // room list refresh while the Online popup is open (004 FR-003: ≤2 s, request included)
export const CONNECT_TIMEOUT_MS = 5000; // no hello by then → relay unavailable (SC-005)

/** What players see when a connection ends. */
export const NetText = {
  Unavailable: "Online play isn't available right now",
  NoRoom: 'No room with that code',
  Full: 'That room is full',
  Started: 'That race has already started',
  Closed: 'The host closed the room',
  Disconnected: 'Disconnected from the room',
  NoRooms: 'No rooms waiting — host one!',
} as const;
export type NetText = typeof NetText[keyof typeof NetText];

export function closeMessage(code: number, hadHello: boolean): NetText {
  if (code === CloseCode.Closed) return NetText.Closed;
  if (hadHello) return NetText.Disconnected;
  if (code === CloseCode.NoRoom) return NetText.NoRoom;
  if (code === CloseCode.Full) return NetText.Full;
  if (code === CloseCode.Started) return NetText.Started;
  return NetText.Unavailable;
}

export const joinLink = (origin: string, game: GameSlug, code: string) =>
  `${origin}${gameRoute(game)}?${ROOM_QUERY}=${encodeURIComponent(code)}`;

/** The room code in a join link, normalised, or null. */
export function roomFromUrl(url: string): string | null {
  const raw = new URL(url).searchParams.get(ROOM_QUERY);
  const code = raw && normaliseCode(raw);
  return code && isRoomCode(code) ? code : null;
}

export type Handlers = { hello: (h: Hello) => void; room: (r: RoomFrame) => void; message: (m: unknown) => void; closed: (text: NetText) => void };
type Socket = {
  readyState: number; send: (data: string) => void; close: () => void;
  onmessage: ((e: { data: unknown }) => void) | null; onclose: ((e: { code: number }) => void) | null;
};

const defaultBase = () => import.meta.env?.VITE_RELAY_URL ?? location.origin + RELAY_PATH;

type ConnectOptions = { size?: number; base?: string; open?: (url: string) => Socket; timeout?: number };

/** Opens a room connection for `game` (`room` is a code, or NEW_ROOM with a `size` to create one). `closed` fires
 *  once, with the reason. */
export function connect(room: string, game: GameSlug, on: Handlers, { size, base = defaultBase(),
  open = url => new WebSocket(url) as unknown as Socket, timeout = CONNECT_TIMEOUT_MS }: ConnectOptions = {}) {
  const ws = open(relayUrl(base, game, room, size));
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
    if (hadHello) return (msg as RoomFrame | null)?.t === RelayMsg.Room ? on.room(msg as RoomFrame) : on.message(msg);
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

const MAX_ROOM_NAME = 32; // the relay's names are two short words
const MAX_ROOM_SIZE = 12; // the largest room any game here offers (the relay's own cap is configuration)
const isCount = (v: unknown) => Number.isInteger(v) && (v as number) > 0 && (v as number) <= MAX_ROOM_SIZE;
const isRoomInfo = (r: unknown) => {
  const x = r as RoomInfo | null;
  return !!x && typeof x.code === 'string' && isRoomCode(x.code) && typeof x.name === 'string' && x.name.length <= MAX_ROOM_NAME
    && isCount(x.players) && isCount(x.size);
};

/** A game's rooms waiting for players, newest first; empty if the relay can't be reached or answers oddly. */
export async function fetchRooms(game: GameSlug, base = defaultBase(), get: typeof fetch = fetch): Promise<RoomInfo[]> {
  try {
    const res = await get(roomsUrl(base, game), { cache: 'no-store' });
    const rooms = res.ok ? ((await res.json()) as { rooms?: unknown }).rooms : null;
    return Array.isArray(rooms) ? rooms.filter(isRoomInfo) : [];
  } catch { return []; }
}

/** When a waiting room's countdown (`countdownMs` long) ends, on our clock, from the relay's `openFor`. */
export const deadlineFrom = (openFor: number, countdownMs: number, now = Date.now()) => now - openFor + countdownMs;
/** Whole seconds left on the countdown (never below 0). */
export const secondsLeft = (deadline: number, now = Date.now()) => Math.max(0, Math.ceil((deadline - now) / 1000));
