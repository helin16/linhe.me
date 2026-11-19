// Critter Hop's numbers, in one place (constitution VIII). Times are ms unless named _S.

export const PIECES = 10;                 // creatures per team (FR-002)
export const PLAYER_COUNTS = [2, 4, 6];   // FR-003
export const DEFAULT_PLAYERS = 2;
export const STAR_SIDE = 4;               // the star: a hexagon of radius 4 plus six points of 4 rows
export const CROSS_HALF = 2;              // the cross: a 5 × 5 centre (−2..2)
export const CROSS_ARM = 4;               // arms 4 deep
export const CROSS_HOME_ROWS = 2;         // a home is an arm's outer 2 rows (10 holes)

export const TURN_MS = 60_000;            // FR-017
export const STALL_ROUNDS = 20;           // FR-022
export const STALL_WARN = 10;             // the stall counter shows from this round
export const COUNTDOWN_MS = 60_000;       // the waiting room's countdown
export const ROOM_SIZES = [2, 4, 6];
export const DEFAULT_ROOM_SIZE = 4;

// computer players (research R4)
export const ROW_WEIGHT = 4;              // a row toward the target is worth this much more than sideways closeness
export const REAR_BONUS = 1;              // moving the creature furthest behind
export const EASY_TOP = 3;                // Easy picks among this many best moves
export const EASY_STEP_CHANCE = 0.25;     // and sometimes just a plain forward step
export const FOLLOW_WEIGHT = 0.5;         // Hard: share of its best follow-up move counted
export const BLOCK_BONUS = 2;             // Hard: taking away the leader's best move
export const BOT_BUDGET_MS = 1000;        // a computer move is worked out within this (SC-005)
export const BOT_DELAY_MS = 500;          // a computer move waits this long so people can follow
export const HOP_MS = 260;                // one segment of a move's animation at normal speed
export const FAST_FACTOR = 5;             // Fast hop speed (FR-023)

export const SEED_QUERY = 'seed';
export const MAX_SEED = 2 ** 31;         // game seeds are below this (sent online: the host's and the guests' check agree)
export const FLASH_MS = 2500;            // banners show this long
export const TAP_PX = 8;                 // a pointer that moved less than this is a tap, not a turn of the board
export const SPOTS_S = 0.2;              // the move buttons' screen positions are refreshed this often
export const REJOIN_MS = 30 * 60_000;    // a saved rejoin key is offered this long
export const PENDING_MS = 3000;          // online: a move sent to the runner that doesn't come back by then is dropped
