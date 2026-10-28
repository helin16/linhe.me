// Snake Duel's numbers, in one place (constitution VIII; research R7). Distances are arena units.
import { Difficulty } from './enums.ts';

export const ARENA_RADIUS = 2000;   // a circle; leaving it takes a snake out
export const ARENA_SNAKES = 20;     // players plus computer snakes (FR-006)
export const START_LENGTH = 10;     // body segments at the start, and the least boosting can leave
export const MAX_LENGTH = 400;      // segments drawn and checked (longer snakes just get thicker)
export const MAX_MASS = MAX_LENGTH * 2; // a snake's length can't grow past this
export const ORB_TARGET = 400;      // scattered orbs kept in the arena
export const ORB_TOPUP = 8;         // at most this many scattered orbs added per step
export const STEP_HZ = 60;          // simulation steps per second
export const SEGMENT = 9;           // distance between body points
export const SPEED = 170;           // units per second
export const BOOST_SPEED = 330;
export const BOOST_COST = 4;        // segments per second while boosting (dropped as small orbs)
export const TURN_RATE = 3.6;       // radians per second
export const BASE_RADIUS = 9;       // body half-width at the start
export const RADIUS_GROWTH = 0.035; // extra half-width per segment
export const MAX_RADIUS = 26;
export const ORB_RADIUS = 5;        // a size-1 orb; bigger orbs grow with their size
export const OUT_ORB_EVERY = 3;     // an out snake leaves an orb at every 3rd body point
export const OUT_ORB_SIZE = 2;
export const BOT_RESPAWN_MS = 3000;
export const SPAWN_MARGIN = 300;    // new snakes start this far inside the edge
export const SAFE_SPAWN = 450;      // computer snakes never appear this close to a player's head
export const SPAWN_TRIES = 30;

// matches (FR-008)
export const WIN_ROUNDS = 3;
export const QUICK_MS = 300_000;    // a Quick match lasts 5 minutes
export const REJOIN_MS = 3000;      // a player out in a Quick match is back after 3 s
export const COUNTDOWN_S = 3;       // 3-2-1 before each round

// online (research R4)
export const NET_HZ = 20;           // snapshots and inputs per second
export const INTERP_MS = 100;       // guests draw this far behind the newest snapshot
export const ROOM_SIZES = [2, 3, 4, 5, 6, 7, 8];
export const DEFAULT_ROOM_SIZE = 2;
export const LOBBY_COUNTDOWN_MS = 60_000; // as Turbo Tumble's waiting room

// offline replay and test setup (research R9)
export const SEED_QUERY = 'seed';
export const BOTS_QUERY = 'bots';

/** How each difficulty plays (FR-016): turn speed, how often it boosts, how far it looks ahead, and players. */
export const DIFFICULTY: Record<Difficulty, { turn: number; boostChance: number; lookAhead: number; hunts: boolean; avoidsPlayers: boolean }> = {
  [Difficulty.Easy]: { turn: 0.55, boostChance: 0.002, lookAhead: 140, hunts: false, avoidsPlayers: true },
  [Difficulty.Normal]: { turn: 0.8, boostChance: 0.008, lookAhead: 200, hunts: false, avoidsPlayers: false },
  [Difficulty.Hard]: { turn: 1, boostChance: 0.02, lookAhead: 260, hunts: true, avoidsPlayers: false },
};
