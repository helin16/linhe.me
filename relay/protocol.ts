// The relay's wire protocol, shared by the relay and game clients (specs/003-online-relay/contracts/relay-protocol.md).
// Owned by the relay; games import it.

export const RELAY_PATH = '/relay/';
export const NEW_ROOM = 'new';
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
export const CODE_LENGTH = 4;

/** Frames the relay itself sends; every other frame is a game payload with `from` set to the sender's slot. */
export const RelayMsg = { Hello: 'hello', Join: 'join', Leave: 'leave' } as const;
export type RelayMsg = typeof RelayMsg[keyof typeof RelayMsg];

/** True if a client tried to send one of the relay's own message types (it could fake joins and leaves). */
export const isRelayMsg = (t: unknown) => (Object.values(RelayMsg) as unknown[]).includes(t);

/** WebSocket close codes the relay uses for refusals and limits. */
export const CloseCode = { BadRequest: 4400, NoRoom: 4404, Full: 4409, TooBig: 4413, TooMany: 4429, Busy: 4503 } as const;
export type CloseCode = typeof CloseCode[keyof typeof CloseCode];

export type Hello = { t: typeof RelayMsg.Hello; slot: number; peers: number[]; code: string };
export type Join = { t: typeof RelayMsg.Join; slot: number };
export type Leave = { t: typeof RelayMsg.Leave; slot: number };

export const normaliseCode = (code: string) => code.toUpperCase().replace(/\s+/g, '');
export const isGameName = (name: string) => /^[a-z0-9-]{1,32}$/.test(name);
export const isRoomCode = (code: string) => code.length === CODE_LENGTH && [...code].every(c => CODE_ALPHABET.includes(c));

/** `/relay/<game>/new` → create, `/relay/<game>/<code>` → join; anything else → null. */
export function parseRelayPath(path: string): { game: string; create: true } | { game: string; code: string } | null {
  if (!path.startsWith(RELAY_PATH)) return null;
  let parts: string[];
  try { parts = path.slice(RELAY_PATH.length).split('/').map(decodeURIComponent); } catch { return null; }
  if (parts.length !== 2) return null;
  const [game, room] = parts;
  if (!isGameName(game)) return null;
  if (room === NEW_ROOM) return { game, create: true };
  const code = normaliseCode(room);
  return isRoomCode(code) ? { game, code } : null;
}

/** The WebSocket address for a room (`room` is a code or NEW_ROOM) under a relay base address. */
export function relayUrl(base: string, game: string, room: string) {
  const url = new URL(`${game}/${encodeURIComponent(room)}`, base.endsWith('/') ? base : base + '/');
  url.protocol = url.protocol.replace(/^http/, 'ws');
  return url.toString();
}
