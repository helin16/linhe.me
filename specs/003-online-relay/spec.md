# Feature Specification: Online multiplayer for Turbo Tumble

**Feature Branch**: `master` (no feature branch)

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Online multiplayer for Turbo Tumble via a Node + TypeScript WebSocket relay on the VPS: game-agnostic relay served at linhe.me/relay/<game>/<room> behind Caddy, run as its own systemd service, per-game and per-room isolation, room codes players share to join, up to 4 players per room, message size and room size caps, no player data kept beyond live rooms; switch Turbo Tumble's online mode from the old EventSource/POST protocol to the relay (keep message types and host/peer behaviour), with a room code screen; offline modes unchanged and a clear message when the relay is unreachable; deploy and verify."

## Clarifications

### Session 2026-10-28

- Q: When a player creates a room, should the game also give them a link that joins the room in one tap, or only the room code to type? → A: Code plus a copyable join link; opening the link goes straight to the room's join step.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Race friends online with a room code (Priority: P1)

A player opens Turbo Tumble, chooses Online and creates a room. The game shows a short room code
and a join link they can copy. They send the link (or read out the code) to friends, who open the
link, or open the game, choose Online and enter the code, and join. Up to four people are in the room; the first player (the host) picks the track and
starts, and everyone races together, each driving their own kart, with the computer driving any
empty grid spots, exactly as online play worked before on the home network.

**Why this priority**: it is the feature: online play is unavailable today.

**Independent Test**: on two (then four) devices or browser windows on different networks, create a
room on one, join with the code on the others, start a race from the host and complete it; every
player sees all karts move, items (goo, zap) affect the right karts, and results match.

**Acceptance Scenarios**:

1. **Given** a player chooses Online, **When** they create a room, **Then** within 3 seconds they see
   a room code, a "Copy link" button for the room's join link, and "Online as P1 · 1/4 players", and
   they are the host.
2. **Given** a friend opens the join link, **When** the game loads, **Then** it goes straight to that
   room's join step (no typing), and one tap joins the room.
3. **Given** a room code, **When** another player enters it, **Then** within 3 seconds both see 2/4
   players, the joiner sees "The host picks the track and starts", and each sees the other's
   garage look (name, colours, kart style).
4. **Given** a full room (4 players), **When** a fifth player enters the code, **Then** they see "That
   room is full" and stay in the menu with offline modes usable.
5. **Given** the host starts a race, **When** it runs, **Then** all players start together on the
   host's track, each controls only their own kart, remote karts move smoothly, the host's computer
   drives the AI karts, and goo puddles, zaps and finishing order are the same on every screen.
6. **Given** a race in progress, **When** a player closes their tab, **Then** within 5 seconds the
   others see one fewer player and the race continues; if the host left, the next player becomes
   host.

---

### User Story 2 - Rooms and games stay separate (Priority: P1)

Two groups play at the same time in different rooms, and a future second game uses the same relay;
nobody ever sees or affects another room's or game's players.

**Why this priority**: a public relay without isolation would let strangers interfere (constitution V).

**Independent Test**: run two rooms at once (and a test client claiming a different game); verify no
messages cross between them.

**Acceptance Scenarios**:

1. **Given** rooms A and B, **When** players race in both, **Then** no player in A ever sees a kart,
   puddle, zap, join or leave from B, and vice versa.
2. **Given** a client connected for another game with the same room code, **When** it sends
   messages, **Then** Turbo Tumble players in that code's room receive none of them.
3. **Given** a code that no one has created, **When** a player enters it, **Then** they see "No room
   with that code" and nothing is created by guessing.

---

### User Story 3 - The game handles a missing or failing relay (Priority: P2)

If the relay is down, slow or the player is offline, choosing Online shows a clear message, and
1-player and 2-player modes keep working.

**Why this priority**: constitution III (playable without a server).

**Independent Test**: stop the relay; choose Online; start a 1P race. Restart it mid-race; check
what players see.

**Acceptance Scenarios**:

1. **Given** the relay is unreachable, **When** a player chooses Online, **Then** within 5 seconds
   they see "Online play isn't available right now" and can pick 1 or 2 players and race.
2. **Given** a player is in a room, **When** their connection drops, **Then** they see "Disconnected
   from the room" and are returned to the menu with offline modes usable.

---

### User Story 4 - The relay is safe to run in public (Priority: P2)

The site owner runs the relay on the server alongside the site; it limits abuse, keeps nothing about
players after a room empties, restarts itself if it crashes, and deploys with the site.

**Why this priority**: constitution V and the hosting rules.

**Independent Test**: send oversized and flood messages and too many connections from one address;
crash the relay process; check logs and data after rooms empty; run the deploy and its checks.

**Acceptance Scenarios**:

1. **Given** a client sends a message over the size limit, **When** the relay receives it, **Then**
   the message is dropped and that client is disconnected; other players are unaffected.
2. **Given** a client floods messages beyond the rate limit, **When** the limit is exceeded, **Then**
   the client is disconnected.
3. **Given** the relay process crashes, **When** 10 seconds pass, **Then** it is running again and
   new rooms can be created (existing rooms are lost and their players see "Disconnected").
4. **Given** every player leaves a room, **When** the room empties, **Then** nothing about the room or
   its players (codes, names, looks, messages) remains in memory, on disk or in logs beyond a
   connection count.
5. **Given** the owner runs the deploy, **When** it finishes, **Then** the site and the relay are both
   updated and the deploy's own check confirms the relay answers.

### Edge Cases

- A join link for a room that has emptied, is full or doesn't exist shows the same messages as typing
  the code ("No room with that code", "That room is full") and leaves the player in the menu.
- Opening a join link while the relay is down shows "Online play isn't available right now"; the
  game is still playable offline.
- Room codes are case-insensitive and ignore spaces; letters that look alike (0/O, 1/I/L) are not
  used.
- A player who opens two tabs counts as two players.
- The host leaves before starting: the next player becomes host and can start.
- A player joins while a race is running: they wait in the menu until the next race (as before).
- Garage names are limited to 10 characters and shown as plain text everywhere (no markup).
- The relay restarts mid-race: everyone sees "Disconnected" and can create a new room.
- Very slow connections: remote karts keep gliding toward their last known position (as before).
- Malformed or unknown messages are ignored by the game and never crash it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Choosing Online MUST offer "Create room" and "Join with code"; creating MUST give a
  short room code and a copyable join link; joining MUST accept that code, and opening the join link
  MUST take the player straight to that room's join step.
- **FR-002**: A room MUST hold at most 4 players, in fixed grid slots 1–4; the lowest occupied slot
  is the host.
- **FR-003**: The online race MUST behave as the old online mode did: host picks the track and
  starts, each player drives their own kart, the host drives AI karts, and the same message kinds
  (join, leave, profile, start, kart state, goo, pop, zap) keep their meaning.
- **FR-004**: Messages MUST only reach other players in the same game and room.
- **FR-005**: Joining a code that doesn't exist or a full room MUST fail with a clear message and
  create nothing.
- **FR-006**: The relay MUST enforce a per-message size limit, a per-client message rate limit, a
  per-address connection limit and the room size limit, disconnecting clients that break them.
- **FR-007**: The relay MUST keep player data only in memory while the room is live, and MUST NOT
  write names, looks, codes or messages to disk or logs.
- **FR-008**: If the relay is unreachable or the connection drops, the game MUST show a clear message
  within 5 seconds and keep 1P/2P modes fully usable.
- **FR-009**: The relay MUST serve any game by name, with no Turbo Tumble-specific logic.
- **FR-010**: The relay MUST run as its own service on the server, restart automatically on failure,
  and be reachable only through the site's address (`/relay/…`) with encrypted connections.
- **FR-011**: The game MUST find the relay through one configurable address (same site by default).
- **FR-012**: The deploy MUST update both the site and the relay and verify the relay answers.
- **FR-013**: The old home-network relay protocol MUST be removed from the game.

### Key Entities

- **Room**: a live group for one game, identified by game name + room code; holds up to 4 player
  slots; exists only while at least one player is connected.
- **Player slot**: a numbered seat (1–4) in a room for one connection; the lowest is the host.
- **Room code**: a short, easy-to-type code that identifies a room within a game.
- **Join link**: the game's public address plus the room code; opening it starts joining that room.
- **Message**: a game-defined payload the relay forwards to the other players in the room.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Two players on different networks go from opening the game to racing together in under
  60 seconds using a room code, and in under 30 seconds using the join link.
- **SC-002**: A 4-player online race completes with every player seeing the same finishing order.
- **SC-003**: In a test with two rooms running at once, 0 messages cross between rooms or games.
- **SC-004**: Remote karts update at least 15 times a second for players with a typical home
  connection, with no visible stutter.
- **SC-005**: With the relay stopped, choosing Online shows the "not available" message within 5
  seconds in 100% of tries, and offline races still start.
- **SC-006**: After a relay crash, new rooms can be created within 10 seconds.
- **SC-007**: After all rooms empty, 0 player names, codes or messages remain on the server.

## Assumptions

- Technology is fixed by the constitution (v2.3.0): Node + TypeScript relay over WebSockets, a
  `systemd` service behind Caddy, room codes required, message and room caps, no stored player data,
  relay address configurable and same-origin by default, unit and end-to-end tests for the relay.
- Rooms are created by the first player (who gets the code) rather than by typing any code; this
  stops guessed codes from creating rooms and gives FR-005 its meaning.
- Room codes are 4 characters from an unambiguous alphabet (about 600,000 combinations), enough for a
  family site; codes are freed when a room empties.
- Limits (initial values, tunable in configuration): 8 KB per message, 40 messages a second per
  client, 8 connections per address, 4 players per room.
- Late joiners wait for the next race, and remote karts glide to their last reported position, as in
  the old online mode; no new netcode (prediction, rollback) is in scope.
- The relay needs no accounts or sign-in; anyone with a code can join that room.
- The constitution VII test gate applies to the relay (its isolation tests are required by V). The
  existing waiver for the whole-site e2e suite (features 001/002) is unchanged.
