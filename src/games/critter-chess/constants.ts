// Critter Chess's numbers, in one place (constitution VIII). Times are ms unless named _S.

export const SQUARE = 8;                  // the 2-player board
export const CROSS_SIZE = 14;             // the 4-player board: 14 × 14 ...
export const CROSS_CORNER = 3;            // ... without its four 3 × 3 corners (160 cells)
export const HEX_SIDE = 12;               // the 6-player hexagon: 12 cells a side (397 cells; research R3)
export const HEX_BACK_Q = -9;            // hexagon: army 0's back rank starts here along its side (q) ...
export const HEX_PAWN_Q = -9;            // ... and its pawn row, two rows in: no king starts in check and no capture is free (research R3)
export const PROMOTE_ROW = 7;             // cross: pawns promote on the 8th row from their own back rank
export const PLAYER_COUNTS = [2, 4, 6];
export const DEFAULT_PLAYERS = 2;

export const TURN_MS = 60_000;            // online move limit (spec Clarifications)
export const COUNTDOWN_MS = 60_000;       // the waiting room's countdown
export const ROOM_SIZES = [2, 4, 6];
export const DEFAULT_ROOM_SIZE = 2;

export const NO_PROGRESS_PLIES = 100;     // 2 players: the 50-move rule
export const NO_PROGRESS_ROUNDS = 50;     // 4/6 players: full rounds with no capture or pawn move end the game
export const REPEATS = 3;                 // threefold repetition (2 players)

// computer players (research R5)
export const VALUE = { King: 0, Queen: 9, Rook: 5, Bishop: 3, Knight: 3, Pawn: 1 } as const;
export const CENTRE_WEIGHT = 0.05;        // a little for standing near the middle
export const KING_WEIGHT = 0.15;          // a king straying from its back rank costs this much per cell
export const ADVANCE_WEIGHT = 0.04;       // a little for pawns pushed forward
export const CHECK_BONUS = 0.3;           // Normal: a little for giving check (it helps finish games)
export const HANG_WEIGHT = 0.9;           // Normal: share of a piece's value lost by leaving it attacked and undefended
export const EASY_CAPTURE_CHANCE = 0.5;   // Easy prefers a capture this often
export const MATE_SCORE = 1000;
export const BOT_BUDGET_MS = 1500;        // a computer move is worked out within this (SC-003: 2 s)
export const MAX_DEPTH = 4;               // Hard, 2 players: deepest search tried
export const BOT_DELAY_MS = 400;          // a computer move waits this long so people can follow
export const MOVE_MS = 380;               // a move's animation at normal pace
export const FAST_FACTOR = 5;

export const MAX_SEED = 2 ** 31;
export const FLASH_MS = 2500;
export const TAP_PX = 8;
export const SPOTS_S = 0.2;
export const REJOIN_MS = 30 * 60_000;
export const PENDING_MS = 3000;
export const RECENT_MOVES = 10;           // the move list shows this many
