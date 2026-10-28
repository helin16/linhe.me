# Data Model: Snake Duel

All game state is in memory; settings in this device's storage. Nothing is stored on the server.

## Arena (`sim.ts`)

| Field | Type | Rules |
|---|---|---|
| `radius` | number | `ARENA_RADIUS` (2000); outside it a snake is out |
| `snakes` | Snake[] | always `ARENA_SNAKES` (20): players first, bots fill the rest |
| `orbs` | Map<id, Orb> | topped up to `ORB_TARGET` (~400) |
| `nextId` | number | orb/snake ids |

## Snake

| Field | Type | Rules |
|---|---|---|
| `id` | number | stable for the round |
| `owner` | `{kind: player, slot}` or `{kind: bot}` | slot = relay slot online, 0/1 locally |
| `head` | {x, y} | |
| `heading` | radians | turns toward the target by at most `TURN_RATE` per step |
| `path` | points | spaced `SEGMENT` apart behind the head; count from `length` |
| `length` | number | ≥ `START_LENGTH` (10); +orb size when eating; −`BOOST_COST` per second boosting |
| `boost` | boolean | only while `length > START_LENGTH` |
| `alive` | boolean | false once out; bots respawn after `BOT_RESPAWN_MS` |
| `look` | SnakeLook | players from settings/profile; bots from a fixed list of looks |

## Orb

`{id, x, y, size, color}`: size 1 (scattered) or larger (from an out snake's body).

## Match

| Field | Type | Rules |
|---|---|---|
| `type` | `MatchType` enum | `Deathmatch` or `Quick` |
| `wins` | Record<slot, number> | Deathmatch: first to `WIN_ROUNDS` (3) wins the match |
| `round` | number | Deathmatch: 1, 2, … |
| `timeLeft` | ms | Quick: starts at `QUICK_MS` (300 000) |
| `rejoinAt` | Record<slot, ms> | Quick: an out player comes back at `START_LENGTH` after `REJOIN_MS` (3 000) |
| `state` | `countdown` → `playing` → `round-over` → (`countdown` or `match-over`) | Quick has one round |

Deathmatch round over: only one player alive → they win it; none alive (same step) → draw.
Quick match over: `timeLeft` reaches 0 → the longest player alive wins; tie or nobody alive → draw.

## Snake look (`settings.ts`)

| Field | Type | Rules |
|---|---|---|
| `name` | string | up to 10 characters; blank shows "Player N" |
| `color` | `#rrggbb` | main colour |
| `accent` | `#rrggbb` | pattern colour |
| `pattern` | `SnakePattern` enum | `Solid`, `Stripes`, `Spots`, `TwoTone` |
| `eyes` | `SnakeEyes` enum | `Round`, `Sleepy`, `Angry`, `Starry` |

Anything malformed (saved or received) falls back to the default look, field by field.

## Settings (device)

`{players: [SnakeLook, SnakeLook], difficulty: Difficulty, match: MatchType, best: number, muted: boolean}` under one storage key; the two
main colours differ (P2's is changed if it matches P1's).

## Difficulty

`Difficulty` enum: `Easy`, `Normal` (default), `Hard`. Sets each computer snake's turn rate,
how often it boosts, and whether it targets players (Hard) or keeps away from them (Easy).

## Online room

Relay room (features 003/004) with `size` 2–8 (`ROOM_SIZES`), game slug `snake-duel`.
