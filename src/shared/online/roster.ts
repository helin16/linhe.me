// The waiting room's player list, shared by every game's online lobby (features 005, 006).

export const UNKNOWN_COLOR = '#888888'; // a player whose profile hasn't arrived yet
const MAX_NAME = 10; // as the games' garages allow

export type RosterRow = { slot: number; name: string; color: string; host: boolean; you: boolean };
export type Look = { name: string; color: string };

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

/** How many spots computer players will fill. */
export const computerSpots = (size: number, players: number) => Math.max(0, size - players);
