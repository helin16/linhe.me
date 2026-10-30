# Research: Tank Clash 3D look, focus camera and overview map (008 + 009)

## R1. Renderer

- **Decision**: Draw the battle with three.js (the version already locked in `package.json`, 0.128.0),
  one `WebGLRenderer` on the existing `#view` canvas, a `PerspectiveCamera` with a narrow field of view.
- **Rationale**: Already a dependency (Turbo Tumble), so no new library and the browser shares one
  vendor chunk between the two games. It gives lights, shadows and materials, which is where the extra
  detail comes from. Turbo Tumble already runs its three.js scene in the end-to-end tests on Chromium,
  Firefox and WebKit (iPad), so headless WebGL is proven here.
- **Alternatives**: PlayCanvas (rejected with the owner on 2026-10-30: its editor keeps projects off
  this repo; its engine would be a second 3D library). Faking depth in 2D canvas (rejected: the owner
  asked for real 3D; lighting and parallax would all be hand-made).
- **Note**: 0.128 has no `CapsuleGeometry` (added later); models use boxes, cylinders, spheres, tori and
  `ExtrudeGeometry`, which it has. Upgrading three is out of scope (it would touch Turbo Tumble).

## R2. World axes and the side-on view

- **Decision**: three's x = sim x; three's y = `WORLD_H − sim y` (sim y points down); z is depth. The
  battle plane (tanks, shells, crates) is z = 0. The ground is a slab from z = −`GROUND_DEPTH`/2 to
  +`GROUND_DEPTH`/2 (first guess 70 units). The camera looks along −z from in front, raised a little
  (about 6° down) so hill tops show as a thin strip (spec 009 clarification A). Field of view 30°.
- **Rationale**: Keeps every sim number unchanged and the view side-on; a narrow FOV keeps shell arcs
  close to how they look today while still showing depth and parallax.
- **Alternatives**: Orthographic camera (no parallax for the background layers, which FR-010 asks for).

## R3. Ground mesh from the breakable grid

- **Superseded (2026-10-30, to make surfaces smooth)**: the ground is now traced as closed outlines per piece of
  ground (marching squares, inside exactly where the cells are), each outline smoothed as a curve (points move towards
  their neighbours, at most 1 unit), filled with three.js's polygon filler and pushed back for walls with smooth
  normals; materials are painted by one shader from a mask texture of the cells. The whole ground is rebuilt after a
  blast (24–62 ms measured in Node on desktop; the frame-rate probe skips that frame); crater backs are filled only
  where ground was removed. The chunked design below was the first version.
- **Decision (first version)**: Build the ground from `Terrain.cells` with marching squares per material: the filled
  outline becomes the front face (triangles), and its edges are extruded back along z to make the walls
  and the top strip. The field is split into column chunks of 32 cells (13 chunks); `carve` only
  dirties the chunks it touched, and only those are rebuilt (the existing `groundChanged` hook says when).
  The mesh data (positions, normals, UVs per material) is built by a pure function in `ground.ts` with
  no DOM, so it is unit tested in Node.
- **Rationale**: Marching squares smooths the 4-unit cell steps that would show as stairs at the 2×
  zoom of 008; chunking keeps a blast's rebuild to one or two small meshes.
- **Alternatives**: One box per cell (stairs, and up to 100k boxes); rebuilding the whole ground per
  blast (simple but several ms on phones with big maps; kept as the fallback if chunking proves buggy).
- **Craters**: the walls made where cells were removed are coloured as the material's inside (darker,
  layered), so holes look cut into the ground (FR-006).
- **Smoothing** (added 2026-10-30): each corner's value is blended from its neighbouring cells (1 2 1 / 2 4 2 / 1 2 1),
  and outlines cross where the blend passes a half, so slopes are straight lines, not 4-unit steps; walls get normals
  averaged at their joints; the grass band is painted by the soil material from each column's untouched surface height.

## R4. Material looks

- **Decision**: Procedural textures drawn once at load into canvases (`CanvasTexture`): soil with layers
  and rocks, grass top, wood grain and nail heads, snow, ice (with a strong specular), water (transparent,
  scrolling ripple normal map). Front faces use world x/y as UVs, top strips world x/z. Each map keeps its
  current palette (today's `SCENES` colours). Style (spec FR-015): toy-like, so textures stay clean and simple, edges
  are rounded (bevelled extrusions), shadows soft (PCF soft shadow map), and materials fairly rough
  with gentle highlights.
- **Rationale**: Original art (FR-014), no image files to license or load, and small.
- **Alternatives**: Image textures (licensing and download size); vertex colours only (too flat).

## R5. Tank, wreck, crate and prop models

- **Decision**: `models.ts` builds each tank type as a `Group` from primitives: hull (extruded side
  profile taken from today's per-type outlines), turret, cannon pivot with barrels from the build table
  (`gunOf`, moved here from `pixel.ts`), tracks and road wheels. Colour = player colour on a
  `MeshStandardMaterial`; wrecks swap to dark rough steel and get small random dents; bonuses: gold wheel
  material (grip gear), a gold inverted-hull outline (shield), a gold torus (power shell), a missile model
  on top. Crates and parachutes, and the background props (ruin, sandbags, fence, logs) are models too.
  `models.ts` uses only three's geometry and material classes (no DOM), so it is unit tested in Node.
- **Rationale**: Keeps types recognisable (SC-002) with original shapes; one place for all models.
- **Alternatives**: Loading glTF files (needs authored art and a loader; not needed for these shapes).

## R6. Labels, arrow, hearts and the repair heart

- **Decision**: A transparent 2D canvas `#labels` over the WebGL canvas. Each frame, tank positions are
  projected to the screen and names, health bars, the active-tank arrow and rising repair hearts are
  drawn there, as today.
- **Rationale**: Text stays sharp and readable at every zoom (FR-009) and reuses today's drawing code.
- **Alternatives**: Text sprites in 3D (blurry when zoomed, extra textures per name).

## R7. Camera logic (008)

- **Decision**: `camera.ts` holds pure functions: the target view for a turn (centre on the active tank,
  half the field wide), for a shot (smallest view holding the firing tank and the shell with padding,
  never wider than the field), for the end (whole field); clamping to the field; smoothing towards the
  target (exponential, with each step capped at 5% of the view's width for the centre and 5% for the width,
  008 FR-002; the worst case, a turn change across the field after a whole-field shot view, settles in about
  0.6 s, under the 1 s of 008 FR-001); and converting between overview-map pixels and field x for
  dragging. `CameraMode` enum: Follow, Shot, Held, Whole. The view is described as `{ cx, cy, halfW }`
  in field units, and every camera function takes the screen's aspect so it can keep the view's height
  inside the field too (data-model.md); the scene turns the view into a camera distance. Reduced motion
  (`matchMedia('(prefers-reduced-motion: reduce)')`) makes smoothing jump.
- **Rationale**: All decisions are testable in Node (SC-002 of 008 is checked by sweeping shots through
  `predict` and the framing function); the scene only applies the result.
- **Alternatives**: Moving the camera inside the scene code (not unit testable).

## R8. Overview map (008)

- **Decision**: A small 2D canvas `#overview` (top-right, CSS opacity 0.6) drawn from the grid with
  today's flat ground-layer code, tanks as coloured dots, crates and shells as marks, and the view frame.
  Pointer events (mouse, touch, pen) drag the frame or tap to centre; this sets `CameraMode.Held`. A hide
  button `#overviewToggle` next to it; the choice is saved in Settings (`overview: boolean`, default true).
- **Keyboard (FR-007 of 008)**: `[` and `]` move the view left and right; `F` goes back to following. They
  don't clash with 007's keys (arrows, Q/E, −/+, Space, M for mute if bound).
- **Rationale**: Flat and cheap; reuses existing code; a separate canvas never covers the controls.

## R9. Removing Arcade style (008 FR-012)

- **Decision**: Delete `pixel.ts`, `pixel.test.ts`, the `fonts/` folder, `Style` from `enums.ts` and the
  stray-literal registry, `.tc.arcade` CSS, the arcade synth and `setStyle` in `sound.ts`, and the Style
  row in the garage. `Settings.style` is dropped; an old saved `style` field is ignored when loading
  (the rest of the saved settings are kept), with a unit test.

## R10. Speed and detail levels

- **Decision**: Pixel ratio capped at 2 (1.5 on touch, as Turbo Tumble), antialiasing on a graphics chip (cheap on the tile-based GPUs of iPads and phones; low detail also drops the pixel
  ratio to 0.75) but not on a software renderer (in software WebGL it halved the frame rate; measured 2026-10-30; the GPU's name is read once, from a throwaway WebGL context). One directional light with a
  1024 shadow map covering the camera's view. After the first 2 seconds of a battle, if the frame rate is
  under 45, switch to low detail: no shadows, fewer particles, pixel ratio 1 (FR-013). Meshes and
  materials are shared per type; geometries are disposed when a battle ends.
- **Rationale**: Meets 007's SC-002 with 10 tanks on phones; the existing 10-tank frame-rate e2e test
  keeps checking it.

## R11. Tests

- **Unit (Node)**: `camera.ts`, `ground.ts`, `models.ts`, `settings.ts` changes, and the deleted
  Arcade code's tests removed. 100% function coverage stays.
- **End-to-end**: every acceptance scenario of 008 and 009 in Chromium, Firefox and WebKit-iPad. Tests find
  tanks, shells, blasts and a surface point of each material through `data-tanks`, `data-shells`,
  `data-blast` and `data-materials` (contracts/ui.md), and check
  pixels on a Playwright page screenshot, never by reading the WebGL canvas back (it keeps no frame). The
  camera exposes its state on the game root for tests (`data-camera`, `data-view` = `cx,cy,halfW`), the
  same way the game already exposes `my-turn`. The look is checked with screenshots compared only for
  "not blank / not the 2D look" (a WebGL pixel probe), not pixel-exact, since GPUs differ.
- **Determinism (SC-004 of 009)**: rendering never writes to the battle; the existing seeded sim tests
  already pin results.

## Measured before the change (T003, 2026-10-30)

Time from pressing Start until the life panel shows, on the 2D production build, 5 runs each (`?seed=1`):

| Browser | Median | Runs (ms) |
|---|---|---|
| Chromium | 110 ms | 92, 99, 110, 112, 283 |
| WebKit (iPad) | 84 ms | 75, 77, 84, 87, 108 |
| Firefox | not measured | the local Playwright Firefox (firefox-1555) fails to start ("Could not find profile folder"), inside and outside the sandbox |

Before screenshots for the look check (SC-001): `look/before-<map>.png` (Chromium, 1280×720, `?seed=1`, first turn).
