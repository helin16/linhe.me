# Feature Specification: Tank Clash focus camera and overview map

**Feature Branch**: `master` (no feature branch; this repo works on master)

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "remove the arcade, and introduce focus screen: when the tanks is moving, it will focus on the tank and the screen will zoom in to that focus onto the currently in-turn tank. but after it fires, the map will zoom out to view both the tank and the landing area. and there is overview map semi-transparent that player can drag and view different part of the map."

This feature changes Tank Clash (feature 007, `specs/007-tank-artillery`). Where the two disagree, this spec wins:
it replaces 007's FR-026 (the Style switch) and the Arcade parts of FR-021 and FR-024.

## Clarifications

### Session 2026-10-30

- Q: On turns that aren't yours (computer, other player on this device, remote player), should the camera zoom in on that tank too? → A: Yes, the camera zooms in on every tank in turn.
- Q: Should players be able to zoom the main view themselves (pinch or mouse wheel)? → A: No; the camera sets the zoom, players only move the view.
- Q: Should the overview map always be shown, or can players hide it? → A: Shown by default, with a small button to hide or show it, remembered on this device.
- Q: When a turn starts, should the camera zoom in straight away or wait until the tank drives or aims? → A: Straight away, as soon as the turn starts; it stays close while the tank drives, aims or waits.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The camera follows the tank in turn (Priority: P1)

When a turn starts, the screen glides in on the tank whose turn it is, so its tank, cannon and
nearby ground are drawn bigger than today's whole-field view. While that tank drives, the view
moves with it, so it never drives off the screen. Aiming keeps the same close view.

**Why this priority**: This is the core of the request. On a phone the whole field makes tanks
small; a close view makes driving and aiming easier.

**Independent Test**: Start a 1 Player battle, drive left and right, and check the active tank
stays near the middle of the screen at the close zoom; at the next turn the view moves to the
next tank.

**Acceptance Scenarios**:

1. **Given** a battle has just started, **When** the first turn begins, **Then** within 1 second
   the view zooms in on the in-turn tank, showing about half the field's width.
2. **Given** it is my turn, **When** I hold ← or →, **Then** the view moves smoothly with my tank
   and my tank stays inside the middle third of the screen.
3. **Given** a computer's or the other player's turn, **When** their tank drives, **Then** the view
   follows their tank the same way.
4. **Given** the in-turn tank is near the left or right edge of the field, **When** the view
   follows it, **Then** the view stops at the field's edge (the scenery beyond still fills the
   screen, as today) and never shows empty space.

---

### User Story 2 - The camera pulls back to show the shot (Priority: P1)

After a tank fires, the view zooms out smoothly so that both the firing tank and the shell stay on
screen for the whole flight, and the place where the shell lands is on screen when it lands. After
the blast settles, the view moves on to the next tank in turn.

**Why this priority**: Without it the close view would hide where shots land, which is the point
of the game.

**Independent Test**: Fire a long shot at full power and check the shell is never off screen and
the blast is on screen; fire a short shot and check the view doesn't zoom out further than needed.

**Acceptance Scenarios**:

1. **Given** the close view, **When** I fire, **Then** the view zooms out as the shell flies so the
   firing tank and the shell are both on screen at every moment of the flight.
2. **Given** a shell lands, **When** it explodes, **Then** the explosion and the ground it breaks are
   on screen, and the view stays there until the blast, falling tanks and wrecks have settled.
3. **Given** a short shot that lands close by, **When** it flies, **Then** the view zooms out only as
   much as needed to keep the tank and shell on screen.
4. **Given** a shell flies above the top of the field or off its side, **When** it is out of the
   field, **Then** the view zooms out no further than the whole field.
5. **Given** the blast has settled, **When** the next turn starts, **Then** the view glides to the
   next tank in turn, as in User Story 1.

---

### User Story 3 - A see-through overview map I can drag (Priority: P2)

During a battle a small see-through map of the whole field sits in a corner of the screen. It shows
the ground, every tank in its colour, crates and shells in flight, and a frame showing what the
main view is showing. I can drag that frame (or tap or click anywhere on the map) to look at
another part of the field, for example to find an enemy before I aim.

**Why this priority**: The close view hides far tanks; the overview gives players the whole picture
and a way to look around.

**Independent Test**: In a battle, drag the frame on the overview map to the far side and check the
main view shows that part of the field at the same zoom; then drive and check the view goes back
to following the tank.

**Acceptance Scenarios**:

1. **Given** a battle, **When** it is on screen, **Then** the overview map shows the whole field
   see-through (the battle behind it stays visible), with the frame of the main view on it.
2. **Given** the overview map, **When** I drag its frame with a finger or the mouse, **Then** the
   main view moves to match while I drag, at the same zoom, and the camera stops following the tank.
3. **Given** the overview map, **When** I tap or click a spot on it, **Then** the main view centres on
   that spot.
4. **Given** I moved the view by hand, **When** the in-turn tank drives or fires, or a new turn
   starts, **Then** the camera goes back to following as in User Stories 1 and 2.
5. **Given** a keyboard only, **When** I press the look-around keys, **Then** the main view moves
   left or right along the field, and the follow key brings it back to the in-turn tank.
6. **Given** a shot is in flight, **When** I drag the overview map, **Then** I can look around, and
   the camera goes back to following at the next turn.
7. **Given** the overview map, **When** I press its hide button, **Then** it disappears and stays
   hidden in later battles on this device until I press the button again to show it.

---

### User Story 4 - Arcade style is gone (Priority: P3)

The Style switch disappears from the garage. Every battle uses today's Normal look and sounds: the
cartoon tanks and scenery, the normal font and buttons, and the recorded clips.

**Why this priority**: Asked for, and simple; it doesn't depend on the camera work.

**Independent Test**: Open the garage and check there is no Style switch; on a device that had
Arcade saved, start a battle and check it is drawn in the Normal look with the recorded sounds.

**Acceptance Scenarios**:

1. **Given** the garage, **When** it opens, **Then** there is no Style row.
2. **Given** a device that saved Arcade before this change, **When** it loads, **Then** it plays in
   the Normal look and sounds, and the rest of its saved settings are kept.
3. **Given** the pixel font, pixel art and retro sounds, **When** the game is built, **Then** they are
   no longer part of the game (the credited recorded clips and the game's own fallback sounds stay).

---

### Edge Cases

- **Every turn type**: the camera behaves the same whether the in-turn tank is mine, the other
  player's (2 Players on one device), a computer's or a remote player's (Online).
- **Online**: each screen moves its own camera; looking around on one screen never moves the view on
  another, and the camera never changes the battle itself.
- **A tank falls** (wood breaks, or it drives off a ledge): the view follows the falling tank until
  it lands, sinks or falls out of the field.
- **The in-turn tank is destroyed** by its own shot: the view stays on the blast until it settles,
  then moves to the next turn.
- **Air drops**: a crate falling while the view is close is not followed; the overview map shows it.
- **Timeout**: a turn that times out with no shot moves straight to the next tank.
- **Resizing or rotating** the screen: the view keeps its centre and zoom, recalculated for the new
  screen shape; the overview map keeps its corner.
- **Small screens**: the overview map gets smaller but stays readable, and never covers the life
  panel, the turn timer or the controls.
- **Reduced motion**: on a device asking for less motion, the camera jumps to its new place instead
  of gliding.
- **End of battle**: when the battle ends, the view zooms out to the whole field behind the result.
- **Missiles** fly faster: the zoom-out keeps pace so the missile is never off screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: As soon as each turn starts (before the tank moves) the battle view MUST glide (within 1 second) to a close view
  centred on the in-turn tank, whoever controls it (me, player 2, a computer or a remote player), showing half the field's width. On landscape screens that is at least 2× today's whole-field zoom; on a
  portrait screen it already shows the field's full height, so it zooms in sideways only.
- **FR-002**: While the in-turn tank drives, aims or falls, the view MUST keep it inside the middle
  third of the screen, moving smoothly, never past the field's left, right or bottom edge. "Smoothly"
  (here and in FR-001 and FR-003) means no jumps: from one frame to the next the view's centre moves by at
  most 5% of the view's width and its width changes by at most 5% (except with reduced motion, FR-010).
- **FR-003**: From the moment a tank fires until its shell has exploded, the view MUST zoom out
  smoothly as needed to keep the firing tank and the shell (or missile) on screen, zooming out no
  further than the whole field.
- **FR-004**: After a shell explodes, the view MUST keep the blast on screen until everything it set
  off has settled (falling ground, tanks and wrecks), then the next turn starts with FR-001.
- **FR-005**: During a battle the screen MUST show a see-through overview map of the whole field in
  the top-right corner (unless the player hid it, FR-014), drawn at about 60% opacity, showing the ground (with the holes shots made), each live
  tank and wreck in its colour, crates and shells in flight, and a frame marking the main view.
- **FR-006**: Players MUST be able to move the main view by dragging the overview map's frame (touch
  or mouse) or by tapping or clicking a spot on the overview map, keeping the current zoom; the
  overview map MUST NOT change any tank's aim, power or position. There is no manual zoom (no pinch, mouse
  wheel or zoom button); only the camera sets the zoom.
- **FR-007**: Players MUST be able to look around with the keyboard (keys to move the view left and
  right, and a key to go back to following), without clashing with the battle keys in 007's FR-013.
- **FR-008**: After a player moves the view by hand, the camera MUST go back to following when the
  in-turn tank next drives or fires, when a new turn starts, or when the follow key is pressed.
- **FR-009**: The camera and overview map MUST be per screen only: never sent online, never saved
  (except the hide choice, FR-014),
  and never changing what happens in the battle.
- **FR-010**: When the device asks for reduced motion, camera moves MUST jump instead of glide.
- **FR-011**: The overview map MUST stay clear of the life panel, the turn timer and the controls on
  every supported screen size, from a phone held either way to a desktop.
- **FR-012**: The Style switch and Arcade style MUST be removed: no Style row in the garage; no pixel
  art, pixel font or retro sounds. A saved Arcade choice MUST be ignored without losing the device's
  other saved settings.
- **FR-013**: When the battle ends, the view MUST zoom out to the whole field.
- **FR-014**: A small button next to the overview map MUST hide or show it, usable by touch, mouse and
  keyboard; the choice MUST be remembered on this device (shown by default). Hiding the map leaves the
  keyboard look-around keys working.

### Key Entities

- **Camera (per screen)**: where the main view is centred, how far it is zoomed, and whether it is
  following the in-turn tank, following a shot, or held where a player put it.
- **Overview map**: a small, see-through picture of the whole field with a frame for the camera's
  view; it reads the battle but never changes it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a phone held sideways, the in-turn tank is drawn at least 1.8× as large as in the
  whole-field view while driving and aiming.
- **SC-002**: In test shots at every power from 10 to top power, for every tank type, the shell and
  the firing tank are on screen in 100% of frames of the flight, and the blast is on screen.
- **SC-003**: After a turn change, the view settles on the next tank within 1 second.
- **SC-004**: A player can bring any part of the field into the main view with one drag or one tap
  on the overview map, in under 2 seconds.
- **SC-005**: The camera and the overview map cost no visible speed: with 10 tanks, the frame rate with
  the overview map shown and the camera moving is within 5% of the frame rate with the map hidden and the
  camera still (the overall 10-tank target itself is 009's SC-003).
- **SC-006**: No Style switch appears in the garage, and a device with Arcade saved plays in the
  Normal look.

## Assumptions

- "Focus" means the close view described in FR-001, held for the whole turn until the shot (not only while
  the tank drives); the zoom amount (about half the field's width)
  is a first guess to tune by playing.
- The overview map sits in the top-right corner (the life panel is top-left).
- Keyboard look-around keys are chosen in planning; they must not clash with 007's FR-013 keys.
- Removing Arcade also retires the arcade boards on the design canvas; those are design notes, not
  part of the game, and are left as they are.
- Credits for the recorded clips stay as they are (007's FR-024).
- Gameplay, bots, online messages and saved battles are unchanged.
