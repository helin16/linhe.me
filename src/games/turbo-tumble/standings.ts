// What the race standings panel and the waiting room's player list show (feature 005). No three.js, so it's unit tested.

export const COMPACT_MEDIA = '(max-width: 700px), (max-height: 500px)'; // phone-sized: only the top and our own rows
export const COMPACT_TOP = 3;
export const UNKNOWN_COLOR = '#888888'; // a player whose profile hasn't arrived yet
const MAX_NAME = 10; // as the garage allows

/** One kart in race order; `time` is its finish time once it has finished. */
export type Standing = { place: number; name: string; color: string; local: boolean; time: string | null };
export type RosterRow = { slot: number; name: string; color: string; host: boolean; you: boolean };
type Look = { name: string; color: string };

/** The rows to show: every kart, or on a phone the top places plus any player on this device outside them. */
export const standingRows = (order: Standing[], compact: boolean) =>
  compact ? order.filter(s => s.place <= COMPACT_TOP || s.local) : order;

/** A player's name as shown, or "Player N" when it's blank or unknown. */
export const playerName = (name: unknown, slot: number) =>
  (typeof name === 'string' && name.trim().slice(0, MAX_NAME)) || `Player ${slot + 1}`;

/** Everyone in the room by slot: our own look for our slot, the profiles they sent for the rest. */
export function rosterRows(me: number, peers: Iterable<number>, profiles: Record<number, Look | undefined>, own: Look): RosterRow[] {
  const slots = [...new Set([me, ...peers])].sort((a, b) => a - b);
  return slots.map(slot => {
    const look = slot === me ? own : profiles[slot];
    return { slot, name: playerName(look?.name, slot), color: look?.color ?? UNKNOWN_COLOR, host: slot === slots[0], you: slot === me };
  });
}

/** How many grid spots computer karts will fill. */
export const computerKarts = (size: number, players: number) => Math.max(0, size - players);
