---
description: "Tasks for Tank Clash in 3D with focus camera and overview map (features 008 + 009)"
---

# Tasks: Tank Clash in 3D, with focus camera and overview map

**Input**: `specs/009-tank-semi-3d/` (plan.md, research.md, data-model.md, contracts/ui.md, quickstart.md) and
`specs/008-tank-focus-camera/spec.md`

**Tests**: Required by the constitution (VII): unit tests for every exported function of the pure modules
(100% function coverage), end-to-end tests for every acceptance scenario on Chromium, Firefox and WebKit-iPad.

**Story labels** (one numbering across both specs, in build order):

| Label | Story | Spec | Priority |
|---|---|---|---|
| US1 | Arcade style is gone | 008 US4 | P3 (done first: small, and it removes the style parameter from all drawing) |
| US2 | The ground looks solid and detailed | 009 US1 | P1 |
| US3 | Tanks and wrecks look like solid machines | 009 US2 | P1 |
| US4 | The scenery and effects have depth | 009 US3 | P2 |
| US5 | The camera follows the tank in turn | 008 US1 | P1 |
| US6 | The camera pulls back to show the shot | 008 US2 | P1 |
| US7 | A see-through overview map I can drag | 008 US3 | P2 |

All paths are relative to the repo root; the game folder is `src/games/tank-clash/` (written `tc/` below).

After every phase: `yarn test`, `yarn build`, `yarn e2e:local`, then `/code-review` on the diff (CLAUDE.md).

---

## Phase 1: Setup

- [X] T001 First check that three 0.128 loads under `node --test` (a throwaway test that builds a `BoxGeometry` and a `Group`); if it doesn't, move the model builders into tc/scene.ts and cover them with e2e only (update plan.md and T020/T026 accordingly). Then add `camera`, `ground` and `models` to the Tank Clash `--test-coverage-include` glob (`src/games/tank-clash/{seed,settings,tanks,terrain,sim,bots,messages,camera,ground,models}.ts`) in package.json
- [X] T002 [P] Add named constants to tc/constants.ts: `GROUND_DEPTH = 70`, `CAMERA_FOV = 30`, `CAMERA_TILT_DEG = 6`, `CHUNK_CELLS = 32`, `CLOSE_HALF_W = WORLD_W / 4`, `FAR_LAYER_Z = -600`, `NEAR_LAYER_Z = -250`, `FOLLOW_BAND = 1 / 3` (middle third), `SHOT_PAD = 80`, `GLIDE_S = 0.35` (smoothing time constant; settles within 1 s), `MAX_STEP = 0.05` (most a view may move or resize per frame, as a share of its width; 008 FR-002), `SETTLE_HOLD_S = 0.6`, `LOOK_STEP = 120` (units per `[`/`]` press), `LOW_DETAIL_FPS = 45`, `DETAIL_PROBE_S = 2`, `OVERVIEW_OPACITY = 0.6`
- [X] T003 Before any 2D drawing is replaced (T006), measure how long a battle takes to open today: from pressing Start until `#panel` shows, 5 runs each in Chromium, Firefox and WebKit-iPad on the production build; record the medians in specs/009-tank-semi-3d/research.md as the reference for T047; also save screenshots of a seeded battle (`?seed=1`, first turn) on each of the four maps to specs/009-tank-semi-3d/look/before-<map>.png for the look check (SC-001)

---

## Phase 2: Foundational (blocks US2–US7)

- [X] T004 Add `CameraMode = { Follow: 'follow', Shot: 'shot', Held: 'held', Whole: 'whole' } as const` (`Whole` = battle over; not the overview map) with its union type to tc/enums.ts, and register it in src/no-stray-literals.test.ts
- [X] T005 Create tc/scene.ts (browser-only): `createScene(canvas, labelsCanvas)` with a `WebGLRenderer` (pixel ratio capped 2, 1.5 on touch, as Turbo Tumble), a `PerspectiveCamera` (FOV `CAMERA_FOV`), hemisphere + directional light with a soft (PCF soft) 1024 shadow map, axis mapping from research R2 (x = sim x, y = `WORLD_H − sim y`, z depth), `setView({cx, cy, halfW})` that places the camera at the distance that shows `2·halfW` across for the canvas aspect, tilted `CAMERA_TILT_DEG` down, `resize()`, `render()`, `dispose()`; and `project(x, y)` to screen pixels for the labels layer
- [X] T006 In tc/game.ts replace the 2D `ctx`/`drawBattle` path with `createScene`: add `<canvas id="labels" aria-hidden="true">` over `#view` in the markup and its CSS in tc/game.css; render the whole field (centre of the field, `halfW = max(WORLD_W/2, WORLD_H/2 · aspect)`) until US5; set `data-ready` after the first `render()` and, each frame, `data-tanks`, `data-shells`, `data-blast` and `data-materials` on `.tc` (contracts/ui.md; screen positions from `scene.project`; write each attribute only when its value changed), so the US2–US4 tests can find things on screen; dispose the scene on unmount
- [X] T007 Move today's label, health bar, active-tank arrow and rising repair-heart drawing, and `cheer` (which starts a heart), from tc/draw.ts into tc/scene.ts: `drawLabels(ctx, b, project, time)` that draws on `#labels` using `project`

**Checkpoint**: the game runs with an empty 3D scene plus labels; nothing else changed.

---

## Phase 3: US1 — Arcade style is gone (008 US4)

**Goal**: no Style row; normal look and recorded sounds only.
**Independent test**: open the garage: no Style row; with an old saved `style: "arcade"` the game loads in the normal look and keeps the rest of the settings.

- [X] T008 [P] [US1] Unit test in tc/settings.test.ts: settings saved with `style: "arcade"` load with every other field kept and no `style` field; default `overview` is `true`
- [X] T009 [US1] In tc/settings.ts drop `style` from `Settings` and its validation; add `overview: boolean` (default `true`, validated as a boolean)
- [X] T010 [US1] Delete tc/pixel.ts, tc/pixel.test.ts and tc/fonts/; move `BUILD_GUN` and `gunOf` (with their unit test) into tc/models.ts and tc/models.test.ts; in tc/draw.ts (still used for the garage preview until T024) remove the Arcade paths (`pixelTank`, `arcadeScenery`, arcade ground cells and props, the `style` parameters) and import `BUILD_GUN` from tc/models.ts, so `yarn build` passes at the end of US1
- [X] T011 [P] [US1] In tc/sound.ts remove the arcade synth set, the `style` parameter of `createSound` and `setStyle`; keep the clips and the normal fallback synth
- [X] T012 [US1] Remove `Style` from tc/enums.ts and src/no-stray-literals.test.ts; remove the Style row (`#styleRow`, `#cStyle`), its handler and the `root.classList.toggle(Style.Arcade…)` from tc/game.ts; remove `.tc.arcade` rules and the `@font-face` from tc/game.css
- [X] T013 [US1] E2E in e2e/tank.spec.ts: the garage has no Style row; with `style: "arcade"` pre-saved in local storage the battle starts and the name/colour settings are kept
- [X] T014 [US1] Add a note under 007's FR-026 in specs/007-tank-artillery/spec.md: "Replaced by 008 FR-012 (Arcade removed)"

---

## Phase 4: US2 — The ground looks solid and detailed (009 US1)

**Goal**: solid, lit ground with depth; craters cut into it.
**Independent test**: each map shows lit hill tops and soil-layer front faces, plank bridges, distinct snow/ice/water; shots leave craters exactly where the rules removed ground.

- [X] T015 [P] [US2] Unit tests in tc/ground.test.ts: `chunkMesh(terrain, index)` returns per-material typed arrays (`positions`, `normals`, `uvs`, `indices`); a flat slab gives a front face, a top strip and no gaps; an empty chunk returns no triangles; front-face outline matches solid cells within half a cell (marching squares); `dirtyChunks(x, y, r)` returns exactly the chunks a `carve` touches, clamped to `0 … ceil(GRID_W / CHUNK_CELLS) − 1`; water gets its own material group
- [X] T016 [US2] Implement tc/ground.ts (pure, no DOM): marching squares per material over `Terrain.cells` per chunk of `CHUNK_CELLS` columns, extruding outline edges from `−GROUND_DEPTH/2` to `+GROUND_DEPTH/2`; walls that face removed cells tagged as "inside" for crater colouring; UVs from world x/y (front) and x/z (top)
- [X] T017 [US2] In tc/scene.ts add procedural `CanvasTexture`s per map palette (today's `SCENES` colours in tc/draw.ts): soil with layers and rocks, grass top, wood grain with nail heads, snow, glossy ice, transparent water with a scrolling ripple normal map; clean and simple per FR-015
- [X] T018 [US2] In tc/scene.ts build ground meshes from `chunkMesh` (one `Mesh` per chunk and material, shadows on); on `groundChanged` rebuild only `dirtyChunks` (track the last carve in tc/game.ts where blasts are applied); splinter particles when wood breaks
- [X] T019 [US2] E2E in e2e/tank.spec.ts on each of the four maps with `?seed=1`: the battle renders (a page screenshot has non-sky pixels in the ground area); after a shot the screenshot pixels around `data-blast`'s `sx,sy` change (a crater) while `seed` sim results (hearts in `#panel`) match the 2D build's pinned values; using `data-materials`, the screenshot colour at each material's `sx,sy` matches its look: snow bright (lightness > 85%), ice pale blue, water blue, wood brown, earth/grass green or brown (009 FR-003–FR-005)

---

## Phase 5: US3 — Tanks and wrecks look like solid machines (009 US2)

**Goal**: toy-like solid tanks in the player's colour, types distinct, builds' cannons kept; scorched steel wrecks; bonuses visible.
**Independent test**: garage preview of all 4 types × 3 builds; a destroyed tank leaves a dark wreck.

- [X] T020 [P] [US3] Unit tests in tc/models.test.ts: `tankModel(type, variant, colour)` returns a `Group` with named parts `hull`, `turret`, `cannon` (with `barrels.length` per `gunOf`), `wheels`; the four types differ in hull size; `setWreck(model)` swaps every body material to the wreck material; `setGear(model, gear)` shows/hides the gold wheels, the gold outline, the power ring and the missile; `setAim(model, angle, tilt, dir)` sets the cannon pivot rotation keeping the angle to flat ground
- [X] T021 [US3] Implement tc/models.ts (three geometry and materials only, no DOM): bevelled `ExtrudeGeometry` hulls from today's per-type outlines, cylinder barrels from `gunOf`, track loop and road wheels, player colour on a `MeshStandardMaterial` (rough, gentle highlights), shared geometries per type and build; wreck material (scorched dark steel) with small vertex dents; gold materials; inverted-hull shield outline; torus power ring; missile model
- [X] T022 [US3] In tc/scene.ts sync tank models with the battle each frame: position, tilt (`tiltOf`), facing, aim, wreck state, gear (`gripUntil`, `shield`, `powerShot`, `missile`), falling and sinking; remove models for tanks that are gone
- [X] T023 [US3] Garage preview in tc/scene.ts: render the chosen tank in a small preview scene into the main renderer and copy it to `#preview` (2D canvas) with `drawImage`; call it from `refreshGarage` in tc/game.ts instead of `drawPreview`
- [X] T024 [US3] Delete tc/draw.ts: first move its flat ground-layer drawing and `groundChanged` into a new tc/overview.ts (US7 builds on it), the per-map `SCENES` colours into tc/constants.ts (T017 uses them) and `BONUS_ICON` into tc/game.ts; update imports, then delete
- [ ] T025 [US3] E2E in e2e/tank.spec.ts: the garage preview changes between every type and between builds A/B/C (data URLs differ); in a seeded battle that ends with a destroyed tank, the wreck is drawn (page-screenshot pixels at its `data-tanks` `sx,sy` are dark); in the air-drop test, after the repair kit is picked up the labels layer shows the rising heart above the tank (screenshot pixels above its `data-tanks` `sx,sy` turn red within 0.5 s) and the life panel still shows the bonus icon (009 FR-009)

---

## Phase 6: US4 — The scenery and effects have depth (009 US3)

**Goal**: layered scenery with parallax; solid shells, missiles, crates, parachutes; lit explosions and smoke; shell shadows.
**Independent test**: move the view: far layers move less; a shell shows a shadow on the ground below.

- [X] T026 [P] [US4] Unit tests in tc/models.test.ts for `crateModel()`, `parachuteModel()`, `shellModel(missile)`, and `propModels(map)` (each playable map returns its props: Green Hills ruin, sandbags, fence; Timber Gap logs, sandbags, fence; Lake Valley wooden ruin, sandbags, fence; Frost Ridge snowy sandbags, fence, ruin)
- [X] T027 [US4] Implement those builders in tc/models.ts
- [X] T028 [US4] In tc/scene.ts add the sky (gradient background per map) and scenery layers at increasing depth (far range at `FAR_LAYER_Z`, near hills with trees and props at `NEAR_LAYER_Z`), paler with distance, extending past the field's sides so the screen is always filled
- [X] T029 [US4] In tc/scene.ts add shells/missiles, crates with parachutes, explosions (expanding lit sphere + fading particles), smoke and dust; a soft dark disc on the ground surface under each shell (`surfaceAt`)
- [X] T030 [US4] Detail level in tc/scene.ts: measure frame rate for `DETAIL_PROBE_S` after a battle starts; under `LOW_DETAIL_FPS` turn off shadows, halve particles and set pixel ratio 1
- [ ] T031 [US4] E2E in e2e/tank.spec.ts: during a shot the shell's shadow is drawn (page-screenshot pixels on the ground below the shell's `data-shells` position are darker than beside it); the existing 10-tank frame-rate test still passes

---

## Phase 7: US5 — The camera follows the tank in turn (008 US1)

**Goal**: at each turn start the view glides to a close view on the tank in turn and keeps it in the middle third.
**Independent test**: `data-camera=follow` and `data-view` halfW ≈ `CLOSE_HALF_W` centred on the active tank within 1 s; driving keeps it in the middle third.

- [X] T032 [P] [US5] Unit tests in tc/camera.test.ts (every function takes `aspect` = screen width ÷ height; test 16:9, 19.5:9 landscape phone, 4:3 iPad and 9:19.5 portrait): `wholeHalfW(aspect)` = `max(WORLD_W/2, WORLD_H/2 · aspect)`; `followView(tankX, tankY, prev, aspect)` centres on a new tank at `CLOSE_HALF_W`, and while driving only moves when the tank leaves the middle `FOLLOW_BAND`; `clampView(v, aspect)` keeps `halfW` in `[CLOSE_HALF_W, wholeHalfW(aspect)]`, `cx` in `[halfW, WORLD_W − halfW]` (or `WORLD_W/2` when wider than the field) and `cy` in `[halfH, WORLD_H − halfH]` with `halfH = halfW / aspect` (or `WORLD_H/2` when taller); `glide(view, target, dt, reduced)` reaches within 1% of the target in under 1 s and jumps when `reduced`; at 60 frames a second no single `glide` step moves the centre or changes the width by more than 5% of the view's width (008 FR-002); `wholeView(aspect)` shows the entire field in both directions
- [X] T033 [US5] Implement tc/camera.ts (pure): `View` type, `wholeHalfW`, `followView`, `clampView`, `glide`, `wholeView`, all taking `aspect` per data-model.md
- [X] T034 [US5] In tc/game.ts keep a per-screen `Camera` (`mode`, `view`, `target`, `held`) per data-model.md; Follow on turn start and while the active tank drives, aims or falls; Whole (`wholeView`) when the battle ends; pass the canvas aspect to every camera function and re-clamp on resize; reduced motion from `matchMedia('(prefers-reduced-motion: reduce)')`; pass `camera.view` to `scene.setView` each frame; set `data-camera` and `data-view` (`cx,cy,halfW` rounded) on `.tc`
- [X] T035 [US5] E2E in e2e/tank.spec.ts: first turn → `data-camera=follow`, halfW = `CLOSE_HALF_W`, cx within 10 units of the active tank's x (from `data-tanks`, active id from `#panel .tank.active`) within 1 s; holding → for 1 s keeps the tank in the middle third; at the next turn the view moves to the next tank; same on a computer's turn; near a field edge cx stops at `halfW`; with reduced motion emulated the view jumps; when the battle ends `data-camera=whole` and `data-view` shows the whole field (008 FR-013); sampling `data-view` every frame during a turn change and a drive, the centre never moves and the width never changes by more than 5% of the view's width between frames (no jumps)

---

## Phase 8: US6 — The camera pulls back to show the shot (008 US2)

**Goal**: firing tank and shell always on screen; blast on screen until settled; then next tank.
**Independent test**: full-power shot: `data-camera=shot`, view widens as needed, never beyond the field, blast on screen.

- [X] T036 [P] [US6] Unit tests in tc/camera.test.ts: `shotView(tank, shell, prev, aspect)` is the smallest clamped view holding both in x **and** y with `SHOT_PAD`, never narrower than the current view during the flight and never wider than `wholeHalfW(aspect)`; a shell above or beside the field caps at the whole field; a sweep over every tank type, power 10…top power and the four test aspects, using `predict` from tc/bots.ts, finds the shell (x and y) and the firing tank inside the view in 100% of steps (008 SC-002)
- [X] T037 [US6] Implement `shotView` in tc/camera.ts (x and y, per data-model.md)
- [X] T038 [US6] In tc/game.ts switch to `CameraMode.Shot` on fire; frame tank + shell (or missile) each frame; after the blast hold the view on the blast until the battle settles plus `SETTLE_HOLD_S`, then Follow the next tank; a falling tank or wreck keeps being framed until it lands, sinks or leaves the field
- [X] T039 [US6] E2E in e2e/tank.spec.ts: fire at full power → `data-camera=shot`; while the shell flies `data-view` always contains the firing tank (`data-tanks`) and the shell (`data-shells`) in x and y; after the blast `data-view` contains `data-blast`; a short shot widens less than a long one; then `data-camera=follow` on the next tank

---

## Phase 9: US7 — A see-through overview map I can drag (008 US3)

**Goal**: see-through map of the whole field top-right; drag/tap to look around; keys; hide button remembered.
**Independent test**: drag the frame to the far side → `data-camera=held` and the view moves; drive → `follow`; `]` and `F` do the same; hiding survives a reload.

- [X] T040 [P] [US7] Unit tests in tc/camera.test.ts: `fieldXOf(px, mapWidth)` and `mapXOf(x, mapWidth)` convert both ways and clamp; `heldView(cx, view, aspect)` keeps the zoom and clamps; `lookStep(view, dir, aspect)` moves by `LOOK_STEP` and clamps
- [X] T041 [US7] Implement those in tc/camera.ts
- [X] T042 [US7] Extend tc/overview.ts (browser-only, started in T024): `createOverview(canvas, onLook)` draws the flat ground (the code moved there in T024), tanks and wrecks as coloured dots, crates and shells, and the view frame; pointer events (mouse, touch, pen) drag the frame or tap to centre and call `onLook(cx)`; redraws ground only on `groundChanged`
- [X] T043 [US7] In tc/game.ts and tc/game.css add `<canvas id="overview" role="img" aria-label="Overview map">` top-right at `OVERVIEW_OPACITY`, sized to stay clear of `#panel`, the timer and the controls on phones and desktops, and `<button id="overviewToggle" aria-pressed>` ("Hide map"/"Show map") saved as `Settings.overview`; `onLook` sets `CameraMode.Held`; keys `[`/`]` (`lookStep`) and `F` (back to Follow); driving, firing or a new turn ends Held
- [X] T044 [US7] E2E in e2e/tank.spec.ts (mouse in Chromium/Firefox, touch on WebKit-iPad): dragging the frame moves `data-view` cx and sets `held`; tapping centres there; holding → returns to `follow`; `]` then `F` with the keyboard; dragging during a shot works and follow returns next turn; the hide button hides the map and it stays hidden after reload; the map's box doesn't overlap `#panel`, the timer or the controls at phone (390×844 landscape and portrait) and desktop sizes; with 10 tanks in Chromium the frame rate with the map shown while the camera follows a drive is within 5% of the rate with the map hidden and the camera still (008 SC-005)

---

## Phase 10: Polish

- [X] T045 [P] Online check in e2e/tank.spec.ts: two screens in one room keep their own `data-view` when one drags its overview map, and both show the same hearts and winner
- [ ] T046 [P] Remove anything now unused (old SCENES/draw helpers, CSS, constants) from tc/; `yarn build` with no unused-code warnings
- [X] T047 [P] E2E in e2e/tank.spec.ts: time from pressing Start to the first rendered battle frame (a `data-ready` flag set after the first `render()`); it stays under a fixed limit per browser: 2.5 s in Chromium and Firefox, 3.5 s on WebKit-iPad (009 SC-005). Compare with the reference times recorded in T003
- [ ] T048 Run the full `yarn e2e` (Chromium, Firefox and WebKit-iPad) on the production build before deploying, since deploys skip CI (constitution VII)
- [ ] T049 Run quickstart.md scenarios 1–7 on the production build (scenario 8 is T050), including a 10-tank battle on a real iPad and a real phone with no visible stutter (009 SC-003); tune `CLOSE_HALF_W`, `GLIDE_S`, `SHOT_PAD` by playing and note final values in specs/009-tank-semi-3d/research.md
- [ ] T050 Run the manual look and recognition checks (009 SC-001, SC-002) as the spec describes, using the before screenshots from T003 and matching after screenshots, and record the answers in specs/009-tank-semi-3d/research.md
- [ ] T051 Mark 008 and 009 spec statuses as Implemented and update specs/008-tank-focus-camera/spec.md's note that it was planned in specs/009-tank-semi-3d/plan.md

---

## Dependencies

- Phase 1 → Phase 2 → everything else. T003 must run before T006 replaces the 2D drawing.
- US1 (Arcade removal) first: it removes the `style` parameter that US2–US4 would otherwise carry.
- US2 → US3 → US4 (the scene grows: ground, then tanks on it, then scenery and effects). T024 moves draw.ts's remaining pieces (flat ground, `groundChanged`, `SCENES`) before deleting it; T042 builds on that.
- US5 → US6 (the shot camera extends the follow camera) → US7 (held mode extends both).
- US5–US7 depend on Phase 2 only for the scene; their pure camera work (T032, T033, T036, T037, T040, T041) can start any time after T002 and T004.

## Parallel opportunities

- T002 with T001; T008 and T011 together (different files); T010 after T012 or with it, since both touch the Style code.
- Pure modules in parallel with scene work: T015–T016 (ground) ‖ T020–T021 (models) ‖ T032–T033, T036–T037, T040–T041 (camera).
- E2E tasks of a story can be written while its scene task is built.

## Implementation strategy

- **MVP**: Phases 1–2, US1, US2, US3 (the game fully playable in 3D at the whole-field view, Arcade gone). Ship and get feedback on the look.
- **Then** US4 (depth and effects), US5 + US6 (camera), US7 (overview map), Polish.
- Each phase ends with unit tests, build, local e2e and `/code-review` before committing.
