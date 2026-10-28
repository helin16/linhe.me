# Feature Specification: Live standings and room roster for Turbo Tumble

**Feature Branch**: `master` (no feature branch)

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "can we display a panel to show the rank during the race, and for both guests and host, in the lobby, can we display who joined and which colour"; added: "as per screenshot, we need to say this game is for online" (the home page card)

## Clarifications

### Session 2026-10-28

- Q: On a phone, should the standings panel during a race list every kart (up to 12), or only the top 3 plus your own position? → A: Phones show the top 3 plus each local player's row; bigger screens show every kart.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the standings while racing (Priority: P1)

During a race, a panel shows the current order of every kart: position, a dot in the kart's
colour, and the racer's name, with the player's own kart (or both local players' karts in 2P)
highlighted. The order updates as karts overtake each other, and finished karts show their time.

**Why this priority**: With up to 12 karts online, the single "3rd" number no longer tells a
player who they are chasing or who is behind them.

**Independent Test**: Start a 1-player race: the panel lists 4 karts with positions 1–4; overtake a
computer kart and see the order change within a second.

**Acceptance Scenarios**:

1. **Given** a race of N karts (4 offline, 4–12 online), **When** it starts, **Then** the panel lists
   all N karts with position, colour dot and name, in race order.
2. **Given** the race is running, **When** one kart passes another, **Then** the panel shows the new
   order within 1 second.
3. **Given** a local player's kart, **When** the panel shows it, **Then** that row stands out
   (highlighted) from the others; in 2P both local players' rows stand out.
4. **Given** a kart has finished, **When** the panel shows it, **Then** its row shows its finish time.
5. **Given** an online race, **When** the panel shows other players' karts, **Then** they appear
   with the names and colours those players chose; computer karts show their own names.
6. **Given** a phone-sized screen, **When** the race runs, **Then** the panel shows the top 3 and
   each local player's row (no other rows), without covering the steering or action controls; on
   larger screens it shows every kart.

---

### User Story 2 - See who is in the waiting room, and their colours (Priority: P1)

In an online room, before the race, host and guests both see a list of everyone who has joined:
player number, a swatch of their kart colour, their name, and which one is the host. The list
changes as players join, leave, or change their name or kart colour in the garage.

**Why this priority**: Players want to know who they are about to race and tell karts apart on
the track by colour.

**Independent Test**: Two browsers: A hosts, B joins; both see "P1 <A's name> (host)" and "P2 <B's
name>" with the right colour swatches; B changes kart colour and A's list updates.

**Acceptance Scenarios**:

1. **Given** a waiting room, **When** a player joins, **Then** every player's list shows the newcomer
   (number, colour swatch, name) within 2 seconds.
2. **Given** a waiting room, **When** a player leaves, **Then** they disappear from everyone's list
   within 2 seconds.
3. **Given** a waiting room, **When** a player changes their name or kart colour, **Then** everyone's
   list shows the change within 2 seconds.
4. **Given** the list, **When** shown, **Then** the host is marked, and the viewer's own row is
   marked as "you".
5. **Given** a room with empty spots, **When** the list is shown, **Then** it says how many spots
   computer karts will fill (e.g. "+5 computer karts").

---

### User Story 3 - The site says the game can be played online (Priority: P2)

The Turbo Tumble card on the home page and the game's own listing say it can be played online,
not only by 1–2 players on one device.

**Why this priority**: Visitors can't tell online play exists; the card still reads
"1–2 players · iPad ready".

**Independent Test**: Open the home page: the Turbo Tumble card's tag mentions online play.

**Acceptance Scenarios**:

1. **Given** the home page, **When** it loads, **Then** the Turbo Tumble card's tag reads
   "1–2 players · Online up to 12 · iPad ready".
2. **Given** the game's listing text (short tag and description), **When** shown, **Then** it
   mentions racing friends online in rooms of up to 12, as well as split-screen.

---

### Edge Cases

- A player's name is blank: the list and panel show "Player N" (as the game already does).
- Two players pick the same colour: both rows show it; names tell them apart.
- A name contains characters like `<`: shown as typed, never treated as page markup.
- A player drops mid-race: their kart becomes a computer kart and stays in the standings under the
  same name and colour.
- Host hand-over in the waiting room: the "host" mark moves to the new host.
- 2P split screen: one shared standings panel, not one per half.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: During every race (1P, 2P and online) the game MUST show a standings panel listing
  each kart's position, colour and name in race order.
- **FR-002**: The panel MUST update within 1 second of any change in order.
- **FR-003**: Local players' rows MUST be highlighted; finished karts MUST show their finish time.
- **FR-004**: On phone-sized screens the panel MUST show exactly the top 3 plus each local player's
  row (when not already in the top 3), and MUST NOT cover the touch controls; larger screens MUST
  show every kart.
- **FR-005**: In an online waiting room, host and guests MUST see a roster of joined players with
  player number, kart colour swatch, name, a host mark and a "you" mark.
- **FR-006**: The roster MUST update within 2 seconds when players join, leave, or change name or
  kart colour.
- **FR-007**: The roster MUST state how many empty spots computer karts will fill.
- **FR-008**: Names MUST be shown as plain text everywhere.
- **FR-009**: The standings MUST use the same order the game already uses for positions and the
  results screen.
- **FR-010**: The home page card and the game's listing MUST say the game can be played online
  (rooms of up to 12), alongside 1–2 players on one device.

### Key Entities

- **Standing**: position, kart colour, name, whether it's a local player, finish time if finished.
- **Roster entry**: player number, kart colour, name, host or not, you or not.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every race the panel lists all karts (4 to 12) in the correct order.
- **SC-002**: Order changes appear in the panel within 1 second.
- **SC-003**: Roster changes (join, leave, name or colour) appear for everyone within 2 seconds.
- **SC-004**: On a phone in landscape, the panel never overlaps the steering or action buttons.
- **SC-005**: A visitor reading only the home page card can tell the game has online play.

## Assumptions

- The colour shown is the kart (body) colour players already pick in the garage; no new setting.
- Players' names and colours are already shared in online rooms (feature 003); nothing new is sent
  or stored.
- The existing big position number stays; the panel adds detail beside it.
- The results screen at the end of a race is unchanged.
