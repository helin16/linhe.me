// Tank Clash's saved choices on this device: both players' tanks (type, name, colour), map, tank count, difficulty,
// mute and whether the overview map shows. Anything malformed falls back to its default, field by field.
import { isMember } from '../../shared/enum.ts';
import { DEFAULT_TANKS, TANK_COUNTS } from './constants.ts';
import { Difficulty, MapId, Side, TankType, Variant } from './enums.ts';
import { DEFAULT_TYPE, DEFAULT_VARIANT } from './tanks.ts';

/** A player's tank as picked in the garage; online it also carries the side they chose. */
export type TankLook = { name: string; color: string; type: TankType; variant?: Variant; side?: Side };
export type Settings = { players: [TankLook, TankLook]; map: MapId; tanks: number; difficulty: Difficulty; muted: boolean; overview: boolean };

const KEY = 'tc-cfg';
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_NAME = 10;
const OTHER_COLOR = '#ffcc00'; // player 2's colour when it would match player 1's

export const defaults = (): Settings => ({
  players: [
    { name: 'Player 1', color: '#4caf50', type: DEFAULT_TYPE, variant: DEFAULT_VARIANT },
    { name: 'Player 2', color: '#e53935', type: DEFAULT_TYPE, variant: DEFAULT_VARIANT },
  ],
  map: MapId.Random, tanks: DEFAULT_TANKS, difficulty: Difficulty.Normal, muted: false, overview: true,
});

export function fixLook(p: unknown, d: TankLook): TankLook {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  const look: TankLook = {
    name: typeof o.name === 'string' ? o.name.slice(0, MAX_NAME) : d.name,
    color: typeof o.color === 'string' && HEX.test(o.color) ? o.color.toLowerCase() : d.color,
    type: isMember(TankType, o.type) ? o.type : d.type,
    variant: isMember(Variant, o.variant) ? o.variant : d.variant ?? DEFAULT_VARIANT,
  };
  if (isMember(Side, o.side)) look.side = o.side;
  return look;
}

/** Player 2's look with a colour different from player 1's; `changed` says whether it was moved. */
export function distinctColors(p1: TankLook, p2: TankLook) {
  if (p1.color !== p2.color) return { p2, changed: false };
  return { p2: { ...p2, color: p1.color === OTHER_COLOR ? defaults().players[1].color : OTHER_COLOR }, changed: true };
}

/** Parses a saved value; never throws. */
export function loadSettings(raw: string | null): Settings {
  const d = defaults();
  let s: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null');
    if (parsed && typeof parsed === 'object') s = parsed as Record<string, unknown>;
  } catch {}
  const [p1, p2] = Array.isArray(s.players) ? s.players : [];
  const { side: _a, ...one } = fixLook(p1, d.players[0]); // sides are chosen per room, not saved
  const { side: _b, ...two } = fixLook(p2, d.players[1]);
  return {
    players: [one, distinctColors(one, two).p2],
    map: isMember(MapId, s.map) ? s.map : d.map,
    tanks: TANK_COUNTS.includes(s.tanks as number) ? s.tanks as number : d.tanks,
    difficulty: isMember(Difficulty, s.difficulty) ? s.difficulty : d.difficulty,
    muted: s.muted === true,
    overview: s.overview !== false, // an old saved style (Arcade, removed) is simply not read
  };
}

/** Reads this browser's save, or defaults if storage is unavailable. */
export function loadSaved(): Settings {
  try { return loadSettings(localStorage.getItem(KEY)); } catch { return defaults(); }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
