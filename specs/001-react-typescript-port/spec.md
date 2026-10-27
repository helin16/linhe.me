# Feature Specification: Rebuild linhe.me as a typed single-page site

**Feature Branch**: `master` (no feature branch)

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Convert linhe.me to React + TypeScript (Vite): home and games pages as React routes, Turbo Tumble ported to TypeScript with three.js mounted in one React component, plain CSS kept, single-player and split-screen unchanged. Remove the Bluehost-era .htaccess, check_htaccess.py and the Python server.py; add a .gitignore (node_modules/, dist/, .env, .DS_Store). Online mode is out of scope here (it moves to the new Node/TS relay in a later feature) and must fail gracefully with the existing message until then."

## Clarifications

### Session 2026-10-28

- Q: When the game is rebuilt, should it look exactly the same, or is a slight change in lighting and colour acceptable? → A: Must look identical; keep the same 3D library version (r128) for this rebuild.
- Q: What is the oldest browser the site and game still need to work on? → A: Browsers from the last 3 years: Safari 16.4+ (iPadOS/iOS 16.4), and Chrome, Edge and Firefox from 2023 on.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play Turbo Tumble exactly as before (Priority: P1)

A visitor opens Turbo Tumble on a computer or an iPad, sets up their driver and kart in the garage,
picks one of the four tracks (Meadow, Desert, Snow, Neon) and races three rivals, alone or with a
friend in split-screen on the same device. Everything looks, sounds and plays as it does today.

**Why this priority**: the game is the main thing people come to the site for; a rebuild that
changes how it plays is a regression, whatever else improves.

**Independent Test**: open the game, race one full race on each track in single-player with the
keyboard, one in two-player split-screen, and one with touch controls on an iPad; compare against
the current version side by side.

**Acceptance Scenarios**:

1. **Given** the game page, **When** a player starts a single-player race, **Then** they race three
   rivals over the chosen track with drifting, drift boost and item boxes (turbo, goo, zap), lap
   counter, position, timer, minimap and "wrong way" warning, and see the results at the end.
2. **Given** two-player mode is selected, **When** the race starts, **Then** the screen splits in two,
   player 1 drives with W/A/S/D + Space (drift) + E (item), player 2 with the arrow keys + Right
   Shift (drift) + Enter (item), and each player's sounds sit on their side of the stereo field.
3. **Given** a touch device, **When** the game loads, **Then** on-screen steer, brake, drift and item
   controls plus restart, garage and mute buttons appear, and a full race can be completed by touch.
4. **Given** a race in progress, **When** the player presses R, G or M, **Then** the race restarts,
   the garage opens, or sound toggles mute, as today.
5. **Given** a player customised their name, kart colour, helmet, skin, kart style, player count and
   track in the current version, **When** they open the rebuilt game in the same browser, **Then**
   those settings are still there.

---

### User Story 2 - Browse the site and find the games (Priority: P2)

A visitor lands on the home page, sees the intro and the games section, opens the games list and
goes into a game, then back, using the header links and the browser's back button.

**Why this priority**: it is how people reach the game, but the game still works if opened directly.

**Independent Test**: visit `/`, `/games/` and `/games/turbo-tumble/` both by clicking through and by
typing each address directly or reloading; check content, links and back/forward behaviour.

**Acceptance Scenarios**:

1. **Given** any page, **When** the visitor uses the header (logo, Home, Games), **Then** they reach
   the right page without a full page reload, and browser back/forward work.
2. **Given** a visitor types or bookmarks `/games/` or `/games/turbo-tumble/` directly, **When** the
   page loads, **Then** that page is shown (not a not-found error) at the same address as today.
3. **Given** the home page and the games page, **When** they load, **Then** they show the same
   content as today (intro, Turbo Tumble card, "More coming soon" card, footer with the current year),
   in light or dark mode following the device setting.
4. **Given** an unknown address under the site, **When** it is opened, **Then** the visitor sees a
   simple not-found page with a link home.

---

### User Story 3 - Online mode says clearly it isn't available yet (Priority: P3)

A player picks the online option in the game's menu. Since no online server exists yet, they see
the existing message explaining that online play isn't available, and can switch back to 1 or 2
players and race normally.

**Why this priority**: online play is moving to a new server in a later feature; until then, it
must not confuse players or break the menu.

**Independent Test**: with no relay running, choose online in the menu; check the message, then
start a single-player race.

**Acceptance Scenarios**:

1. **Given** no online server, **When** the player chooses online, **Then** within 5 seconds the menu
   shows "Online play isn't available here (it needs the game server), or the room is full." and
   the player count can be switched back.
2. **Given** that message is showing, **When** the player chooses 1 or 2 players and starts,
   **Then** the race works normally.

---

### User Story 4 - The project is easy to work on and safe to publish (Priority: P3)

The site owner works on the project, adds future games, and publishes it, without generated or
private files being committed or published.

**Why this priority**: it unlocks future games and the move to the new server, but visitors don't
see it directly.

**Independent Test**: from a fresh clone, follow the README to install, run locally, and produce a
publishable build; check that git ignores generated and private files and that the build output
contains only site files.

**Acceptance Scenarios**:

1. **Given** a fresh clone, **When** the owner follows the README, **Then** they can run the site
   locally and produce a publishable build with one command each.
2. **Given** a build, **When** its output is listed, **Then** it contains only the files visitors need
   (pages, styles, scripts, assets): no source, specs, docs, tooling or server code.
3. **Given** installed dependencies, a build, local secrets files and macOS folder metadata exist,
   **When** the owner runs `git status`, **Then** none of them are listed as new files.
4. **Given** the rebuilt project, **When** its files are listed, **Then** the Bluehost-era hiding rules,
   their check script and the old Python game server are gone.

### Edge Cases

- A visitor has old saved settings from the single-player-only version (saved name/colour at top
  level): they are carried over into player 1, as today.
- Saved settings are missing, corrupted or storage is blocked (private browsing): the game starts
  with defaults and does not crash.
- A visitor loads the game directly on a slow connection: the home and games pages don't have to
  download the 3D engine; only the game page does.
- A visitor resizes the window or rotates the iPad mid-race: the view(s) resize without distortion.
- A visitor leaves the game page mid-race using the header or back button: sound stops, and going
  back to the game later starts it fresh without doubled sounds or controls.
- Sound only starts after the first tap or key press (browser rule), as today.
- A saved track that no longer exists falls back to Meadow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST keep every current gameplay feature: four tracks, three AI rivals,
  drifting and drift boost, item boxes with turbo/goo/zap, laps, positions, timer, minimap, wrong-way
  warning, results screen, synthesised sound with mute, and the garage (name up to 10 characters,
  kart colour, helmet colour, skin tone, kart style, stats display).
- **FR-002**: The game MUST keep its current controls: the two keyboard layouts, R/G/M shortcuts,
  and the touch controls and touch toolbar on touch devices.
- **FR-003**: The game MUST support one player and two-player split-screen on one device, as today.
- **FR-004**: The game MUST read and keep writing the visitor's existing saved settings, so nothing a
  player set up before the rebuild is lost, including the legacy single-player save format.
- **FR-005**: The site MUST serve the home page at `/`, the games list at `/games/` and Turbo Tumble
  at `/games/turbo-tumble/`, both when navigated to and when opened or reloaded directly.
- **FR-006**: Moving between site pages MUST NOT reload the whole page, and browser back/forward
  MUST work.
- **FR-007**: The home and games pages MUST keep their current content, light/dark behaviour, and
  layout at phone width with no sideways scrolling.
- **FR-008**: Unknown addresses MUST show a not-found page with a link home.
- **FR-009**: The 3D engine and game code MUST only download when the game page is opened.
- **FR-010**: Leaving the game page MUST stop its sound, controls and animation; returning MUST start
  a clean game.
- **FR-011**: Choosing online play MUST show the existing "not available" message and leave the
  1- and 2-player modes fully usable.
- **FR-012**: A single documented command MUST start the site locally, and another MUST produce the
  publishable build; the build MUST fail if there are type errors.
- **FR-013**: The publishable build MUST contain only files visitors need.
- **FR-014**: Generated files, installed dependencies, local secrets files and macOS folder metadata
  MUST be ignored by git.
- **FR-015**: The Bluehost-era hiding rules (`.htaccess`), their check script and the Python game
  server MUST be removed, and the README MUST describe the new run and build steps.
- **FR-016**: The games list MUST come from one place, so adding a future game means adding its
  folder and one entry.
- **FR-017**: The game MUST render identically to today (same lighting, colours and shading on every
  track), so it MUST stay on the same 3D library version (r128). Upgrading it is a separate feature.
- **FR-018**: The site and game MUST work on Safari 16.4+ (iPadOS/iOS and macOS) and on Chrome, Edge
  and Firefox released from 2023 on. Older browsers are not supported.

### Key Entities

- **Game settings (garage)**: per-player name, kart colour, helmet colour, skin tone and kart style
  for two players, plus player count, chosen track and mute. Stored in the visitor's browser.
- **Game entry**: a game's name, address, short description, tags and card art, shown on the home
  and games pages.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A side-by-side check of all four tracks, 1P and 2P, keyboard and touch, finds no
  difference in features, controls, behaviour or look (lighting, colours) from the current version.
- **SC-002**: 100% of players who had saved garage settings see them after the rebuild.
- **SC-003**: The game runs smoothly (no visible stutter) for a full 2-player race on an iPad on
  iPadOS 16.4 or later, as the current version does.
- **SC-004**: The home page is interactive in under 2 seconds on a typical home broadband connection
  and does not download the game.
- **SC-005**: All three addresses (`/`, `/games/`, `/games/turbo-tumble/`) work when opened directly
  and when reloaded, with no not-found errors.
- **SC-006**: Choosing online with no server shows the message within 5 seconds, every time, and a
  normal race can start straight after.
- **SC-007**: A fresh clone to a running local site takes no more than two commands after installing
  the documented prerequisites.

## Assumptions

- The technology is fixed by the constitution (v2.0.1): React + TypeScript built with Vite, plain CSS,
  three.js from npm, all code TypeScript. This spec stays at the behaviour level; the plan holds the
  how.
- Same-site addresses stay the same and the site keeps the same domain, so browser-saved settings
  carry over; the storage key and format stay as today.
- Hosting on the Vultr VPS (Caddy serving the build, falling back to the app for direct addresses) is
  a separate feature; here, direct-address support is verified with the local preview of the build.
- Online play, the Node/TypeScript relay and room codes are out of scope (a later feature). The
  online option stays in the menu and shows the existing message.
- The live Bluehost site keeps running unchanged until the VPS feature switches the domain over;
  nothing here deploys.
- The "Projects" section stays removed, as it is today.
- The site footer shows the GitHub link on every page (today only the home page has it); this is
  the one deliberate content change.
