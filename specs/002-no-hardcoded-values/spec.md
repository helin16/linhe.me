# Feature Specification: One source of truth for fixed values

**Feature Branch**: `master` (no feature branch)

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Bring the codebase in line with constitution v2.3.0 principle VIII: route, game-slug, message-type, item, race-state and track/style enums as const objects; no environment paths in docs"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitors notice nothing (Priority: P1)

A visitor uses the site and plays Turbo Tumble after this change exactly as before: same pages,
addresses, menus, controls, tracks, karts, items, races and saved garage settings.

**Why this priority**: this is a clean-up with no visible change; any behaviour change is a bug.

**Independent Test**: run the feature 001 checks (spec 001 quickstart steps 4–6) on the new build:
every page and address, a race on each track in 1P and 2P, items, garage, saved settings, and the
online "not available" message.

**Acceptance Scenarios**:

1. **Given** the updated site, **When** a visitor opens `/`, `/games/` and `/games/turbo-tumble/`
   directly and by clicking, **Then** each page, title and link behaves as before.
2. **Given** a player with saved garage settings from before, **When** they open the game,
   **Then** their name, colours, skin, kart style, player count and track are unchanged.
3. **Given** a race on any track in 1 or 2 players, **When** the player drives, drifts and uses each
   item (turbo, goo, zap), **Then** everything plays as before, including the countdown, results
   and the menu.

---

### User Story 2 - The owner changes a value in one place (Priority: P1)

The site owner renames a route, adds a track or kart style, adds a game, or changes a network
message, and edits exactly one definition; every page, menu and check that uses it follows.

**Why this priority**: it is what principle VIII requires, and it prevents copies drifting apart as
more games are added.

**Independent Test**: for each fixed set, search the source for its member values written out as
text; the only hits are the single definition (and data, such as saved settings, that must stay
readable).

**Acceptance Scenarios**:

1. **Given** the source, **When** the owner searches for any route path, game slug, race state,
   network message type, item kind, track name, kart style, control action, player mode or edit-tab
   label as a written-out value, **Then** it appears only in that set's one definition.
2. **Given** a set's definition, **When** a member is added or renamed there, **Then** the
   type-check flags every place that must handle it, and nothing else needs editing to keep the
   build passing.

---

### User Story 3 - No server details in the repo's docs and examples (Priority: P2)

Someone reading the public repo learns how hosting works but not the server's file locations,
addresses or users; those live only in the owner's private configuration.

**Why this priority**: the repo is public; principle VIII forbids environment details in docs.

**Independent Test**: search the README, `.env.example` and scripts for host paths, addresses and
user names; only placeholders remain.

**Acceptance Scenarios**:

1. **Given** the README and the deploy script's comments, **When** they describe hosting, **Then**
   they refer to "the web root", "the web server config" and the configuration keys, with no
   concrete server paths or addresses.
2. **Given** `.env.example`, **When** someone reads it, **Then** every value is a placeholder.

### Edge Cases

- Saved garage settings written before the change hold track and style names as text: they must
  still load (the stored values don't change).
- Network message type names are part of the online wire format: their text values must not
  change, so a future relay and older clients still understand each other.
- The browser's own values (for example the audio context's `running` state) are not ours to
  enumerate and are left as they are.
- Old addresses (`/index.html`, `/games/index.html`, paths without a trailing slash) must still
  resolve as before.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each of these fixed sets MUST have exactly one definition, and all code MUST use it
  instead of written-out values: site routes, game slugs, Turbo Tumble race states, network message
  types, item kinds, tracks, kart styles, control actions, player modes and garage edit tabs.
- **FR-002**: Values shown to players (menu labels, track and kart names) and stored in saved
  settings MUST stay exactly as they are today.
- **FR-003**: Network message type values MUST stay exactly as they are today.
- **FR-004**: Adding or renaming a member in a set's definition MUST be enough for the type-check
  to point at every place that needs updating.
- **FR-005**: Every route the site links to or matches MUST come from the routes definition,
  including the game route built from a game's slug.
- **FR-006**: The README, `.env.example` and script comments MUST NOT contain server file paths,
  addresses or user names; they use placeholders and describe locations by role.
- **FR-007**: The site and game MUST behave exactly as before (spec 001 requirements FR-001 to
  FR-018 still hold).
- **FR-008**: The existing unit tests MUST still pass, and any new pure helper introduced for a set
  (for example "is this a valid track") MUST have unit tests.

### Key Entities

- **Fixed set (enum)**: a named, closed list of allowed values (for example the four tracks), with
  one definition used everywhere.
- **Route**: a public address of a page; the game route is derived from the game's slug.
- **Network message type**: the kind of an online message; part of the wire format.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A search of the source (test files excluded) for each member value of the ten fixed
  sets finds it in only one definition (0 stray copies).
- **SC-002**: The spec 001 parity checks pass unchanged on the new build: 100% of pages, addresses,
  tracks, items and saved-settings cases behave as before.
- **SC-003**: Renaming one member of a set takes one edit, with the type-check reporting every
  other place to update.
- **SC-004**: The public docs and examples contain 0 concrete server paths, addresses or user names.

## Assumptions

- "Enum" means a const object plus its derived union type, per constitution v2.3.0 principle VIII
  (no `enum` keyword). The spec stays behaviour-level; the plan holds the code shape.
- The ten sets above are the full inventory found in the code on 2026-10-28; the description's six
  are extended with control actions, player modes and edit tabs because principle VIII covers every
  fixed set.
- One-off tuning numbers, colours and track point data inside the game stay where they are
  (principle VIII allows them as named constants or data tables in the game's folder).
- The live server keeps its current layout; only the repo's descriptions of it change. The owner's
  private `.env` keeps the real values.
- The unit/end-to-end test suites required by principle VII are a separate feature; this one only
  keeps the existing tests passing and tests any new helper.
