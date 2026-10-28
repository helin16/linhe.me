// Saved garage settings. Key and JSON shape are unchanged from the original game so old saves keep working.
import { isMember } from '../../shared/enum.ts';

// values are stored in saves and sent online, so they must never change
export const Track = { Meadow: 'Meadow', Desert: 'Desert', Snow: 'Snow', Neon: 'Neon' } as const;
export type Track = typeof Track[keyof typeof Track];
export const KartStyle = { Classic: 'Classic', Buggy: 'Buggy', Rocket: 'Rocket' } as const;
export type KartStyle = typeof KartStyle[keyof typeof KartStyle];

export type PlayerLook = { name: string; color: string; helmet: string; skin: string; style: KartStyle }; // name: max 10 characters
export type Settings = { players: [PlayerLook, PlayerLook]; two: boolean; map: Track; muted: boolean };

const KEY = 'tt-cfg';
const HEX = /^#[0-9a-f]{6}$/i;

export const defaults = (): Settings => ({
  players: [
    { name: 'Player 1', color: '#ff4444', helmet: '#ffffff', skin: '#ffe0bd', style: KartStyle.Classic },
    { name: 'Player 2', color: '#22cc88', helmet: '#222222', skin: '#c68642', style: KartStyle.Buggy },
  ],
  two: false, map: Track.Meadow, muted: false,
});

/** Parses a saved value; never throws. Anything malformed falls back to its default. */
export function loadSettings(raw: string | null): Settings {
  const d = defaults();
  let s: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null');
    if (parsed && typeof parsed === 'object') s = parsed as Record<string, unknown>;
  } catch {}
  // single-player save from before 2P existed: its look becomes player 1
  const players = s.name ? [s, d.players[1]] : s.players;
  const [p1, p2] = Array.isArray(players) ? players : [];
  return {
    players: [fixLook(p1, d.players[0]), fixLook(p2, d.players[1])],
    two: s.two === true,
    map: isMember(Track, s.map) ? s.map : d.map,
    muted: s.muted === true,
  };
}

function fixLook(p: unknown, d: PlayerLook): PlayerLook {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  const hex = (v: unknown, fallback: string) => typeof v === 'string' && HEX.test(v) ? v : fallback;
  return {
    name: typeof o.name === 'string' ? o.name.slice(0, 10) : d.name,
    color: hex(o.color, d.color),
    helmet: hex(o.helmet, d.helmet),
    skin: hex(o.skin, d.skin),
    style: isMember(KartStyle, o.style) ? o.style : d.style,
  };
}

/** Reads this browser's save, or defaults if storage is unavailable. */
export function loadSaved(): Settings {
  try { return loadSettings(localStorage.getItem(KEY)); } catch { return defaults(); }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
