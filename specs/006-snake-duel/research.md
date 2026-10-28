# Research: Snake Duel

## R1. Drawing: 2D canvas, no new dependency

- **Decision**: one `<canvas>` with the 2D context; snakes as thick round-capped strokes along their
  body path with a glow, orbs as soft circles, a grid-dot background, a circular arena edge. A
  second small canvas is the minimap. 2P splits the canvas into two viewports (side by side in
  landscape, stacked in portrait).
- **Rationale**: top-down 2D (spec assumptions); the 2D canvas is native, fast enough for 20 snakes
  and a few hundred orbs on phones; no three.js needed (constitution VI).
- **Alternatives**: three.js (heavier, nothing gained in 2D); DOM/SVG (too slow at this count).

## R2. Simulation: pure, fixed step

- **Decision**: `sim.ts` holds the whole game state and a `step(state, inputs, dt)` with a fixed
  60 Hz step; rendering interpolates between steps. A snake is a head point, heading, speed and a
  body path (points spaced evenly behind the head; length decides how many). Turning is limited per
  step; boosting raises speed, shrinks length over time and drops small orbs, never below the start
  length. Collision: head against other snakes' body points within their radius, using a spatial
  hash grid rebuilt each step (20 snakes, fine at 60 Hz); head-to-head = both out. Arena: a circle;
  leaving it = out. Out snakes turn into orbs along their body.
- **Rationale**: one pure module is unit-testable at 100% functions (constitution VII) and runs the
  same offline and on the online host.
- **Alternatives**: a grid snake (rejected by the owner's "snake.io style").

## R3. Computer snakes

- **Decision**: `bots.ts`: each bot picks a target (nearest cluster of orbs, sometimes a wander
  point), looks ahead along its heading and a few angles for bodies or the edge, and turns away
  from danger; it boosts briefly when chasing big orbs or a nearby player's path. Bots fill the
  arena to 20 snakes and respawn a few seconds after going out.
- **Difficulty** (Easy/Normal/Hard): one table of numbers per level (turn rate, boost chance, look-ahead
  distance, whether players are targets or avoided); Hard bots pick a player's predicted path as their
  target and boost to cross it.
- **Rationale**: simple, deterministic given a random source, unit-testable with a stub random.

## R4. Online: one device runs the arena

- **Decision**: one device, the runner (first the host; see "Who runs the arena" below), runs `sim.ts` for everyone (players and bots). Guests send their
  input (`in`: target heading, boost) ~20 times a second; the host sends a snapshot (`snap`) ~20
  times a second: each snake's head, heading, length, boost and in/out, plus orbs eaten and added
  since the last snapshot. Guests rebuild bodies from the head trail they receive and draw ~100 ms
  behind the newest snapshot, interpolating; a full orb list (`orbs`) is sent at round start and to
  anyone joining between rounds. Round and match results (`round`, `match`) come from the host.
- **Rationale**: one authority means every screen agrees on take-outs and winners (FR-011,
  SC-003); snapshots stay small (20 snakes × 6 numbers ≈ 1 KB) under the relay's 8 KB message cap
  and both directions stay under its 40 messages/s rate; ≤0.5 s view delay (SC-004) on normal links.
- **Alternatives**: lockstep (any lag freezes everyone; harder with drops); full bodies in every
  snapshot (too big at length 200+). Guests' own snake is not predicted locally:
  `ponytail:` add prediction if guests find steering laggy on slow links.
- **Host leaves**: as in the relay's lobby, the next lowest slot becomes host; it restarts the
  round from its last snapshot (bots re-created where they were), so the match continues (US3
  scenario 6).
- **Who runs the arena**: a game-level role, the *runner*, separate from the relay's host (who
  still owns the lobby controls). It starts as the host. The runner hands over with `hand {to}`
  (sent with a final `snap`) when its tab is hidden, and a runner who leaves or drops is replaced by
  the lowest remaining slot, which continues from the last `snap` it has. The relay needs no change
  (it can't move hosting, and racing rooms refuse rejoins). Runner-only messages: `orbs`, `mode`,
  `begin`, `snap`, `round`, `clock`, `match`, `hand`.
- **Lobby controls**: exactly as Turbo Tumble: the host sends the relay's `room-lock` before
  `begin` and `room-open` when back in the waiting room after a match; Cancel sends `room-close`.

## R5. Shared online code (constitution II)

- **Decision**: the whole lobby moves to `src/shared/online/` so both games use the same one
  (the owner wants Snake Duel's online lobby to work exactly like Turbo Tumble's): the relay client
  (`connect`, close messages, `fetchRooms`, `joinLink`/`roomFromUrl` taking the game's slug, the
  countdown clock), the roster rows (`rosterRows`, `computerKarts` → `computerSpots`) and a DOM
  module for the Online popup (room list, Host a room with the game's size range, join by code)
  and the waiting room (name, n/size, roster, countdown, Start/Cancel/Leave, code and Copy link),
  with its CSS. Each game passes its slug, room sizes, wording ("computer karts" / "computer
  snakes") and callbacks (start, profile). Turbo Tumble switches to it with no visible change; its
  game messages, standings and 12-kart logic stay in its folder.
- **Rationale**: II forbids one game importing another's folder and requires shared code to be used
  by two games; now it is. Behaviour is covered by Turbo Tumble's existing unit and e2e tests.

## R6. Controls

- **Decision**: mouse: heading = direction from the snake's screen position to the pointer; hold
  button or Space to boost. Keys: 1P ←/→ or A/D turn (continuous turning), ↑/W/Space boost; 2P
  A/D + W and ←/→ + ↑. Touch: a virtual stick (heading = stick direction) and a boost button per
  player, on that player's half in 2P.

## R8. Customising the snake

- **Decision**: a garage panel like Turbo Tumble's (name, two colour pickers, pattern and eyes as
  option buttons, P1/P2 tabs in 2P) with a live preview drawn by the same renderer as the game.
  Patterns are drawn along the body: Stripes alternate main/accent every few segments, Spots put
  accent dots on every third segment, Two-tone draws the accent on one side; eyes are small
  shapes on the head. Looks are cleaned like Turbo Tumble's `fixLook` when loaded or received.
- **Rationale**: FR-014 / US5; one drawing path for preview and game.

## R9. Seeded games for replay and tests

- **Decision**: `seed.ts` makes a seeded random source; `sim.ts` and `bots.ts` take it as an input.
  `game.ts` seeds from `?seed=<number>` in 1 Player and 2 Players (otherwise from the clock);
  `?bots=0` keeps computer snakes still. Online ignores both.
- **Rationale**: the constitution runs browser tests against the production build, so the tests
  need a way to set up exact situations that is harmless to ship: a fixed seed only changes where
  things start, not the rules, and only in offline modes. No test-only code ships.
- **Alternatives**: a `window` test hook (would be a cheat hook on the live site, or absent from
  the production build the tests must use).

## R7. Constants

- Arena radius 2000 units; start length 10; 20 snakes; ~400 orbs kept topped up; step 60 Hz;
  snapshots and inputs 20 Hz; interpolation delay 100 ms; Deathmatch first to 3 round wins; Quick
  match 5 minutes with a 3 s rejoin; room sizes 2–8.
  All named constants in one module (constitution VIII).
