# Implementation Plan: Turbo Tumble's 3D look and speed

**Branch**: `master` (this repo works on master) | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-turbo-3d-look/spec.md`

## Summary

Give Turbo Tumble the same toy-like 3D look as Tank Clash without touching its race: rounded karts per style with
drivers who steer, procedural textures for road and ground, rounded kerbs and barriers, a sun with soft shadows (Neon at
night), layered scenery, a few start-line props, one moving effect per track and drift puffs; antialiasing on graphics
chips only, and automatic low detail on slow devices, for split screen too. The look goes into two new modules
(`look.ts` pure, `view.ts` browser-only); shared helpers move to `src/shared/render.ts`; `game.ts`'s race code is not
edited.

## Technical Context

**Language/Version**: TypeScript (strict), Vite (constitution I)

**Primary Dependencies**: three 0.128.0 (already used). No new dependencies.

**Storage**: none new (settings unchanged)

**Testing**: `node --test` with 100% function coverage (add `look.ts`); Playwright on Chromium, WebKit (iPad), Firefox

**Target Platform**: desktop, iPad and phone browsers

**Project Type**: a game inside the site, lazy-loaded at `/games/turbo-tumble/`

**Performance Goals**: at least 50 fps in Chromium for a race and for split screen with every effect on (SC-001, a new
test); low detail kicks in under 55 fps after 2 s

**Constraints**: race code, collisions, online messages and controls unchanged (FR-010, SC-002); no image files (FR-011);
no memory growth across visits (FR-012)

**Scale/Scope**: Turbo Tumble's folder plus one shared module; Tank Clash's scene.ts switches to the shared helpers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. TypeScript, Vite, npm | All TypeScript; three already locked; textures made in code | Pass |
| II. One folder per game | Turbo Tumble's look in its folder; `src/shared/render.ts` and `src/shared/detail.ts` are each used by two games (Turbo Tumble, Tank Clash) | Pass |
| III. Playable without a server | Look only; offline modes unaffected | Pass |
| IV. Keyboard and touch | Controls unchanged; layout unchanged | Pass |
| V. Relays | No message or relay change | Pass |
| VI. Simplicity | No new dependency; two focused modules instead of growing game.ts; shared code moved, not copied | Pass |
| VII. Tests | `look.ts` unit tested; the browser-only view covered by new end-to-end tests on all engines; existing Turbo Tumble tests unchanged | Pass |
| VIII. Values and enums | Track looks and detail thresholds as named constants/tables; new fixed sets (road, ground, effect, puff kinds) as enums | Pass |

Post-design re-check: still passes.

## Project Structure

### Documentation (this feature)

```text
specs/010-turbo-3d-look/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/ui.md
└── tasks.md          # next: /speckit-tasks
```

### Source Code (repository root)

```text
src/shared/render.ts                 NEW     browser-only helpers shared by both 3D games: softwareGpu(), texture(),
                                             LOW_DETAIL_RATIO (moved from tank-clash/scene.ts)
src/shared/detail.ts (+ test)        NEW     pure: `Detail` (const object) and the frame-rate probe (moved from tank-clash/scene.ts)
src/games/tank-clash/scene.ts        CHANGE  use src/shared/render.ts and detail.ts (no behaviour change)
src/games/turbo-tumble/look.ts       NEW     pure: kartModel(style, colours), setSteer, spinWheels, steerFrom, TRACK_LOOKS
src/games/turbo-tumble/look.test.ts  NEW
src/games/turbo-tumble/view.ts       NEW     browser-only: textures, sun/shadows (following each view's kart), scenery
                                             layers, start-line props, moving effect, drift puffs, low detail
src/games/turbo-tumble/enums.ts      CHANGE  RoadKind, GroundKind, Effect, PuffKind
src/games/turbo-tumble/game.ts       CHANGE  buildKart/buildTrack use look.ts and view.ts; antialiasing from render.ts,
                                             detail level from detail.ts; test aids; race code untouched
src/no-stray-literals.test.ts        CHANGE  register the new enums
package.json                         CHANGE  coverage list: add turbo-tumble/look.ts and shared/detail.ts
e2e/turbo.spec.ts                    NEW     frame rate (race, split screen), kart styles, textures, shadow, Neon night,
                                             low detail, no memory growth
```

**Structure Decision**: Keep the race in `game.ts` and move everything about how it looks into `look.ts` (unit tested)
and `view.ts` (end-to-end tested), mirroring Tank Clash's models.ts / scene.ts split.

## Delivery order

1. Shared helpers (`src/shared/render.ts`, `src/shared/detail.ts`) and Tank Clash switched to them; Turbo Tumble's antialiasing rule.
2. Karts (US1): `look.ts` kart models and drivers, wired into `buildKart`.
3. Tracks (US2): textures, rounded kerbs and barriers, sun and shadows, Neon at night, start-line props.
4. Scenery and effects (US3): layers, sky, clouds/stars, moving effect, drift puffs.
5. Speed (US4): low detail, the new frame-rate tests, memory check.

The game stays playable after each step.

## Complexity Tracking

No constitution violations to justify.
