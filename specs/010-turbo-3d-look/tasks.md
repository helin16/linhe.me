---

description: "Tasks: Turbo Tumble's 3D look and speed"
---

# Tasks: Turbo Tumble's 3D look and speed

**Input**: Design documents from `specs/010-turbo-3d-look/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: Required by the constitution (VII): unit tests for exported pure functions (100% function coverage), end-to-end
tests for acceptance scenarios; browser-only code is covered end-to-end.

**Ground rule for every task (FR-010, SC-002)**: do not edit the race code in `src/games/turbo-tumble/game.ts`
(physics `step`/drift/items/bots/laps, collisions, online `net` messages, controls, HUD, minimap, standings). Only the
places that build or draw meshes (`buildKart`, `buildTrack`, `strip`, the renderer set-up and the animation loop's
drawing) may change, and only to call `look.ts`/`view.ts`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

- [X] T000 Record today's baseline for SC-005 before any code change: in an e2e run on Chromium, time from pressing Start to the countdown showing (median of 5) and write the number in specs/010-turbo-3d-look/research.md R8
- [X] T001 Add `--test-coverage-include='src/games/turbo-tumble/look.ts'` and `--test-coverage-include='src/shared/detail.ts'` to the `test` script in package.json
- [X] T002 [P] Add the new fixed sets to src/games/turbo-tumble/enums.ts: `RoadKind` (tarmac, sand, neon), `GroundKind` (grass, sand, snow, grid), `Effect` (snow, dust, birds, pulse), `PuffKind` (dust, sand, snow, glint), `LightKind` (sun, night), `LayerKind` (hills, dunes, mountains, towers); register each in `enums` and `home` in src/no-stray-literals.test.ts

---

## Phase 2: Foundational (shared rendering helpers, used by both 3D games)

**Purpose**: One copy of the GPU check, the procedural-texture helper and the frame-rate probe (research R2, constitution II).

- [X] T003 [P] Write src/shared/detail.test.ts: a new probe reports `probing`; after `DETAIL_PROBE_S` of drawn frames at ≥ the threshold it reports `full`, below it `low`; frames that didn't draw, or follow one that didn't, are not counted; `restart()` re-probes only while `full`
- [X] T004 Create src/shared/detail.ts (pure, no DOM): `export const Detail = { Probing: 'probing', Full: 'full', Low: 'low' } as const; export type Detail = typeof Detail[keyof typeof Detail];` (constitution VIII: no `enum` keyword), `LOW_DETAIL_FPS = 55` and `DETAIL_PROBE_S` moved from src/games/tank-clash/constants.ts (defined once, used by both games), and `detailProbe(seconds, minFps)` returning `{ frame(dt, drew), restart(), get detail }`, the logic moved from `render`/`probe` in src/games/tank-clash/scene.ts; register `Detail` (home `shared/detail.ts`) in src/no-stray-literals.test.ts
- [X] T005 [P] Create src/shared/render.ts (browser-only): move `softwareGpu()` and `texture(draw)` (seeded, repeat-wrapped `CanvasTexture`, size passed in) from src/games/tank-clash/scene.ts, plus `LOW_DETAIL_RATIO = 0.75`
- [X] T006 Switch src/games/tank-clash/scene.ts to `src/shared/render.ts` and `src/shared/detail.ts`, importing `LOW_DETAIL_FPS` and `DETAIL_PROBE_S` from there (no behaviour change: same `detail` strings, same skipping of ground-rebuild frames); run `yarn test` and `npx playwright test e2e/tank.spec.ts --project=chromium` to confirm
- [X] T007 Turbo Tumble renderer in src/games/turbo-tumble/game.ts: `antialias: !softwareGpu()` (FR-008); enable `renderer.shadowMap` (`PCFSoftShadowMap`); write test aids only under `navigator.webdriver`, only when they change, on the game root as Tank Clash does: `data-detail`, `data-geometries` (`renderer.info.memory.geometries`), `data-antialias` (`on`/`off`) (contracts/ui.md); create src/games/turbo-tumble/view.ts with `lowDetail()` (empty for now: later tasks register what it hides) and a webdriver-only `window.__ttLowDetail()` that switches to low detail at once; add to e2e/turbo.spec.ts: `data-antialias` is `off` in the test browsers' software renderers (US4-1, FR-008; the `on` case is a real-device check in T032)

**Checkpoint**: Tank Clash unchanged and green; Turbo Tumble draws as before with the new antialiasing rule.

---

## Phase 3: User Story 1 - Karts look like solid toys with drivers (P1) 🎯 MVP

**Goal**: Three rounded kart types with a seated driver who steers and leans; wheels turn (FR-001, FR-001a, FR-002, FR-007).

**Independent test**: In the garage, Classic, Buggy and Rocket look different and follow colour, helmet and skin; in a race the drivers steer and the wheels turn.

### Tests

- [X] T008 [P] [US1] Write src/games/turbo-tumble/look.test.ts for karts: `kartModel(style, {color, helmet, skin})` returns `body`, `marks`, `wheels` (4), `driver` (torso in the kart colour, head in the skin colour, helmet in the helmet colour, two arms), `steering`, `spark`; each style has its marks (Classic bumper + spoiler; Buggy roll bar + wider tyres; Rocket nose cone + tail fin + 2 exhausts); the bounding box stays within today's `buildKart` size; `setSteer(model, s)` turns the steering wheel and leans the head, clamped to −1…1; `spinWheels(model, d)` turns the wheels by `d / radius`; `steerFrom(prev, heading, dt)` gives 0 when straight, sign follows the turn, clamped to −1…1, handles the ±π wrap
- [X] T009 [P] [US1] Create e2e/turbo.spec.ts with US1: garage screenshots for Classic, Buggy and Rocket differ from each other; changing colour, helmet or skin changes the screenshot (US1-1, US1-2); in a race, `data-wheels` (the first human's wheel turn) keeps growing while driving (US1-3); holding left then right makes `data-steer` (the first human's steering wheel, −1…1) go negative then positive (US1-4); in an online race the other screen's kart shows the same sign in its `data-steer-remote` (US1-4, FR-001a) (contracts/ui.md)

### Implementation

- [X] T010 [US1] Create src/games/turbo-tumble/look.ts: `kartModel`, `setSteer`, `spinWheels`, `steerFrom` per data-model.md, using rounded geometry (extruded bevelled profiles, spheres, cylinders) and `MeshStandardMaterial`; karts cast shadows
- [X] T011 [US1] In `buildKart` (src/games/turbo-tumble/game.ts), build `k.m` from `kartModel` and keep `k.spark` as the model's spark (today's spark colours and visibility untouched); keep the body lean, drift tilt and spin-out on `k.m`
- [X] T012 [US1] In the animation loop's drawing in src/games/turbo-tumble/game.ts: `setSteer` from the local steer input (local karts) or `steerFrom` of the heading change (remote karts, FR-010), `spinWheels` from distance travelled; the garage preview uses the new model with today's slow orbit kept (FR-007); write the test aids `data-steer`, `data-steer-remote` (the first remote kart's) and `data-wheels`

**Checkpoint**: US1 tests pass; the existing Turbo Tumble e2e tests (lobby, online, standings, load) pass unchanged.

---

## Phase 4: User Story 2 - Tracks look detailed (P1)

**Goal**: Textured road and ground, rounded kerbs and barriers, a sun with soft shadows, Neon at night, start-line props (FR-003, FR-004, FR-004a, FR-005, FR-005a, FR-011).

**Independent test**: Each track has textured road and ground, a soft shadow under every kart, rounded kerbs and barriers, the start arch, tyre stacks and grandstand; Neon has a dark sky and glowing lines.

### Tests

- [X] T013 [P] [US2] Add to src/games/turbo-tumble/look.test.ts: `TRACK_LOOKS` has an entry for every `Track`, with `road`/`ground`/`light`/`effect`/`puff` from their enums, 2–3 `layers` at growing distances, Neon `light` = night with `stars`, the others sun
- [X] T014 [P] [US2] Add to e2e/turbo.spec.ts: road and ground pixels vary (not one flat colour) on each track (US2-1); the pixel at `data-shadow` is darker than road to its side on every track, Neon included with a gentler threshold (US2-2, FR-005a); `data-kerbs` reports `rounded` (kerbs and barriers built from the rounded profiles, US2-3); `data-props` is `3` (arch, tyre stacks, grandstand) in full detail and `0` after forcing low detail (US2-4); Neon's sky at the top of the screen is dark (contracts/ui.md)

### Implementation

- [X] T015 [US2] Add `TRACK_LOOKS` to src/games/turbo-tumble/look.ts per data-model.md (road, ground, kerb, barrier, sky, light, layers, effect, puff)
- [X] T016 [US2] Add to src/games/turbo-tumble/view.ts `trackTextures(look)`: tarmac grain, sand ripples, neon grid, grass blades, snow, via `texture()` from src/shared/render.ts (FR-003, FR-011)
- [X] T017 [US2] In `strip`/`buildTrack` (src/games/turbo-tumble/game.ts): give the road and ground ribbons UVs along the track and the textures from T016 with `MeshStandardMaterial`; kerbs slightly raised and rounded, barriers as rounded rails with posts, in the look's colours (FR-004); the road and ground receive shadows; Neon's glowing lines stay unlit; write `data-kerbs`
- [X] T018 [US2] In src/games/turbo-tumble/view.ts add `lights(scene, look)`: a sun (directional, 1024 soft shadow map) whose shadow camera follows a target; `follow(kart)` called before each split-screen half renders; Neon: hemisphere plus coloured point lights at the start, a kart-only shadow (FR-005, FR-005a); wire it into the animation loop in src/games/turbo-tumble/game.ts and set `data-shadow` (one point per view, contracts/ui.md)
- [X] T019 [US2] In src/games/turbo-tumble/view.ts add `startProps(scene, track)`: start arch with today's chequered banner, tyre stacks, a small grandstand, beside the start/finish line and off the road (FR-004a); call it from `buildTrack`; register the props with `lowDetail()`; write `data-props` (visible props)

**Checkpoint**: US1 and US2 tests pass; existing Turbo Tumble tests unchanged.

---

## Phase 5: User Story 4 - Smooth edges and steady speed on every device (P1)

**Goal**: Low detail by itself on slow devices, split screen included; a new frame-rate test (FR-008, FR-009, SC-001).

**Independent test**: The new frame-rate test passes for a race and split screen; `data-detail` reaches `full` or `low`; in low detail shadows, props, moving effect and drift puffs are off.

### Tests

- [X] T020 [P] [US4] Add to e2e/turbo.spec.ts: a race with every effect on stays at ≥ 50 fps in Chromium, split screen too, and an eight-player online room's race (one page per player, measured on the host) (SC-001); `data-detail` goes from `probing` to `full` or `low` (US4-2, FR-009); after `window.__ttLowDetail()` in split screen, `data-detail` is `low`, `data-props` is `0`, and in each half the pixel at `data-shadow` is no longer darker than the road beside it (US4-3)

### Implementation

- [X] T021 [US4] In src/games/turbo-tumble/game.ts use `detailProbe(DETAIL_PROBE_S, LOW_DETAIL_FPS)` from src/shared/detail.ts: restart at each race start, feed it each drawn frame (both halves count as one frame); on `low`: `renderer.setPixelRatio(LOW_DETAIL_RATIO)`, shadows off (materials `needsUpdate`), and call `view.lowDetail()`
- [X] T022 [US4] Make `window.__ttLowDetail()` and the probe share one path in src/games/turbo-tumble/game.ts (pixel ratio, shadows off, `view.lowDetail()`), so what the test forces is what slow devices get; `lowDetail()` in src/games/turbo-tumble/view.ts hides everything registered with it (start-line props now; the moving effect, drift puffs and farthest ring once US3 adds them: research R7)

**Checkpoint**: frame-rate test passes on Chromium; low detail applies to both halves.

---

## Phase 6: User Story 3 - The scenery has depth (P2)

**Goal**: Layered scenery, sky, clouds or stars, one moving effect per track, drift puffs (FR-002a, FR-006, FR-006a).

**Independent test**: Layered scenery fades with distance; clouds (stars on Neon); the track's moving effect sits behind the karts; drifting makes puffs of the track's kind.

### Tests

- [X] T023 [P] [US3] Add to e2e/turbo.spec.ts: drifting on each track makes `data-puffs` (live puffs) rise above 0, driving straight leaves it at 0, and after forcing low detail it stays 0 (US1-5, FR-002a); while drifting, `data-spark` (the first human's spark colour) changes as the charge grows, as today (US1-5); `data-effect` names the track's effect (`snow`, `dust`, `birds`, `pulse`) in full detail and is empty in low detail (US3-2); `data-layers` lists each ring's distance and fog-paled colour lightness, growing with distance, and turning the view moves the nearest ring's screen point more than the farthest's (US3-1); item boxes, Goo and Zap stay visible with the effect on (Edge Cases)

### Implementation

- [X] T024 [US3] In src/games/turbo-tumble/view.ts add `scenery(scene, look)`: 2–3 rings of hills, dunes, mountains or towers per `layers`, `scene.fog` so far rings are paler, a gradient sky background, clouds or stars (FR-006); today's trees, cacti, pines and neon pillars from `buildTrack` stay as the near layer and cast shadows (FR-005); the new rings are the farther layers; write `data-layers` and register the farthest ring with `lowDetail()`
- [X] T025 [US3] In src/games/turbo-tumble/view.ts add `movingEffect(scene, look)` with `update(dt, camera)`: snow, dust, birds or pulsing lights around the camera, drawn before karts and items so it never covers them (FR-006a); register it with `lowDetail()`; write `data-effect`
- [X] T026 [US3] In src/games/turbo-tumble/view.ts add pooled `puffs(look)` with `emit(kart)`/`update(dt)`: emitted while `k.drift` (local) or `k.spark.visible` and |`steerFrom`| above a threshold (remote), coloured by `look.puff` (FR-002a); register them with `lowDetail()`; write `data-puffs` and `data-spark` (read from `k.spark`'s colour, not changing it); wire T025 and T026 into the animation loop's drawing in src/games/turbo-tumble/game.ts

**Checkpoint**: every story works on its own; all Turbo Tumble tests pass.

---

## Phase 7: Polish & cross-cutting

- [X] T027 Free everything on unmount (FR-012): `dispose` all geometries, materials and textures from look.ts/view.ts in the `mount` clean-up of src/games/turbo-tumble/game.ts; add to e2e/turbo.spec.ts: `data-geometries` after garage → race → garage ×3 is no higher than after the first round
- [X] T028 [P] Add to e2e/turbo.spec.ts: very light and very dark kart/helmet/skin colours stay visible against the body (Edge Cases); resize to phone portrait and landscape keeps the game filling the screen
- [X] T029 Confirm SC-002: `git diff` of src/games/turbo-tumble/game.ts touches only mesh building and drawing; the existing Turbo Tumble e2e tests are unchanged and pass
- [X] T030 Confirm SC-005: measure as in T000 and check it is within 1 s of the recorded baseline
- [X] T031 Run `yarn test`, `yarn build` and `yarn e2e:local`; run `/code-review` on the diff and fix or note each finding (CLAUDE.md)
- [ ] T032 Manual checks recorded in quickstart.md scenarios 7–8: real iPad and phone eight-kart race (SC-006); smooth edges on a device with a graphics chip (FR-008); kart recognition and before/after looks with 5 people (SC-003, SC-004)

---

## Dependencies & execution order

- T000 first, before any code changes (it measures today's game).
- Setup (T001–T002) → Foundational (T003–T007) → stories.
- US1 (Phase 3) first: MVP. US2 needs only Foundational; it can run alongside US1 except where both edit game.ts (T011/T012 vs T017–T019: do them one after another).
- US4 (Phase 5) needs US2's lights (T018) and props (T019) to switch off; its `lowDetail()` grows as US3 adds effects.
- US3 (Phase 6) after US2 (needs `TRACK_LOOKS`); T024–T026 register what they add with `lowDetail()` (created in T007).
- Polish after all stories.

## Parallel examples

- Phase 2: T003 (detail.test.ts) and T005 (render.ts) together.
- US1: T008 (look.test.ts) and T009 (turbo.spec.ts) together, then T010.
- US2: T013 and T014 together; T016 alongside T015.

## Implementation strategy

1. Phases 1–2, then US1 → check the karts → stop and show (MVP).
2. US2 (tracks and light), then US4 (speed) so every later effect is measured by the frame-rate test.
3. US3 (scenery, effects, puffs), then Polish.
4. The game stays playable and all existing tests pass after every phase.

## Notes from implementation

- T007/T018: no shadow map. Shadows are soft shapes on the ground, offset away from the sun (karts' bodies and drivers'
  heads, trees, barrier feet, start-line props): a shadow map halved the software renderer's frame rate and its shader
  compile broke SC-005 (research R5). `data-shadow` is the driver's head shadow.
- T010/T016/T017/T024: Lambert materials throughout, merged meshes instead of instancing, a vertex-coloured sky dome,
  kart parts joined per colour (research R4, R6). The game compiles 8 shader programs.
- T020/T022: the test browsers draw in software and always drop to low detail; the frame-rate tests allow it, as Tank
  Clash's does, and SC-001 is reworded to say so. Low detail also hides clouds, the sky dome and all but the nearest
  scenery ring.
- T009: kart types and colours are compared on the start grid during the countdown (the garage's orbit moves the camera
  between shots); the driver now shows a chin and neck in the skin colour below an open helmet.
- T027: the leak check compares the renderer's geometries with those the scene still uses (`data-used`).
- T029: race code untouched: game.ts changes are in the scene set-up, `strip`/`buildTrack` (now `band`), `buildKart`, the
  scenery props' definitions (`prop`/`shade`) and the animation loop's drawing; STYLES lost only its look-only `body`
  and `wheel` fields (now `SHAPES` in look.ts).
