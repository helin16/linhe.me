// Tank Clash's numbers, in one place (constitution VIII; research R13). Distances are world units (the field is
// WORLD_W × WORLD_H, y down), times are seconds unless named _MS, hearts are tenths. First guesses, to be tuned.
import { Difficulty, Drop, Grip } from './enums.ts';

export const WORLD_W = 1600;
export const WORLD_H = 900;
export const CELL = 4;                 // the ground grid's cell size
export const GRID_W = WORLD_W / CELL;
export const GRID_H = WORLD_H / CELL;
export const STEP_HZ = 60;             // simulation steps per second

// battlefield generation (FR-008)
export const HILLS_MIN = 2;
export const HILLS_MAX = 6;
export const HILL_MIN_H = 0.2;         // peaks, as a share of WORLD_H above the bottom
export const HILL_MAX_H = 0.5;         // never higher (FR-008)
export const VALLEY_MIN_H = 0.1;       // the dips between peaks
export const VALLEY_MAX_H = 0.18;
export const GAPS = [1, 2];            // Timber Gap: gaps crossed by bridges
export const GAP_W = [80, 140];        // a gap's width range
export const BRIDGE_CELLS = 2;         // a bridge's thickness
export const LAKES = [1, 3];
export const LAKE_DEPTH = [24, 44];
export const SNOW_AREAS = [1, 3];
export const SNOW_W = [180, 420];
export const SNOW_CELLS = 3;           // a snow area's depth
export const ICE_CELLS = 2;
export const ICE_CHANCE = 0.5;         // a snow area has an ice patch
export const GEN_TRIES = 20;           // battlefields tried before falling back to Green Hills

// tanks
export const TANK_W = 48;
export const TANK_H = 26;
export const MAX_CLIMB = 1.19;         // rise per unit across the tank's length (50°)
export const ANGLE_SPEED = 40;         // degrees per second while ↑/↓ is held
export const POWER_SPEED = 45;         // power points per second while Q/E is held
export const START_ANGLE = 45;
export const START_POWER = 60;
export const START_GAP = 8;            // tanks start at least this far apart (beyond touching)

// shots (FR-004, FR-005)
export const GRAVITY = 400;            // units per second²
export const POWER_SCALE = 7.6;        // shell speed per power point: 100 at 45° crosses the field
export const BLAST_R = 40;
export const WOOD_BLAST_FACTOR = 1.5;  // wood breaks within a bigger radius (FR-009)
export const TRAIL_MAX = 240;          // points kept for the shell's trail
export const MUZZLE = 30;              // the shell starts this far from the tank's centre along the cannon
export const CANNON_H = 18.2;          // the cannon's pivot above the tank's bottom (0.7 of TANK_H)
export const SETTLE_MIN = 0.6;         // an explosion shows at least this long before the next turn
export const FALL_OUT = WORLD_H + 80;  // past this a falling thing has left the screen

// snow and ice (FR-011)
export const SLIDE = 24;
export const ICE_SLIDE_FACTOR = 1.3;
export const GROUND_SLIDE_FACTOR = 0.5; // on earth and wood a low-grip tank still rolls on a little after letting go
export const SLIDE_SPEED = 90;
export const GRIP_SLIDE: Record<Grip, number> = { [Grip.High]: 0, [Grip.Medium]: 0.5, [Grip.Low]: 1 };

// turns (FR-003)
export const TURN_MS = 30_000;
export const BIG_COUNT_MS = 10_000;    // the last seconds of a turn are counted down big on screen

// air drops (FR-020, FR-021)
export const CRATE_FALL_MS = 4000;
export const CRATE_SIZE = 22;
export const MAX_CRATES = 3;
export const DROP_CHANCES: [Drop, number][] = [[Drop.Repair, 35], [Drop.Power, 25], [Drop.GripGear, 25], [Drop.Shield, 5], [Drop.Missile, 10]];
export const POWER_SHELL_FACTOR = 1.5;
export const REPAIR = 10;
export const MISSILE_DAMAGE_FACTOR = 2;
export const MISSILE_SPEED_FACTOR = 1.5; // a missile flies this much faster: over twice as far

// computer tanks (FR-012, SC-005)
export const BOT_THINK_S = 0.9;        // before it acts
export const BOT_DRIVE_S = 1.5;        // at most this long driving to a crate
export const BOT_TURN_S = 3;           // the whole turn
export const DIFFICULTY: Record<Difficulty, { angleError: number; powerError: number }> = {
  [Difficulty.Easy]: { angleError: 12, powerError: 14 },
  [Difficulty.Normal]: { angleError: 5, powerError: 6 },
  [Difficulty.Hard]: { angleError: 1, powerError: 1 },
};

// games and rooms
export const TANK_COUNTS = [2, 4, 6, 8, 10];
export const DEFAULT_TANKS = 2;
export const ROOM_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10];
export const DEFAULT_ROOM_SIZE = 2;
export const LOBBY_COUNTDOWN_MS = 60_000;
export const POSE_HZ = 15;

// offline replay and test setup (research R12)
export const SEED_QUERY = 'seed';

// the 3D view (specs/009-tank-semi-3d research R2–R10) and the camera (specs/008-tank-focus-camera)
export const GROUND_DEPTH = 70;        // the ground slab runs this far back into the scene
export const CAMERA_FOV = 30;          // degrees, vertical: narrow, so shell arcs read as today
export const CAMERA_TILT_DEG = 6;      // the camera looks down a little, so hill tops show as a strip
export const CLOSE_HALF_W = WORLD_W / 4; // the close view shows half the field's width
export const FAR_LAYER_Z = -600;       // the far mountains
export const NEAR_LAYER_Z = -250;      // the near hills with trees and props
export const FOLLOW_BAND = 1 / 3;      // the active tank stays inside the middle third of the view
export const SHOT_PAD = 80;            // room kept around the tank and the shell in a shot view
export const GLIDE_S = 0.2;            // the camera's smoothing time constant: within 1% of its target in 1 s
export const MAX_STEP = 0.05;          // the most a view may move or resize in a frame, as a share of its width
export const SETTLE_HOLD_S = 0.3;      // after a shot, the view stays on its blast this long once the battle settles
export const LOOK_STEP = 120;          // units the view moves per [ or ] press
export const LOW_DETAIL_FPS = 55;      // below this after DETAIL_PROBE_S, drop to low detail (aiming for 60, at least 50)
export const DETAIL_PROBE_S = 2;
export const OVERVIEW_OPACITY = 0.6;
