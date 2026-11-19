// Online seats shared by Critter Hop and Critter Chess: the host settles type picks (first come wins, nobody shares a
// type), hands out free types, builds a room's seats (players by slot, then computer seats), and the runner hand-over.
import type { Random } from '../seed.ts';

/** A seat as sent: seat id, the slot playing it (−1: a computer), its type. */
export type SeatRow<T> = [number, number, T];

/** The next runner: the same one while it's in the room, else the lowest slot. */
export const nextRunner = (runner: number, slots: number[]) => slots.includes(runner) ? runner : slots[0] ?? -1;

/** A slot gets a type unless another slot already has it. */
export function takeType<T>(types: Map<number, T>, slot: number, type: T) {
  if ([...types].some(([s, t]) => s !== slot && t === type)) return false;
  types.set(slot, type);
  return true;
}
/** A random type from `all` that nobody has. */
export function freeType<T>(all: readonly T[], taken: T[], random: Random) {
  const free = all.filter(t => !taken.includes(t));
  return free[Math.floor(random() * free.length)];
}
/** The seats for a room's game: its players by slot (first pick wins; no pick → a free type), then computer seats with
 *  the types left, `size` seats in all. */
export function roomSeats<T>(all: readonly T[], slots: number[], types: Map<number, T>, size: number, random: Random): SeatRow<T>[] {
  if (size > all.length) throw new Error(`a room of ${size} needs ${size} types; there are ${all.length}`);
  const players = [...slots].sort((a, b) => a - b).slice(0, size), mine: (T | undefined)[] = [];
  for (const slot of players) { const t = types.get(slot); mine.push(t !== undefined && !mine.includes(t) ? t : undefined); }
  const taken = () => mine.filter((t): t is T => t !== undefined);
  mine.forEach((t, i) => { if (t === undefined) mine[i] = freeType(all, taken(), random); });
  while (mine.length < size) mine.push(freeType(all, taken(), random));
  return mine.map((t, i) => [i, players[i] ?? -1, t!]);
}
