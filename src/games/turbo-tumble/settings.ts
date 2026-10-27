// Saved garage settings. Key and JSON shape are unchanged from the original game so old saves keep working.
export const MAP_NAMES = ['Meadow', 'Desert', 'Snow', 'Neon'] as const;
export const KART_STYLES = ['Classic', 'Buggy', 'Rocket'] as const;
export type MapName = typeof MAP_NAMES[number];
export type KartStyle = typeof KART_STYLES[number];
export type PlayerLook = { name: string; color: string; helmet: string; skin: string; style: KartStyle }; // name: max 10 characters
export type Settings = { players: [PlayerLook, PlayerLook]; two: boolean; map: MapName; muted: boolean };

const KEY = 'tt-cfg';
const HEX = /^#[0-9a-f]{6}$/i;
export const isIn = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T);

export const defaults = (): Settings => ({
  players: [
    { name: 'Player 1', color: '#ff4444', helmet: '#ffffff', skin: '#ffe0bd', style: 'Classic' },
    { name: 'Player 2', color: '#22cc88', helmet: '#222222', skin: '#c68642', style: 'Buggy' },
  ],
  two: false, map: 'Meadow', muted: false,
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
    map: isIn(MAP_NAMES, s.map) ? s.map : d.map,
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
    style: isIn(KART_STYLES, o.style) ? o.style : d.style,
  };
}

/** Reads this browser's save, or defaults if storage is unavailable. */
export function loadSaved(): Settings {
  try { return loadSettings(localStorage.getItem(KEY)); } catch { return defaults(); }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
