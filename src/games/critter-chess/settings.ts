// Critter Chess's saved choices on this device (data-model Settings): player count, each seat's type and Person/Computer
// (local games), computer strength, move speed and mute. Anything malformed falls back field by field.
import { isMember, values } from '../../shared/enum.ts';
import { DEFAULT_PLAYERS, PLAYER_COUNTS } from './constants.ts';
import { CritterType, Difficulty, MoveSpeed, SeatKind } from './enums.ts';

/** `types[i]` and `seats[i]`: seat i's type and kind (six kept, the game uses the first `players`); seat 0 is always a
 *  Person and its type is the one 1 Player and Online use. */
export type Settings = {
  players: number; types: CritterType[]; seats: SeatKind[]; difficulty: Difficulty; speed: MoveSpeed; muted: boolean;
};

const KEY = 'cc-cfg';
const SEATS = 6;

export const defaults = (): Settings => ({
  players: DEFAULT_PLAYERS, types: values(CritterType),
  seats: [SeatKind.Person, SeatKind.Person, ...Array<SeatKind>(SEATS - 2).fill(SeatKind.Computer)],
  difficulty: Difficulty.Normal, speed: MoveSpeed.Normal, muted: false,
});

/** The list with any repeated type swapped for the first one not used yet (no two seats share a type, FR-007). */
export function uniqueTypes(list: CritterType[]): CritterType[] {
  const out: CritterType[] = [];
  list.forEach((t, i) => {
    if (!out.includes(t)) return out.push(t);
    const later = list.slice(i + 1), free = values(CritterType).filter(x => !out.includes(x));
    out.push(free.find(x => !later.includes(x)) ?? free[0]); // prefer a type no later seat wants
  });
  return out;
}

/** Parses a saved value; never throws. */
export function loadSettings(raw: string | null): Settings {
  const d = defaults();
  let s: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) s = parsed as Record<string, unknown>;
  } catch {}
  const list = <T>(v: unknown, ok: (x: unknown) => x is T, fallback: T[]) =>
    fallback.map((f, i) => Array.isArray(v) && ok(v[i]) ? v[i] as T : f);
  const seats = list(s.seats, (x): x is SeatKind => isMember(SeatKind, x), d.seats);
  seats[0] = SeatKind.Person;
  return {
    players: PLAYER_COUNTS.includes(s.players as number) ? s.players as number : d.players,
    types: uniqueTypes(list(s.types, (x): x is CritterType => isMember(CritterType, x), d.types)),
    seats,
    difficulty: isMember(Difficulty, s.difficulty) ? s.difficulty : d.difficulty,
    speed: isMember(MoveSpeed, s.speed) ? s.speed : d.speed,
    muted: s.muted === true,
  };
}

/** Reads this browser's save, or defaults if storage is unavailable. */
export function loadSaved(): Settings {
  try { return loadSettings(localStorage.getItem(KEY)); } catch { return defaults(); }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
