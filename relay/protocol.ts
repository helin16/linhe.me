// The relay's wire protocol, shared by the relay and game clients (specs/003-online-relay/contracts/relay-protocol.md).
// Owned by the relay; games import it.

export const RELAY_PATH = '/relay/';
export const NEW_ROOM = 'new';
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
export const CODE_LENGTH = 4;
export const ROOMS_PATH = 'rooms';  // GET /relay/<game>/rooms lists open rooms
export const SIZE_QUERY = 'size';   // /relay/<game>/new?size=8
export const MIN_ROOM_SIZE = 2;     // a room needs two players to be a room
export const DEFAULT_ROOM_SIZE = 4; // when a create asks for no size
export const MAX_SLOT = 64;         // every slot is below this (rooms are far smaller)

/** The relay's own frame types. It sends hello/join/leave/room; the host sends lock/open/close to it.
 *  Every other frame is a game payload, forwarded with `from` set to the sender's slot. */
export const RelayMsg = {
  Hello: 'hello', Join: 'join', Leave: 'leave', Room: 'room', // relay → clients
  Lock: 'room-lock', Open: 'room-open', Close: 'room-close',   // host → relay
} as const;
export type RelayMsg = typeof RelayMsg[keyof typeof RelayMsg];

/** True if a client tried to send one of the relay's own message types (it could fake joins and leaves). */
export const isRelayMsg = (t: unknown) => (Object.values(RelayMsg) as unknown[]).includes(t);

/** WebSocket close codes the relay uses for refusals and limits. */
export const CloseCode = { BadRequest: 4400, NoRoom: 4404, Full: 4409, Closed: 4410, TooBig: 4413, Started: 4423, TooMany: 4429, Busy: 4503 } as const;
export type CloseCode = typeof CloseCode[keyof typeof CloseCode];

/** `open`: the room is waiting (listed, joinable); `openFor`: ms since it last opened (the shared countdown clock). */
export type RoomState = { open: boolean; openFor: number };
export type Hello = { t: typeof RelayMsg.Hello; slot: number; peers: number[]; code: string; name: string; size: number } & RoomState;
export type RoomFrame = { t: typeof RelayMsg.Room } & RoomState;
export type RoomInfo = { code: string; name: string; players: number; size: number };
export type Join = { t: typeof RelayMsg.Join; slot: number };
export type Leave = { t: typeof RelayMsg.Leave; slot: number };

/** A slot number as the relay hands them out. */
export const isSlot = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < MAX_SLOT;

export const normaliseCode = (code: string) => code.toUpperCase().replace(/\s+/g, '');
export const isGameName = (name: string) => /^[a-z0-9-]{1,32}$/.test(name);
export const isRoomCode = (code: string) => code.length === CODE_LENGTH && [...code].every(c => CODE_ALPHABET.includes(c));

/** `/relay/<game>/new[?size=N]` → create, `/relay/<game>/rooms` → list, `/relay/<game>/<code>` → join; anything
 *  else → null. `size` isn't range-checked here (the relay's largest room is configuration). */
export function parseRelayPath(path: string, search = ''):
  { game: string; create: true; size: number } | { game: string; list: true } | { game: string; code: string } | null {
  if (!path.startsWith(RELAY_PATH)) return null;
  let parts: string[];
  try { parts = path.slice(RELAY_PATH.length).split('/').map(decodeURIComponent); } catch { return null; }
  if (parts.length !== 2) return null;
  const [game, room] = parts;
  if (!isGameName(game)) return null;
  if (room === NEW_ROOM) {
    const size = new URLSearchParams(search).get(SIZE_QUERY);
    if (size === null) return { game, create: true, size: DEFAULT_ROOM_SIZE };
    return /^\d{1,3}$/.test(size) ? { game, create: true, size: Number(size) } : null;
  }
  if (room === ROOMS_PATH) return { game, list: true };
  const code = normaliseCode(room);
  return isRoomCode(code) ? { game, code } : null;
}

const under = (base: string, path: string) => new URL(path, base.endsWith('/') ? base : base + '/');

/** The WebSocket address for a room (a code or NEW_ROOM, with a size when creating) under a relay base. */
export function relayUrl(base: string, game: string, room: string, size?: number) {
  const url = under(base, `${game}/${encodeURIComponent(room)}`);
  url.protocol = url.protocol.replace(/^http/, 'ws');
  if (size !== undefined) url.searchParams.set(SIZE_QUERY, String(size));
  return url.toString();
}

/** The HTTP address of a game's room list under a relay base (which may be ws: or wss:). */
export function roomsUrl(base: string, game: string) {
  const url = under(base, `${game}/${ROOMS_PATH}`);
  url.protocol = url.protocol.replace(/^ws/, 'http');
  return url.toString();
}
