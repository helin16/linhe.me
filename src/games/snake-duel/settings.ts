// Snake Duel's saved choices on this device (FR-014, FR-016): both players' snake looks, difficulty, match type,
// the best solo length and mute. Anything malformed falls back to its default, field by field.
import { isMember } from '../../shared/enum.ts';
import { Difficulty, MatchType, SnakeEyes, SnakePattern } from './enums.ts';

export type SnakeLook = { name: string; color: string; accent: string; pattern: SnakePattern; eyes: SnakeEyes };
export type Settings = { players: [SnakeLook, SnakeLook]; difficulty: Difficulty; match: MatchType; best: number; muted: boolean };

const KEY = 'sd-cfg';
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_NAME = 10;
const OTHER_COLOR = '#ffcc00'; // player 2's colour when it would match player 1's

export const defaults = (): Settings => ({
  players: [
    { name: 'Player 1', color: '#33dd77', accent: '#0d5c2e', pattern: SnakePattern.Stripes, eyes: SnakeEyes.Round },
    { name: 'Player 2', color: '#4aa8ff', accent: '#ffffff', pattern: SnakePattern.Spots, eyes: SnakeEyes.Angry },
  ],
  difficulty: Difficulty.Normal, match: MatchType.Deathmatch, best: 0, muted: false,
});

export function fixLook(p: unknown, d: SnakeLook): SnakeLook {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  const hex = (v: unknown, fallback: string) => typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback;
  return {
    name: typeof o.name === 'string' ? o.name.slice(0, MAX_NAME) : d.name,
    color: hex(o.color, d.color),
    accent: hex(o.accent, d.accent),
    pattern: isMember(SnakePattern, o.pattern) ? o.pattern : d.pattern,
    eyes: isMember(SnakeEyes, o.eyes) ? o.eyes : d.eyes,
  };
}

/** Player 2's look with a main colour different from player 1's (FR-014); `changed` says whether it was moved. */
export function distinctColors(p1: SnakeLook, p2: SnakeLook) {
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
  const one = fixLook(p1, d.players[0]);
  return {
    players: [one, distinctColors(one, fixLook(p2, d.players[1])).p2],
    difficulty: isMember(Difficulty, s.difficulty) ? s.difficulty : d.difficulty,
    match: isMember(MatchType, s.match) ? s.match : d.match,
    best: Number.isInteger(s.best) && (s.best as number) >= 0 ? s.best as number : 0,
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
