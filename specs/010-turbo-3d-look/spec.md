# Feature Specification: Turbo Tumble's 3D look and speed

**Feature Branch**: `master` (this repo works on master)

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Upgrade Turbo Tumble's 3D look and speed (it already uses three.js): smoother edges (antialiasing on graphics chips, off on software renderers), a more detailed toy-like look like Tank Clash's 3D (rounded karts with a driver and a distinct shape per kart type, textures made by the game for grass, tarmac, sand, snow and neon, softer kerbs and barriers, one sun with soft shadows, layered hills, clouds and sky per track), and speed on phones (automatic low detail when frames run slow: no shadows, lower pixel ratio). Race rules, physics, items, bots, online play and controls stay exactly as they are."

Turbo Tumble is already drawn in 3D. This feature changes only how it looks and how fast it draws, in the same
toy-like style as Tank Clash (specs/009-tank-semi-3d FR-015). Every race rule, the karts' handling, items (Turbo, Goo,
Zap), computer racers, online play, standings and controls stay exactly as they are.

## Clarifications

### Session 2026-10-30

- Q: Should the trackside get props (tyre stacks, banners, a grandstand)? → A: A few, near the start/finish line only: a start arch with a banner, tyre stacks and a small grandstand; dropped in low detail.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Karts look like solid toys with drivers (Priority: P1)

Each kart type (Classic, Buggy, Rocket) has its own rounded, solid shape — a body, a seat with a driver (helmet in the
player's helmet colour, face in the chosen skin), wheels with hubs and something that marks the type (Buggy: roll bar
and chunky tyres; Rocket: a tail fin and exhausts; Classic: a low bumper and spoiler) — in the player's kart colour.
The garage shows the chosen kart the same way, turning slowly.

**Why this priority**: Players look at their own kart all race long; the karts are the plainest part today (boxes).

**Independent Test**: In the garage, pick each kart type and colour, helmet and skin, and check the kart preview
changes shape and colours; start a race and check every kart on the track has its type's shape.

**Acceptance Scenarios**:

1. **Given** the garage, **When** I pick Classic, Buggy or Rocket, **Then** the kart shown changes to that type's own
   shape, telling the three apart at a glance.
2. **Given** a kart colour, helmet colour and skin, **When** I pick them, **Then** the kart body, the driver's helmet and
   face show them.
3. **Given** a race, **When** karts drive, **Then** their wheels turn, and they lean and drift as today, now as solid
   rounded karts.

---

### User Story 2 - Tracks look detailed (Priority: P1)

Each track has its own look: the road has a tarmac texture (Meadow and Snow), packed sand (Desert) or glowing lanes
(Neon); the ground beside it is textured grass, sand, snow or a dark grid; kerbs and barriers are rounded and softer;
one sun casts soft shadows of karts, trees and barriers onto the track.

**Why this priority**: The track fills most of the screen and is flat-coloured today.

**Independent Test**: Start a race on each of the four tracks and check the road, ground, kerbs and barriers are
textured and karts cast shadows on the road.

**Acceptance Scenarios**:

1. **Given** each track, **When** a race starts, **Then** its road and ground show their own texture, not flat colour.
2. **Given** a kart on the road, **When** the sun shines, **Then** it casts a soft shadow under it that moves with it.
3. **Given** the track's edges, **When** I look at them, **Then** kerbs and barriers have rounded, shaded shapes.
4. **Given** the start/finish line, **When** a race starts, **Then** a start arch with a banner, tyre stacks and a small
   grandstand stand beside it (not in low detail).

---

### User Story 3 - The scenery has depth (Priority: P2)

Behind the track, each track has layered scenery at different distances — far hills or dunes or mountains, nearer
hills, trees or cacti or snowy pines or neon towers — a sky that fits the track, and clouds; farther layers are paler.

**Why this priority**: It completes the look; races play fine without it.

**Independent Test**: On each track, look towards the horizon and check there are several layers, paler with distance,
and a sky and clouds of the track's own colours.

**Acceptance Scenarios**:

1. **Given** each track, **When** I race, **Then** layers of scenery behind the track move at different speeds as the
   view turns (nearer layers faster), the farther ones paler.

---

### User Story 4 - Smooth edges and steady speed on every device (Priority: P1)

Edges look smooth on devices with a graphics chip. On a device that can't keep the race smooth, the game lowers its
detail by itself (no shadows, a lower drawing resolution, fewer scenery details) instead of slowing down; two players on
one screen (split screen) stay smooth too.

**Why this priority**: A more detailed look must not make races choppy, especially on phones and with split screen.

**Independent Test**: Race on a desktop: edges are smooth. Race with eight karts and with split screen; frame rate stays
at today's target; on a slow device the game switches to low detail.

**Acceptance Scenarios**:

1. **Given** a device with a graphics chip, **When** a race shows, **Then** edges are smoothed.
2. **Given** a device too slow for full detail, **When** a race starts, **Then** within a few seconds it switches to low
   detail and stays smooth.
3. **Given** two players on one screen, **When** they race, **Then** both halves stay smooth.

---

### Edge Cases

- **Gameplay unchanged**: kart sizes for collisions, speeds, drifting, items and their effects, lap counting, the
  minimap and standings stay exactly as today; seeded races give the same results.
- **Online**: every screen draws the same race; the look changes nothing that is sent between screens.
- **Split screen**: everything drawn twice must still be smooth; low detail applies to both halves.
- **Items on the track**: item boxes, Goo puddles and the Zap effect stay as easy to see and tell apart as today.
- **Resizing and rotating**: the look works from a phone to a desktop, in either orientation.
- **Custom colours**: very light or very dark kart, helmet or skin colours stay recognisable on the shaded karts.
- **Leaving and coming back** to the game must not use more memory each time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each kart type MUST have its own rounded, solid shape with a seated driver, in the player's kart colour,
  helmet colour and skin; the three types MUST be told apart at a glance.
- **FR-002**: Wheels MUST turn as the kart moves; karts MUST keep today's leaning, drifting and item effects (Turbo
  flames, Goo slowdown, Zap spin) in the new look.
- **FR-003**: Each track's road and ground MUST be textured (tarmac, sand, snow, grass or a neon grid) by the game itself,
  not from image files.
- **FR-004**: Kerbs and barriers MUST be rounded and shaded, in each track's colours.
- **FR-004a**: Each track MUST have a few props at its start/finish line — a start arch with a banner, tyre stacks
  and a small grandstand — in the track's colours; scenery only (karts pass through or around them as today's track
  allows: they stand off the road), dropped in low detail.
- **FR-005**: One sun per track MUST light the scene and cast soft shadows of karts, trees and barriers onto the track.
- **FR-006**: Each track MUST have layered scenery behind it at different distances (paler farther away), its own sky
  and clouds.
- **FR-007**: The garage MUST show the chosen kart in the new look.
- **FR-008**: Edges MUST be smoothed on devices with a graphics chip; on software renderers (as in automated test
  browsers) smoothing MAY be off.
- **FR-009**: When a device can't keep the race smooth, the game MUST lower detail by itself (no shadows, lower drawing
  resolution, fewer scenery details, no start-line props), for both halves in split screen.
- **FR-010**: Race rules, kart handling, collisions, items, computer racers, online messages, standings and controls
  MUST NOT change.
- **FR-011**: All art MUST be original and toy-like (rounded, bright, soft light; no grime), matching Tank Clash's style.
- **FR-012**: Leaving the game and coming back MUST free what the game drew (no memory growing per visit).

### Key Entities

- **Kart look**: a kart type's shape, the player's kart colour, helmet colour and skin, its wheels and driver.
- **Track look**: a track's road, ground, kerb and barrier looks, its sun, sky, clouds and scenery layers.
- **Detail level**: full or low, chosen per device from how smoothly it draws.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The race stays as smooth as today with eight karts: the existing frame-rate test still passes, and split
  screen on a desktop holds at least 50 frames a second.
- **SC-002**: The same seeded race gives the same finishing order and times before and after the change.
- **SC-003**: People shown each kart type for 2 seconds name it correctly at least 9 times out of 10 (manual check
  with 5 people).
- **SC-004**: In side-by-side screenshots of the same race before and after, at least 4 of 5 people say the new one looks
  more detailed (manual check).
- **SC-005**: A race opens within 1 second of today's time.
- **SC-006**: On a real iPad and a real phone, an eight-kart race shows no visible stutter (lowering detail is allowed).

## Assumptions

- Turbo Tumble keeps using the 3D library it already has; nothing new is downloaded.
- Kart and track shapes are built by the game in code (original art), like Tank Clash's.
- The minimap, HUD, garage panel and menus keep their layout; only the kart preview changes.
- Sounds, controls and online play are untouched.
- No new tracks, kart types, items or settings.
