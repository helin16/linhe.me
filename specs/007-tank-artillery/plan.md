# Implementation Plan: Tank Clash

**Branch**: `master` (no feature branch) | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-tank-artillery/spec.md`

## Summary

A third game in its own folder, `src/games/tank-clash/`: an original turn-based tank artillery
game, seen from the side on one 2D canvas. `terrain.ts` builds a destructible cell grid from a seed
and a map (random hills, wood bridges, lakes, snow and ice). `sim.ts` runs the battle: two sides,
turns alternating Left/Right with one turn per tank per round, driving within the tank's half,
shells under gravity and wind, blasts that carve ground and take fractional hearts, falling tanks,
snow sliding, and a crate after every round. `bots.ts` aims computer tanks at Easy, Normal or Hard.
A garage like Turbo Tumble's picks the tank type (four types trading angle range, damage, hearts
and grip), name and colour; player 1 picks map, tank count and difficulty. Online uses the shared
lobby; one device (the runner) settles every shot while the active player's own device drives and
aims. The relay gets one generic addition: a per-slot key so a dropped player can rejoin a locked
room and take their tank back.

## Technical Context

**Language/Version**: TypeScript 7.0 (`strict`, `erasableSyntaxOnly`)

**Primary Dependencies**: none new (React 19 for the route component; 2D canvas and Web Audio are
native)

**Storage**: this device's storage for the garage (tank, name, colour per player), map, tank count,
difficulty and mute; the online rejoin key (until the battle ends); nothing on a server

**Testing**: `node --test` unit tests at 100% functions for `terrain.ts`, `sim.ts`, `bots.ts`,
`messages.ts`, `settings.ts`, `seed.ts`, the relay change and the lobby additions; Playwright e2e for
every user story (Chromium + WebKit locally, Firefox in CI); relay e2e for rejoin and isolation

**Target Platform**: as Turbo Tumble (desktop browsers, iPad and phones by touch)

**Project Type**: web app (a third game) + the existing relay (small change)

**Performance Goals**: 60 fps with 10 tanks, a shell, an explosion and falling tanks (SC-002); a shot
appears on other screens within 0.5 s (SC-004); computer turn ≤3 s (SC-005)

**Constraints**: relay limits (8 KB per message, 40 messages/s per client, room size ≤ 12);
deterministic battlefield and shots across browser engines (+ − × ÷ only, hearts in tenths);
original art and name (FR-018); no hard-coded values (VIII)

**Scale/Scope**: rooms of 2–10 players; up to 10 tanks; one shell in flight at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. TypeScript, Vite | All TS; no new packages | Pass |
| II. One folder per game | Game in `src/games/tank-clash/`, lazy-loaded at `/games/tank-clash/`; one games-list entry; uses `src/shared/online/` (two optional, game-neutral additions); imports no other game | Pass |
| III. Playable without a server | 1P and 2P run locally; Online fails cleanly within 5 s (FR-017) | Pass |
| IV. Keyboard and touch | Keys plus on-screen drive/angle buttons, power slider and Fire; whole field fits phones in both orientations | Pass |
| V. Isolated relays | Relay stays game-agnostic: slot keys and reserved slots are generic, per room; rejoin only with the slot's own random key; relay e2e covers rejoin and isolation | Pass |
| VI. Simplicity | 2D canvas, cell grid, static water; runner-settled turns instead of lockstep; relay change is the smallest that allows rejoin (R9) | Pass |
| VII. Tests | Unit tests at 100% functions for every pure module and the relay change; e2e for all seven user stories; relay e2e for rejoin | Pass |
| VIII. No hard-coded values | World, cells, physics, fuel, timers, blast sizes, grip, drop chances, room sizes, tank counts in `constants.ts`; enums for tank type, map, material, side, drop, difficulty, grip, message types, battle phase, registered in the stray-literal check | Pass |
| Hosting | Relay redeployed with the change via `yarn deploy`; no new service | Pass |
| Workflow | `/code-review` before commit; README updated (new game, controls, rejoin) | Pass |

**Post-design re-check**: unchanged after data model and contracts — all Pass.

## Project Structure

### Documentation (this feature)

```text
specs/007-tank-artillery/
├── plan.md
├── research.md              # R1–R13
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── messages.md          # Tank Clash online game messages
│   └── relay-rejoin.md      # the relay's slot key and reserved-slot rejoin
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
relay/
├── protocol.ts                    # Hello gains `key`; KEY_QUERY; parseRelayPath reads ?key=
├── rooms.ts                       # per-slot keys; reserve slot on leave while locked; join with key; clear on open
├── server.ts                      # pass key through
└── *.test.ts, relay.e2e.test.ts   # + rejoin cases
src/shared/online/
├── client.ts                      # connect(..., {key}); NetText.Rejoin wording
└── lobby.ts                       # optional rowTag(slot); "Rejoin battle" when a saved key matches
src/games/tank-clash/              # NEW
├── index.tsx                      # route component (like snake-duel/index.tsx)
├── constants.ts                   # world, cells, physics, fuel, timers, blasts, grip, drops, sizes
├── enums.ts                       # TankType, MapId, Material, Side, Drop, Grip, Difficulty, MsgType, Phase
├── tanks.ts                       # tank type table (angles, damage, hearts, grip)
├── settings.ts                    # garage per player, map, tank count, difficulty, mute; fixLook
├── seed.ts                        # seeded random source, ?seed= (offline only)
├── terrain.ts                     # grid, generation per map, carving, support/falling queries, start spots
├── sim.ts                         # battle: sides, turn order, driving, sliding, shots, damage, crates, winner
├── bots.ts                        # computer aiming and crate seeking per difficulty
├── messages.ts                    # parse/validate online messages; who may send what
├── draw.ts                        # canvas: sky/scenery, ground, tanks per type, health bars, highlight, trail, crates, life panel
├── sound.ts                       # Web Audio sound effects: fire, engine, explosion, crate landing, win/lose tunes; mute
├── game.ts                        # mount(): modes, garage, input, loop, online runner/guest, rejoin
├── game.css
└── *.test.ts
src/games/index.ts                 # + TankClash entry (slug, text, art)
e2e/tank.spec.ts                   # NEW: 1P, 2P, garage, maps, air drops, online, rejoin, relay down
e2e/home.spec.ts                   # + Tank Clash card
package.json                       # coverage include list gains the new modules
README.md                          # the new game, controls, online rejoin
```

**Structure Decision**: same pattern as Snake Duel (pure, tested modules + one `game.ts` that wires
DOM, input and the loop). Terrain is its own module because both the sim and the bots query it.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| Relay change (slot keys, reserved slots) | FR-016: a dropped player can take their tank back mid-battle | Leaving rooms open during battles lists busy rooms and lets a newcomer take slot 0 and become host (R9) |
