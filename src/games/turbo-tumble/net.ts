// Turbo Tumble's connection to the relay (specs/003-online-relay/contracts/relay-protocol.md).
import { isMember } from '../../shared/enum.ts';
import { MsgType } from './enums.ts';
import { defaults, fixLook, Track, type PlayerLook } from './settings.ts';

export const MAX_SLOTS = 12; // grid spots in the largest online race
export const ROOM_SIZES = [4, 5, 6, 7, 8, 9, 10, 11, 12]; // what a host may pick (FR-015)
export const COUNTDOWN_MS = 60_000; // a waiting room's countdown (FR-005)

// x, z, heading, speed, lap, idx, body rotation, spark, finished, finish time
export type NetState = [number, number, number, number, number, number, number, number, number, number];
export type Msg =
  | { t: typeof MsgType.Me; from: number; p: PlayerLook }
  | { t: typeof MsgType.Start; from: number; map: string }
  | { t: typeof MsgType.State; from: number; k: [number, ...NetState][] }
  | { t: typeof MsgType.Goo; from: number; x: number; z: number; id: string }
  | { t: typeof MsgType.Pop; from: number; id: string }
  | { t: typeof MsgType.Zap; from: number; by: number; to: number };

const MAX_ID = 32; // puddle ids are short ("<slot>-<n>")
const NET_STATE_LENGTH = 10;
const isSlot = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < MAX_SLOTS;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_ID;
const kartState = (e: unknown) => Array.isArray(e) && e.length === NET_STATE_LENGTH + 1 && isSlot(e[0]) && e.every(isNum);

/** Checks a message from another player; returns it (a profile cleaned like a saved look) or null if it's malformed.
 *  The relay stamps every player's message with `from` (its own join/leave are handled by the shared lobby). */
export function parseGameMessage(raw: unknown): Msg | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  if (!isSlot(m.from)) return null;
  switch (m.t) {
    case MsgType.Me: return { ...m, p: fixLook(m.p, { ...defaults().players[0], name: '' }) } as Msg;
    case MsgType.Start: return isMember(Track, m.map) ? raw as Msg : null;
    case MsgType.State: return Array.isArray(m.k) && m.k.length <= MAX_SLOTS && m.k.every(kartState) ? raw as Msg : null;
    case MsgType.Goo: return isNum(m.x) && isNum(m.z) && isId(m.id) ? raw as Msg : null;
    case MsgType.Pop: return isId(m.id) ? raw as Msg : null;
    case MsgType.Zap: return isSlot(m.by) && isSlot(m.to) ? raw as Msg : null;
    default: return null;
  }
}

/** What a peer may do: move its own kart (the host also the AI karts), zap as itself, and only the host starts races.
 *  Returns the message (kart updates trimmed to allowed karts) or null; takes our own slot, the other players'
 *  slots and the room size (slots at or past it don't exist in this race). */
export function allowedFrom(m: Msg, me: number, peers: Iterable<number>, size: number): Msg | null {
  const players = new Set([me, ...peers]), host = Math.min(...players), from = m.from;
  if (m.t === MsgType.Start) return from === host ? m : null;
  const ai = (slot: number) => from === host && !players.has(slot) && slot < size; // the host drives empty grid spots
  if (m.t === MsgType.Zap) return (m.by === from || ai(m.by)) && m.to < size ? m : null;
  if (m.t === MsgType.Goo) return m.id.startsWith(`${from}-`) ? m : null; // puddle ids are "<slot>-<n>"
  if (m.t !== MsgType.State) return m;
  const k = m.k.filter(([slot]) => slot === from || ai(slot));
  return k.length ? { ...m, k } : null;
}
