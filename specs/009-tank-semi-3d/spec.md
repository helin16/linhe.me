# Feature Specification: Tank Clash in semi-3D

**Feature Branch**: `master` (no feature branch; this repo works on master)

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "we need to convert the whole game to be semi 3D game, so it will show more details of the map, hills, wood, steal and tank"

This feature changes how Tank Clash (feature 007, `specs/007-tank-artillery`) looks. It works
together with the focus camera and overview map (feature 008, `specs/008-tank-focus-camera`), which
also removes Arcade style; this spec covers only the Normal look, which becomes semi-3D.

"Semi-3D" here means the battle looks solid and deep (shaded, lit, with thickness and depth) while
it still plays exactly as today: tanks drive left and right along one line of ground, shells fly in
the same flat plane, and every rule of 007 stays the same.

## Clarifications

### Session 2026-10-30

- Q: How far should the view tilt? → A: Side-on with depth, the same viewpoint as today; everything shaded and solid, hill tops showing a thin strip running back.
- Q: Should the battle be drawn as real 3D, and with which engine? → A: Real 3D, with three.js (already in the site, used by Turbo Tumble); not PlayCanvas, whose online editor keeps projects off this repo and whose engine would be a second 3D library. Planned together with feature 008.
- Q: What style should the 3D tanks and scenery have? → A: Stylised toy-like: rounded shapes, bright player colours, soft light and shadows, clean simple textures.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The ground looks solid and detailed (Priority: P1)

The hills, wood, snow, ice and water look like solid, lit objects with depth instead of flat
shapes. Hills show a lit top surface running back into the scene and a darker front face with
layers of soil and rocks; wood looks like planks and beams with grain and nail heads; snow is soft
and bright with shading; ice is glossy with highlights; water shows a surface with depth and
ripples. Holes blown by shells look like craters cut into the solid ground, with the broken edge
showing the inside.

**Why this priority**: The ground is most of the screen and is what the request names first (map,
hills, wood).

**Independent Test**: Start a battle on each of the four maps and compare with today's look: every
material shows depth and shading; fire a few shots and check each hole looks cut into the ground.

**Acceptance Scenarios**:

1. **Given** any map, **When** a battle starts, **Then** the hills show a lit top surface with depth
   and a shaded front face with visible soil layers.
2. **Given** Timber Gap, **When** a battle starts, **Then** its bridges look like wooden planks and
   beams with grain, and breaking them shows splintered ends.
3. **Given** Frost Ridge or Lake Valley, **When** a battle starts, **Then** snow, ice and water each
   look different and solid (snow soft, ice glossy, water with depth and ripples).
4. **Given** a shell hits the ground, **When** the hole is made, **Then** it looks like a crater in
   the solid ground with its edge showing the inside, and the ground still breaks exactly where it
   does today.

---

### User Story 2 - Tanks and wrecks look like solid machines (Priority: P1)

Each tank type looks like a solid, shaded machine in the player's colour: rounded hull, turret with
volume, a cannon with a round barrel, tracks and road wheels with depth, and light from the same
direction as the scenery. The four types stay easy to tell apart, and builds A, B and C still show
their cannon differences. Destroyed tanks leave steel wrecks that look like scorched, dented metal.

**Why this priority**: Tanks are what players watch and aim with; the request names tank and steel.

**Independent Test**: In the garage, look at all four types in A, B and C; in a battle, destroy a
tank and look at its wreck.

**Acceptance Scenarios**:

1. **Given** the garage preview, **When** I choose each type and build, **Then** it is drawn as a
   shaded, solid tank in my colour, and the four types are told apart at a glance.
2. **Given** a tank on a slope, **When** it tilts, **Then** it still looks solid and its cannon still
   points at the angle shown.
3. **Given** a tank is destroyed by losing its hearts, **When** its wreck stays, **Then** the wreck
   looks like dark, scorched steel with dents, clearly different from a live tank.
4. **Given** bonuses (grip gear, shield, power shell, missile), **When** a tank holds them, **Then**
   they still show as in 007's FR-021 (gold wheels, gold outline, gold ring, missile on top), drawn to
   match the solid look.

---

### User Story 3 - The scenery and effects have depth (Priority: P2)

The sky, far mountains, near hills and props behind the field form layers at different distances,
with the farther layers paler, so the scene feels deep. Shells, missiles, crates and parachutes look
solid; explosions, smoke and dust look round and lit; shells cast a small shadow on the ground under
them.

**Why this priority**: It completes the look, but the battle reads fine without it.

**Independent Test**: Start a battle on each map and check the layers behind the field; fire a shot
and watch the shell, its shadow and the explosion.

**Acceptance Scenarios**:

1. **Given** any map, **When** the camera moves (feature 008), **Then** farther layers move less than
   nearer ones, so the scene shows depth.
2. **Given** a shell in flight, **When** it is over the ground, **Then** a small shadow on the ground
   below shows where it is above.
3. **Given** an air drop, **When** it falls and lands, **Then** the crate and parachute look solid.

---

### Edge Cases

- **Gameplay is unchanged**: hit areas, how much ground each blast removes, tank sizes for hits and
  driving, and every 007 rule stay exactly as today; only the look changes. Online battles between
  screens show the same battle.
- **Slower devices**: if a device can't keep the battle smooth, it MUST lower detail (for example
  fewer effects) rather than slow the game down.
- **Many tanks**: with 10 tanks, all are drawn in the solid look and the battle stays smooth.
- **Big holes and lost ground**: when large parts of the ground are blown away, the remaining pieces
  still look solid on every side, including ground left floating.
- **Water** that a wreck or tank falls into still shows it sinking.
- **Screen sizes and resizing**: the look works from a phone to a desktop, with no gaps at the edges
  (as today, the scenery fills the screen).
- **Colours**: each player's chosen colour stays recognisable on the shaded tank, including in the
  life panel and the overview map.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The battle MUST look semi-3D: solid shapes with light from one direction, shading,
  thickness and depth, viewed side-on as today (not from above): hill tops show only a thin strip
  running back into the scene, and shell paths look exactly as flat and readable as now.
- **FR-002**: Gameplay MUST NOT change: tanks drive along one line of ground, shells fly in one flat
  plane, and every rule, number and online message of 007 (and 008) stays the same.
- **FR-003**: Hills MUST show a lit top surface with depth and a darker front face with soil layers
  and rocks; each map keeps its own colours and character.
- **FR-004**: Wood MUST look like planks and beams with grain; breaking wood MUST show splintered ends.
- **FR-005**: Snow, ice and water MUST each look solid and distinct: snow soft and bright, ice glossy
  with highlights, water with surface ripples and depth.
- **FR-006**: Holes blown in the ground MUST look like craters cut into solid ground, matching exactly
  the ground the rules removed.
- **FR-007**: Each tank type MUST look like a solid machine in the player's colour (hull, turret,
  round cannon, tracks and wheels with depth), the four types MUST stay easy to tell apart, and builds
  A, B and C MUST keep their cannon differences.
- **FR-008**: Wrecks MUST look like scorched, dented steel, clearly different from live tanks.
- **FR-009**: Bonus visuals (007's FR-021), labels, the active-tank arrow and health shown on the field
  MUST keep their meaning and stay readable in the new look.
- **FR-010**: The scenery behind the field MUST form layers at different distances, farther layers
  paler and moving less when the view moves.
- **FR-011**: Shells, missiles, crates, parachutes, explosions, smoke and dust MUST look solid and lit;
  shells MUST show a small shadow on the ground below them.
- **FR-012**: The garage preview MUST show the chosen tank in the new look.
- **FR-013**: The game MUST keep running smoothly (as measured by SC-003); on a device too slow for full detail it MUST lower
  detail rather than slow the game.
- **FR-014**: All art MUST be original (007's FR-018).
- **FR-015**: The art style MUST be stylised and toy-like: rounded shapes, bright colours (each player's
  colour covering the tank's body, not just a marking), soft light and soft shadows, and clean, simple
  textures; no grime, rust or realistic wear (wrecks are scorched and dented, still in the same style).

### Key Entities

- **Material look**: how each ground material (earth, snow, ice, wood, water) is shown: its top,
  front face, inside (seen in craters) and edge.
- **Tank look**: each type's solid shape, its build's cannon, the player's colour, and its wreck.
- **Scene layers**: the sky and the layers of scenery behind the field, each at its own distance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Look check (manual, done once before release): 5 people are shown, for each of the four maps,
  a screenshot of the same seeded battle before (saved before the change) and after, in random order, and
  asked which looks more detailed and solid; at least 4 of the 5 pick the new one on every map.
- **SC-002**: Recognition check (manual, done once before release): after seeing each tank type named once,
  5 people are shown the four types one at a time for 2 seconds each, in random order and colours, and name
  them; at least 18 of the 20 answers are right.
- **SC-003**: The battle stays as smooth as today with 10 tanks: the existing 10-tank test still measures at
  least 50 frames a second in Chromium (007's SC-002), and in a manual check on a real iPad and a real phone
  a 10-tank battle shows no visible stutter (lowering detail, FR-013, is allowed).
- **SC-004**: The same seeded battle played with the old and new look gives exactly the same result
  (same hits, holes, hearts and winner).
- **SC-005**: A battle opens within the same time as today (no more than 1 second longer).

## Assumptions

- "Semi-3D" means the look, not new movement: the battle stays a side-view game on one line of ground.
- "Steal" in the request means steel: the steel wrecks of 007's FR-025.
- This builds on feature 008 (camera and overview map) and assumes Arcade style is removed by it; if
  008 is built later, its camera works with this look unchanged.
- The overview map (008) may stay simple and flat; it is a map, not part of the scene.
- Sounds, the garage layout, controls and menus are unchanged apart from the tank preview.
- No new maps, materials or tank types.
- The battle is drawn as real 3D (models, lights and shadows) using the 3D library the site already has
  for Turbo Tumble; tanks, wrecks, crates and props are simple models built by the game (original art).
- 008 and 009 are planned and built together, since both replace how the battle is drawn.
