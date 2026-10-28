# Implementation Plan: Live standings and room roster for Turbo Tumble

**Branch**: `master` (no feature branch) | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-race-standings/spec.md`

## Summary

A small pure module (`standings.ts`) turns the game's existing race order into the rows to show
(all karts, or the top 3 plus local players on phones) and turns the room's slots and profiles into
a roster (number, colour, name, host, you) plus a computer-kart count. The home page card and the
game's listing text also say it plays online (rooms of up to 12). `game.ts` draws a standings
panel in the HUD (rebuilt only when the order changes) and a roster in the waiting room panel
(redrawn by the existing `netInfo()`). No relay or protocol changes; nothing new is sent or stored.

## Technical Context

**Language/Version**: TypeScript 7.0 (`strict`, `erasableSyntaxOnly`)

**Primary Dependencies**: unchanged (React 19, three 0.128, Vite 8, Playwright 1.64.1)

**Storage**: none

**Testing**: `node --test` unit tests for `standings.ts` (added to the 100%-functions coverage
include); Playwright e2e for both user stories (Chromium + WebKit locally, Firefox in CI)

**Target Platform**: as before (desktop browsers, iPad and phones by touch)

**Project Type**: web app (game UI only)

**Performance Goals**: order changes shown ≤1 s (SC-002); roster changes ≤2 s (SC-003); no DOM
work in frames where the order hasn't changed

**Constraints**: phone layout must not cover touch controls (SC-004); names as text (FR-008)

**Scale/Scope**: up to 12 rows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. TypeScript, Vite | New module and UI in strict TS; no new packages | Pass |
| II. One folder per game | Everything in `src/games/turbo-tumble/` | Pass |
| III. Playable without a server | Standings work in 1P/2P; roster only exists online | Pass |
| IV. Keyboard and touch | Display only; compact layout keeps touch controls clear | Pass |
| V. Isolated relays | No relay change | Pass |
| VI. Simplicity | One small pure module; reuses `ranked()`, `profiles`, `netInfo()` | Pass |
| VII. Tests | Unit tests (100% functions) for `standings.ts`; e2e for each acceptance scenario | Pass |
| VIII. No hard-coded values | `COMPACT_MEDIA`, `COMPACT_TOP`, `UNKNOWN_COLOR` as named constants | Pass |
| Workflow | `/code-review` before commit; README note | Pass |

**Post-design re-check**: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/005-race-standings/
├── plan.md
├── research.md        # R1–R5
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md           # /speckit-tasks
```

No `contracts/`: the feature adds no interface (no messages, routes or settings).

### Source Code (repository root)

```text
src/games/turbo-tumble/
├── standings.ts       # NEW: standingRows, rosterRows, computerKarts, constants
├── standings.test.ts  # NEW
├── game.ts            # HUD standings panel; roster in the waiting room
└── game.css           # panel + roster styles, compact/touch placement
e2e/standings.spec.ts  # NEW: panel in races, roster updates
src/games/index.ts     # listing text: homeTag, tag and description mention online play
package.json           # coverage include for standings.ts
README.md              # one line in Online play / game notes
```

**Structure Decision**: one new pure module beside `net.ts` and `settings.ts`, same pattern.

## Complexity Tracking

No violations to justify.
