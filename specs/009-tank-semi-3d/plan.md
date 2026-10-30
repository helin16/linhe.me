# Implementation Plan: Tank Clash in 3D, with focus camera and overview map (008 + 009)

**Branch**: `master` (this repo works on master) | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md) and
[008 spec](../008-tank-focus-camera/spec.md)

**Input**: Feature specifications `specs/009-tank-semi-3d/spec.md` and `specs/008-tank-focus-camera/spec.md`,
planned together at the owner's request (both replace how the battle is drawn).

## Summary

Replace Tank Clash's 2D canvas drawing with a real 3D scene in three.js (already a dependency), seen
side-on with depth: a solid ground built from the breakable grid, solid tanks, wrecks, crates and props,
layered scenery, lights and shadows. Add a camera that zooms in on the tank in turn and pulls back to frame
each shot, and a see-through overview map that can be dragged (or hidden). Remove Arcade style. The battle
rules, computer players and online messages don't change.

## Technical Context

**Language/Version**: TypeScript (strict), React shell, Vite build (constitution I)

**Primary Dependencies**: three 0.128.0 (already locked; used by Turbo Tumble). No new dependencies.

**Storage**: the device's local storage via `settings.ts` (adds `overview`, drops `style`)

**Testing**: `node --test` with 100% function coverage on pure modules; Playwright e2e on Chromium,
Firefox and WebKit (iPad)

**Target Platform**: modern browsers on desktop, iPad and phones (Safari included)

**Project Type**: web game inside the site, lazy-loaded at `/games/tank-clash/`

**Performance Goals**: as today with 10 tanks (007 SC-002, run by the existing frame-rate e2e test);
a battle opens within 1 s of today's time (009 SC-005); a blast rebuilds only the ground chunks it touched

**Constraints**: rendering never writes to the battle (009 SC-004); side-on view (009 clarification A);
no manual zoom (008 clarification); labels readable at every zoom

**Scale/Scope**: one game folder; 10 files changed, 8 new (5 modules and 3 unit test files), 4 deleted (see structure)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. TypeScript, Vite, npm only | All new code TypeScript; three from npm (already locked); procedural textures, no CDN | Pass |
| II. One folder per game | All changes in `src/games/tank-clash/`; nothing imported from `turbo-tumble/` (three is shared through npm, not code) | Pass |
| III. Playable without a server | Camera and map are per screen; offline modes unaffected | Pass |
| IV. Keyboard and touch | Overview drag by touch/mouse/pen, tap to centre, `[`/`]`/`F` keys; hide button reachable by all three; layout keeps the map clear of controls on phones; labelled elements | Pass |
| V. Relays | No relay or message change | Pass |
| VI. Simplicity first | No new dependency; pure logic split out only where it is tested (camera, ground, models); Arcade code deleted in the same change | Pass |
| VII. Tests | Unit tests for `camera.ts`, `ground.ts`, `models.ts`, settings; WebGL scene, overview drawing and input covered by e2e on all three engines; every acceptance scenario of 008 and 009 gets an e2e test | Pass |
| VIII. No hard-coded values; enums | `CameraMode` enum; camera, depth and detail tuning as named constants in `constants.ts`; `Style` enum and its stray-literal entry removed | Pass |

Post-design re-check (after research, data model and contracts): still passes; no violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/009-tank-semi-3d/
├── plan.md              # this file (covers 008 too)
├── research.md          # R1–R11 decisions
├── data-model.md        # View, CameraMode, Camera, Settings, ground chunks, models
├── quickstart.md        # how to check it
├── contracts/ui.md      # elements, data attributes, keys, saved settings
├── look/                # before screenshots for the manual look check (saved in T003)
└── tasks.md             # next: /speckit-tasks
```

### Source Code (repository root)

```text
src/games/tank-clash/
├── camera.ts        NEW   pure: view targets (turn, shot, end), clamping, smoothing, overview ⇄ field mapping
├── camera.test.ts   NEW
├── ground.ts        NEW   pure: marching-squares ground mesh data per chunk and material, dirty chunks
├── ground.test.ts   NEW
├── models.ts        NEW   three geometry/material builders: tanks (from gunOf), wrecks, crates, shells, props
├── models.test.ts   NEW
├── scene.ts         NEW   browser-only: renderer, lights, textures, scenery layers, syncing the battle each frame,
│                          effects, shadows, detail level, labels layer, garage preview (e2e tested)
├── overview.ts      NEW   browser-only: the overview map canvas and its pointer input (e2e tested)
├── draw.ts          DELETE (2D drawing; the flat ground-layer code moves into overview.ts)
├── pixel.ts, pixel.test.ts, fonts/   DELETE (Arcade)
├── game.ts          CHANGE  use scene, camera and overview; keys `[` `]` `F`; remove Style row; data-camera/data-view
├── game.css         CHANGE  #labels, #overview, #overviewToggle; remove .tc.arcade rules and @font-face
├── settings.ts (+test)  CHANGE  drop style, add overview
├── sound.ts         CHANGE  remove arcade synth and setStyle
├── enums.ts         CHANGE  remove Style, add CameraMode
└── constants.ts     CHANGE  camera, depth, chunk and detail constants
src/no-stray-literals.test.ts  CHANGE  Style out, CameraMode in
package.json         CHANGE  coverage include list: add camera, ground, models
e2e/tank.spec.ts     CHANGE  Arcade-gone check; camera, overview, 3D-look and preview tests in
specs/007-tank-artillery/spec.md  CHANGE  note that FR-026 is replaced by 008
```

**Structure Decision**: Keep the game's single folder. Logic that decides things (camera framing, ground
mesh, model building) lives in pure modules with unit tests; code that needs WebGL, the DOM or pointer
events (`scene.ts`, `overview.ts`, `game.ts`) is covered by e2e tests, per constitution VII.

## Delivery order

1. Remove Arcade (008 US4): small, independent, ships the Settings change.
2. 3D scene with today's whole-field view: ground, tanks, wrecks, effects, scenery, labels, preview (009 US1–3).
3. Camera (008 US1–2) on top of the 3D scene.
4. Overview map with hide button and keys (008 US3).

Step 1 (Arcade removed) leaves the game playable and releasable. Between the groundwork (empty 3D scene) and the end of US3 (ground and tanks in 3D) the battle has nothing to look at, so nothing is deployed in between. The first release point is after US3; every step keeps its tests green.

## Complexity Tracking

No constitution violations to justify.
