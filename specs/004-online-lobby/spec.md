# Feature Specification: Online lobby for Turbo Tumble

**Feature Branch**: `master` (no feature branch)

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Turbo Tumble online lobby: pressing Online offers \"Host a room\" (host types a room name, unique among waiting rooms of that game) or a popup listing the rooms still waiting to start, each with its name and player count (n/4), updating live; picking one joins it. Once in the room the host sees a 60-second countdown, a Start button to begin early, and a Cancel button that closes the room and returns everyone to the menu; when the countdown reaches zero the race starts with whoever has joined (computer karts fill empty spots). Guests see the countdown and a Leave button. Rooms leave the list once their race starts, when full, or when closed. Join links and room codes from feature 003 keep working. Room names are short and limited to safe characters; nothing is kept after a room closes."

## Clarifications

### Session 2026-10-28

- Q: Anyone who opens the game sees every waiting room's name; should the game filter rude words out of room names? → A: No typed names: the game gives each room an auto-generated name.
- Q: If the host closes the tab or loses connection before the race starts, what should happen to the guests already waiting? → A: The next player becomes host; the room keeps its name and the countdown keeps running.
- Q: When a race finishes, what should happen to the room and the players in it? → A: The room returns to waiting with a fresh 60-second countdown and reappears in the list if it has free spots.
- Owner addition: the host chooses the room size, 4 to 12 players; computer karts fill the remaining spots.
- Q: Should the 1-player and 2-player offline races also let you choose 4 to 12 karts, or stay at 4? → A: Offline stays at 4 karts; only online rooms can have 4–12.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Host a room with a size and a countdown (Priority: P1)

A player presses Online, chooses "Host a room" and picks how many players the room holds, from 4
to 12 (4 unless changed). The game gives the room a generated name (for
example "Turbo Otter") and they are now the host of a waiting room. They see the room name, the players who have joined (n/size, for example 1/8), a countdown
from 60 seconds, a Start button and a Cancel button. The race starts when they press Start or when
the countdown reaches zero, whichever comes first; empty grid spots are filled by computer karts.
Cancel closes the room and returns everyone in it to the Online popup.

**Why this priority**: Without a host flow there is nothing to join; it replaces "Create room".

**Independent Test**: One player hosts an 8-player room, waits; at 0 the race starts with 7 computer karts.
Again: host presses Start at 45 s; race starts at once. Again: host presses Cancel; the room is gone.

**Acceptance Scenarios**:

1. **Given** the menu, **When** a player chooses Online → Host a room with 8 players, **Then** they
   see the room's generated name (for example "Turbo Otter"), 1/8 players, a countdown starting at 60, Start and Cancel.
2. **Given** a waiting room, **When** the countdown reaches 0, **Then** the race starts for everyone
   in the room, with computer karts in empty spots.
3. **Given** a waiting room, **When** the host presses Start, **Then** the race starts at once for
   everyone.
4. **Given** a waiting room with guests, **When** the host presses Cancel, **Then** the room closes,
   every guest sees "The host closed the room" and is back in the Online popup.
5. **Given** a room named "Turbo Otter" exists, **When** another player hosts a room, **Then** the
   new room gets a different name.
6. **Given** a waiting room with guests, **When** the host's connection drops, **Then** the next
   player becomes host with Start and Cancel, and the countdown continues from where it was.
7. **Given** the host step, **When** the player picks the room size, **Then** only 4 to 12 can be
   chosen.

---

### User Story 2 - Browse and join a waiting room (Priority: P1)

A player presses Online and sees a popup listing the rooms waiting to start for this game: each
row shows the room name and players (n/size). The list updates on its own. Picking a room joins it;
the guest then sees the room name, the players, the same countdown as the host, and a Leave button.

**Why this priority**: Joining without having to be sent a code is the point of the request.

**Independent Test**: Two browsers: A hosts "Turbo Otter"; B opens Online and sees "Turbo Otter 1/8" within
2 seconds, picks it, and both see 2/8 and the same countdown (within 1 second of each other).

**Acceptance Scenarios**:

1. **Given** rooms "Turbo Otter" (1/8) and "Rocket Panda" (3/4) are waiting, **When** a player opens Online,
   **Then** both appear with their names and counts.
2. **Given** the popup is open, **When** a room is hosted, fills up, starts, or closes, **Then** the
   list shows the change within 2 seconds without reopening.
3. **Given** the list, **When** the player picks "Turbo Otter", **Then** they join it and see the
   countdown and a Leave button; the host and other guests see the count go up.
4. **Given** a guest in a waiting room, **When** they press Leave, **Then** they are back in the Online
   popup and the others see the count go down.
5. **Given** no rooms are waiting, **When** a player opens Online, **Then** the popup says so and
   still offers "Host a room".
6. **Given** a room started or filled just before the player picked it, **When** they pick it,
   **Then** they see a clear message and the list refreshes.

---

### User Story 3 - Links and codes still work (Priority: P2)

Join links and room codes from feature 003 keep working: the waiting room shows its code and a
Copy link button, and opening a link joins that room while it is waiting.

**Why this priority**: Friends may still prefer to send a link; nothing that works today should break.

**Independent Test**: Host copies the link; a second browser opens it and lands in the room.

**Acceptance Scenarios**:

1. **Given** a waiting room, **When** a guest opens its join link, **Then** they join it.
2. **Given** a room whose race has started, **When** someone opens its link, **Then** they see that
   the race has already started.

---

### Edge Cases

- The host closes the tab or loses connection while waiting: the next player (lowest slot) becomes
  host and gets Start and Cancel; the room keeps its name and the countdown keeps running. If no
  one is left, the room closes.
- A guest drops while waiting: they are removed and the count goes down.
- The room fills (for example 8/8) during the countdown: it leaves the list; the countdown continues (the host
  can still press Start).
- After a race ends, the room returns to waiting with a fresh 60-second countdown and reappears in
  the list if it has free spots.
- During a race, a dropped host is replaced as before (feature 003).
- Two players host at the same moment: their rooms get different names.
- The relay is unreachable: Online shows the feature 003 message and 1P/2P still work.
- Very many waiting rooms: the list shows them all, scrolling, newest first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Choosing Online MUST open a popup offering "Host a room" and listing the game's
  waiting rooms (name and players as n/size), newest first.
- **FR-002**: Hosting MUST give the room a generated two-word name (adjective + animal, for example
  "Turbo Otter") from fixed word lists, unique among the game's open rooms; players MUST NOT be able
  to type or change room names.
- **FR-003**: The room list MUST update within 2 seconds when a room is hosted, changes player
  count, fills, starts or closes.
- **FR-004**: A room MUST appear in the list only while it is waiting to start and has a free spot.
- **FR-005**: A waiting room MUST show everyone the room name, players (n/size) and the same countdown
  from 60 seconds (within 1 second between players).
- **FR-006**: The host MUST see Start and Cancel; guests MUST see Leave.
- **FR-007**: The race MUST start for everyone when the host presses Start or when the countdown
  reaches 0, with computer karts filling the room's remaining spots, so the race always has as many
  karts as the room size.
- **FR-008**: Cancel MUST close the room and return every guest to the Online popup with a clear message.
  If the host disconnects while waiting, the next player MUST become host with the countdown
  unchanged.
- **FR-009**: Joining a room that is full, racing or closed MUST fail with a clear message.
- **FR-010**: Room codes and join links (feature 003) MUST keep working for waiting rooms.
- **FR-011**: When a race ends, the room MUST return to waiting with a fresh 60-second countdown,
  keeping its players, and MUST reappear in the list if it has a free spot.
- **FR-012**: Room names MUST be kept only while the room exists and MUST NOT be written to disk or
  logs.
- **FR-013**: The relay MUST stay game-agnostic: room names, waiting/racing state and the list are
  generic room features any game can use.
- **FR-014**: The relay MUST keep the limits of feature 003 and limit how often the list can be
  requested or watched.
- **FR-015**: Hosting MUST let the host choose the room size, 4 to 12 players (default 4); it
  cannot change after the room is made. Players joining by code or join link get the same size limit.

### Key Entities

- **Room** (extends 003): adds a generated **name** (unique per game), a **size** (4–12, chosen by the host) and a **state**:
  waiting or racing.
- **Room list**: for one game, the name, code and player count of each waiting room with a free spot.
- **Countdown**: 60 seconds from when the room starts waiting; the same deadline for every player.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player can host a room in under 5 seconds from pressing Online.
- **SC-002**: A second player can find and join that room from the list in under 10 seconds.
- **SC-003**: List changes appear for watchers within 2 seconds.
- **SC-004**: Countdowns shown to players in the same room differ by at most 1 second.
- **SC-005**: With no Start pressed, the race begins within 1 second of the countdown reaching 0.
- **SC-006**: After the host cancels, every guest is back in the Online popup within 2 seconds.
- **SC-007**: Nothing about a room (name, code, players) remains on the server after it closes.
- **SC-008**: In a 12-kart race every player sees the other karts move smoothly, at least 10 updates
  a second, on the devices the game supports today.

## Assumptions

- Generated names come from fixed, family-friendly word lists, so no filtering is needed; there is
  no button to pick a different name.
- Host hand-over works the same while waiting and during a race: the lowest remaining slot is host.
- The host picks the track before or during the countdown, as today.
- The countdown starts from 60 seconds when the room is created and again after each race.
- No accounts: anyone who can open the site can see the list of waiting rooms and join one.
- Feature 003's 4-player room limit becomes a per-room size of 4–12; the track, starting grid and
  computer karts must handle up to 12 karts.
- Only the host's browser starts the race at 0; if the host's tab is in the background the browser
  may delay that by a moment (accepted; within 60 s this is rare).
- 1P/2P offline modes are unchanged and keep 4 karts; the 4–12 choice is for online rooms only.
