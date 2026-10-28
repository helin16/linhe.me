# Research: Live standings and room roster for Turbo Tumble

## R1. Where the rows come from

- **Decision**: a new pure module `src/games/turbo-tumble/standings.ts` (no three.js, unit tested at
  100% functions): `standingRows(order, compact)` picks the rows to show from the game's existing
  `ranked()` order; `rosterRows(...)` builds the waiting-room list from the room's slots and profiles.
- **Rationale**: FR-009 (same order as positions and results) comes for free by feeding `ranked()`;
  the choice of rows and the roster are logic the constitution wants unit tested; `game.ts` only draws.
- **Alternatives**: computing inside `game.ts` (not unit-testable without three.js).

## R2. "Phone-sized" and placement

- **Decision**: compact when `matchMedia('(max-width: 700px), (max-height: 500px)')` matches
  (`COMPACT_MEDIA`), re-checked each update. Panel sits top-left under the lap counter; on touch
  screens under the button bar and above the steering pad, never at the bottom where the controls
  are. The minimap moves right on touch so they don't overlap.
- **Rationale**: phones in landscape are ≤500 px tall; portrait ≤700 px wide; FR-004 / SC-004.
- **Alternatives**: a fixed kart count limit (ignores screen size).

## R3. Update cost

- **Decision**: rebuild the panel's rows only when a key (row order + finished flags) changes;
  `hud()` runs every frame but compares the key first.
- **Rationale**: ≤12 rows, changes a few times a second at most; meets the 1 s target (FR-002)
  without touching the DOM 60 times a second.

## R4. Roster data

- **Decision**: from what the game already has: our own slot + `cfg.players[0]`, peers' slots +
  `net.profiles` (sent as `me` messages since feature 003). A peer whose `me` hasn't arrived yet
  shows "Player N" in a neutral colour. Re-rendered by `netInfo()`, which already runs on join,
  leave and profile changes; our own edits in the garage already call it via `refreshMenu()`.
- **Rationale**: no new messages, nothing new sent or stored (spec assumptions); 2 s is easily met.

## R5. Safe text

- **Decision**: names go in with `textContent`; colours are set as `style.background` from the
  validated `#rrggbb` hex (profiles are already cleaned by `fixLook`).
