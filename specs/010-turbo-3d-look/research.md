# Research: Turbo Tumble's 3D look and speed (spec 010)

Turbo Tumble today (`src/games/turbo-tumble/game.ts`, one 850-line module): three.js 0.128, `MeshLambertMaterial`
flat colours, box karts (`buildKart`), ribbon-strip road and kerbs (`strip`/`ribbon`), random props per track
(`buildTrack`), no shadows, antialiasing always on, split screen as two viewports of one renderer
(`renderer.setAnimationLoop`, `setViewport`/`setScissor`), pixel ratio capped at 1.5 on touch. Pure modules with unit
tests: `net.ts`, `settings.ts`, `standings.ts`. Races are not seeded (`Math.random` for bots and item boxes).

## R1. Where the new look lives

- **Decision**: Two new modules in `src/games/turbo-tumble/`:
  - `look.ts` (pure, no DOM, unit tested): the kart model builder per style (body, seated driver with arms, steering
    wheel, wheels with hubs, type marks), `setSteer`, `spinWheels`, the per-track look table (road/ground kinds, kerb
    and barrier colours, sky, sun or night lights, scenery layers, start-line props, moving effect, puff kind), and
    `steerFrom` (a remote kart's steering read from its heading change).
  - `view.ts` (browser-only, end-to-end tested): procedural textures, the sun and shadows, layered scenery, start-line
    props, the moving effect and drift-puff particles, the low-detail switch.
  `game.ts` keeps the race (physics, items, bots, online, HUD) and calls these; its race code is not changed.
- **Rationale**: Mirrors Tank Clash (models.ts pure + scene.ts browser-only) and keeps the race logic untouched (FR-010).
- **Alternatives**: Editing `buildKart`/`buildTrack` in place (the file would grow past 1,200 lines, mixing race and look).

## R2. Shared rendering helpers

- **Decision**: Move Tank Clash's `softwareGpu()` (antialiasing decision), its procedural-texture helper and its
  frame-rate probe into `src/shared/render.ts` (browser-only) and `src/shared/detail.ts` (the probe, pure and unit
  tested), used by both games (constitution II: shared code serves two games).
- **Rationale**: One copy of each; Turbo Tumble gets the same antialiasing rule (FR-008) and low-detail behaviour
  (FR-009) as Tank Clash.
- **Alternatives**: Copying them into Turbo Tumble (two copies drifting apart; constitution VIII).

## R3. Karts

- **Decision**: Rounded, toy-like karts built from extruded profiles with bevels, spheres and cylinders, at the same
  overall size as today's boxes (collision sizes in `game.ts` untouched):
  - Classic: low body, front bumper, rear spoiler. Buggy: higher body, roll bar, chunky tyres. Rocket: long nose cone,
    tail fin, two exhausts.
  - Driver: torso in the kart colour, head in the skin colour, helmet in the helmet colour, two arms holding a small
    steering wheel. `setSteer(model, steer)` turns the wheel and leans the head; `spinWheels(model, distance)` turns the
    wheels. Today's body lean, drift tilt and spin-out (`k.m`) are kept on the new body.
  - Remote karts (online): steering from `steerFrom(previous heading, heading, dt)`, since State messages carry no
    steering (FR-010).
- **Rationale**: Distinct silhouettes (SC-003) and the driver movement asked for (FR-001a) with no change to the race.

## R4. Track surfaces

- **Decision**: Procedural `CanvasTexture`s (drawn once per track): tarmac with fine grain (Meadow, Snow), packed sand
  with ripples (Desert), a dark glowing grid (Neon road and ground), grass with blades (Meadow), sand (Desert), snow
  (Snow). The road and kerb ribbons keep their shape and get UVs along the track; kerbs become slightly raised and
  rounded; barriers become rounded rails with posts. The textures are light detail that the track's own colours tint.
  Neon's glowing lines use unlit materials.
- **Revised in implementation**: all materials stay `MeshLambertMaterial` (lit per vertex), not `MeshStandardMaterial`.
  Measured in the test browser's software renderer: per-pixel shading over the road and ground cost most of the frame
  rate, and each extra kind of material is a shader program compiled when the game opens (11 programs took the garage
  from 0.9 s to 2.5 s). Surfaces share one program (textured and tinted per vertex), karts and props another; the game
  compiles 8 programs in all. Anisotropic filtering only on graphics chips (it is costly in software).
- **Rationale**: FR-003, FR-004 with no image files (FR-011); SC-001, SC-005.

## R5. Light and shadows

- **Decision**: One directional sun per track, from the right of the start and fairly low, so at the grid each kart's
  shadow falls to its left on open road. Shadows are soft dark shapes on the ground, offset away from the sun: one under
  each kart's body and one where its driver's head casts, one per tree (stretched away from the sun), a soft band at each
  barrier's foot, and under the start-line props. Neon: a hemisphere light, a dim coloured sun and a few coloured point
  lights near the start; only karts cast shadows (FR-005a).
- **Revised in implementation**: the plan was a soft (PCF soft) shadow map following each view's kart. Measured in the
  test browser's software renderer it halved the frame rate, and turning it on recompiles every lit shader (0.8 s), which
  broke SC-005. The soft shapes look soft and cost almost nothing.
- **Rationale**: Soft shadows under karts wherever the camera is (FR-005), at near-zero cost (SC-001, SC-005).

## R6. Scenery, props and effects

- **Decision**:
  - Layered scenery: 2–3 rings of hills, dunes, mountains or neon towers at growing distances around the track, paler
    with fog (`scene.fog`); sky as a gradient background; clouds (stars on Neon).
  - Start-line props: a start arch with the existing chequered banner, tyre stacks and a small grandstand beside the
    start/finish line, off the road (FR-004a).
  - Moving effect per track (FR-006a): falling snow (Snow), drifting dust (Desert), a few birds (Meadow), pulsing
    lights (Neon): one small `Points` cloud or a few meshes around the camera, drawn before karts and items with depth
    test so it never covers them.
  - Drift puffs (FR-002a): a small pooled particle set per kart, emitted while drifting (local karts: `k.drift`;
    remote karts: spark visible and `steerFrom` beyond a threshold), coloured by track kind. Today's spark colours
    (`game.ts`) stay as they are.
- **Revised in implementation**: the sky is a dome coloured per vertex (a full-screen gradient texture halved the
  software renderer's frame rate). The near scenery (trees, cacti, pines, neon pillars) and the barrier posts, fans and
  towers are each baked into one merged mesh per material, not instanced (instancing cost split screen half its frame
  rate in software). Each kart's parts that share a colour are joined, and each axle's two wheels turn as one: a kart is
  about a dozen meshes instead of 22.
- **Rationale**: Each is cheap and can be switched off in low detail.

## R7. Low detail (FR-009)

- **Decision**: The shared probe measures frames that drew; under 55 fps after 2 s, switch to low detail: no shadows,
  pixel ratio 0.75, hide start-line props, the moving effect and drift puffs, keep only the nearest scenery ring, no
  clouds and no sky dome (the horizon's colour fills the sky). Applies to both halves in split screen.
- **Measured** (test browser, software renderer, Chromium on this machine): full detail ~37 fps for one player and
  ~35 for split screen, so the test browser always drops to low detail; low detail 51–60 for one player and 50–60 for
  split screen. Today's look measured 53 and 40 on the same machine.
- **Rationale**: Same rule as Tank Clash; split screen draws twice, so it is the case most likely to trip it.

## R8. Tests

- **Unit (Node)**: `look.ts` (kart parts per style, colours, `setSteer`, `spinWheels`, `steerFrom`, the look table has
  every track) and `src/shared/detail.ts` (the frame-rate probe); 100% function coverage kept (add both to the
  coverage list). `src/shared/render.ts` is browser-only and covered end-to-end.
- **End-to-end**: a new Turbo Tumble frame-rate test (eight karts; split screen on desktop) — the spec's "existing
  frame-rate test" does not exist yet; garage previews differ per kart style and colours; road and ground pixels are
  textured (not one flat colour); a shadow under the player's kart; Neon's sky is dark; low detail reported through a
  test aid (`data-detail`, as Tank Clash); leaving and returning several times keeps the renderer's geometry count
  flat (a test aid `data-geometries`). The full list of test aids is in contracts/ui.md. The existing Turbo Tumble tests (online, lobby, standings, load) must pass
  unchanged.
- **Open time (SC-005)**: baseline measured before the new look (T000), local Chromium, median of 5: the garage is
  drawn 899 ms after navigating, and the countdown shows 116 ms after pressing Start. The test allows each 1 s more.
- **Same race (SC-002)**: races are not seeded, so "the same seeded race" can't be compared. Instead: the race code in
  `game.ts` (physics, items, bots, online) is not edited, which the review checks, and the existing race tests pass
  unchanged. The spec's SC-002 is reworded to say this.
