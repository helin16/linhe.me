# Feature Specification: Snake Duel — an arena snake game for 1–2 players, local and online

**Feature Branch**: `master` (no feature branch)

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "can we build another game like snake, which can be 2 players local and online too"; added: "same style like https://snake.io"; added: "like Turbo Tumble, we need to allow user to customise their snake"; added: "need to have the same way like Turbo Tumble for online lobby"

## Style

An original game in the arena-snake genre that snake.io belongs to, not a copy of it: its own
name, look, art and rules. Snakes glide smoothly in any direction (no grid) around a large arena
that scrolls with the player's snake; glowing orbs are scattered everywhere; computer snakes roam
the arena too. Nothing (name, logo, graphics, sounds, text) is taken from snake.io.

## Clarifications

### Session 2026-10-28

- Q: Should online Snake Duel rooms be for exactly 2 players, or for more people at once? → A: The host picks 2 to 8 players; the last player left in wins the round; first to 3 round wins takes the match.
- Q: What should the game be called on the site? → A: Snake Duel (address `/games/snake-duel/`).
- Q: How many computer snakes should share the arena with the players? → A: Computer snakes top the arena up to 20 snakes in total, all players and computer snakes in the same arena.
- Q: Should a round in 2 Players or Online have a time limit? → A: Two match types: Deathmatch (no time limit; a round ends when only one player is left, who wins it; first to 3 round wins) and Quick match (a single 5-minute game; players who go out rejoin after a few seconds; when time runs out the longest player still in wins; equal lengths = draw).
- Q: Should players be able to choose how tough the computer snakes are? → A: Easy, Normal or Hard (Normal by default), picked in the garage; online the host picks it in the waiting room. Easy snakes turn slowly and rarely boost; Hard ones hunt players and cut them off.
- Q: Should 1 Player also offer the two match types? → A: No: 1 Player stays "play until you're out, beat your best length", with one best length; match types are for 2 Players and Online only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play solo in the arena (Priority: P1)

A visitor opens Snake Duel and plays alone in an arena with computer snakes. Their snake follows
the direction they steer; eating orbs makes it longer. Holding boost makes it faster but slowly
shrinks it. If its head touches another snake's body or the arena's edge, it's out: its body
breaks into orbs others can eat. Their length is their score; the best on this device is kept.

**Why this priority**: The core game loop; every other mode is built on it.

**Independent Test**: Choose 1 Player: the snake moves and turns; eat orbs and the length goes up;
hit a computer snake's body: "You're out", the final length and "Play again".

**Acceptance Scenarios**:

1. **Given** the game page, **When** a player starts 1 Player, **Then** their snake appears in the
   arena with orbs around and computer snakes moving, and the view follows their snake.
2. **Given** a running game, **When** the snake's head passes over an orb, **Then** the orb
   disappears and the snake grows; the length shown goes up.
3. **Given** a running game, **When** the player holds boost, **Then** the snake moves faster, gets
   slightly shorter over time and leaves small orbs behind; boost stops at the minimum length.
4. **Given** a running game, **When** the head touches another snake's body or the arena edge,
   **Then** the snake is out, its body turns into orbs, and the game shows the final length and
   "Play again". Touching its own body does not hurt.
5. **Given** a computer snake's head touches the player's body, **When** that happens, **Then** the
   computer snake is out and leaves orbs.
6. **Given** a final length above the device's best, **When** the game ends, **Then** the new best
   is shown and kept after reloading.
7. **Given** a desktop, **When** playing, **Then** the snake turns toward the mouse pointer (click
   or Space to boost), or left/right keys turn it (Up or Space to boost); **Given** a touch screen,
   **Then** an on-screen stick steers and a button boosts.

---

### User Story 2 - Two players on one device (Priority: P1)

Two people share one keyboard or one tablet, with a split screen (one half per player, as in Turbo
Tumble 2P), in the same arena with computer snakes. Before starting they pick the match type:
**Deathmatch** — a round ends when one of the two players is out and the other wins it (both out
at the same moment = draw), first to 3 round wins takes the match, no time limit; or **Quick
match** — one 5-minute game where a player who goes out rejoins after a few seconds, and when time
runs out the longer snake wins.

**Why this priority**: Explicitly requested; the head-to-head draw of the game.

**Independent Test**: Choose 2 Players: player 1 turns with A/D (W to boost), player 2 with ←/→
(↑ to boost); player 2 runs into player 1's body: player 1 wins the round, round score 1–0.

**Acceptance Scenarios**:

1. **Given** 2 Players, **When** the round starts, **Then** both snakes appear far apart, each half
   of the screen follows its own snake, after a 3-2-1 countdown.
2. **Given** a round, **When** player 2's head touches player 1's body, **Then** player 1 wins it.
3. **Given** a round, **When** a player is taken out by a computer snake or the edge, **Then** the
   other player wins the round.
4. **Given** both players go out on the same moment (including head to head), **Then** it's a draw.
5. **Given** Deathmatch and a player with 3 round wins, **When** that round ends, **Then** the match
   result shows with "Play again".
6. **Given** Quick match, **When** it starts, **Then** a 5:00 timer counts down on screen; **when**
   a player goes out, **then** they rejoin at the starting length after 3 seconds; **when** the
   timer reaches 0, **then** the longer player still in wins (equal lengths, or both out, = draw).
7. **Given** a tablet, **When** 2 Players runs, **Then** each player has a stick and a boost button
   on their own half of the screen.

---

### User Story 3 - Play online, 2 to 8 players (Priority: P1)

Two to eight people on different devices play the same match online, in the same arena with the
same computer snakes. They meet the way Turbo Tumble players do: choose Online, see waiting rooms,
host one (picking how many players it holds, 2 to 8; it gets a generated name) or join from the
list, a code or a link. The waiting room works exactly like Turbo Tumble's: everyone sees the room
name, n/size, who has joined with their snake's colour, and a 60-second countdown; the host can
Start early or Cancel, guests can Leave; at 0 the match starts with whoever has joined. Each player
sees the arena from their own snake. The host picks the match type in the waiting room
(Deathmatch or Quick match, shown to everyone); Deathmatch: the last player left in wins the round,
first to 3 round wins takes the match; Quick match: 5 minutes, out players rejoin, the longest
player still in at the end wins. Then the room waits again with a fresh countdown.

**Why this priority**: Explicitly requested; reuses the site's online play.

**Independent Test**: Three browsers: A hosts a room of 4, B and C join from the list, A starts;
each steers their own snake; B and C are taken out; every screen shows A winning the round.

**Acceptance Scenarios**:

1. **Given** Online, **When** the popup opens, **Then** it lists waiting Snake Duel rooms only
   (never Turbo Tumble rooms) and offers "Host a room".
2. **Given** a hosted room, **When** players join, **Then** everyone sees the room name, n/size,
   each player's number, name and snake colour (host and "you" marked) and the same 60-second
   countdown; the host sees Start and Cancel, guests see Leave. The host picks the room size
   (2 to 8, default 2) when hosting.
   **When** the host presses Start or the countdown reaches 0, **Then** the match starts for
   everyone; **when** the host presses Cancel, **Then** everyone is back in the Online popup with
   "The host closed the room"; if the host drops while waiting, the next player becomes host and
   the countdown carries on.
3. **Given** players in a room and Start, **When** the round begins, **Then** everyone sees the
   same arena: same orbs, same computer snakes, every player's snake.
4. **Given** an online match, **When** a snake is taken out or eats, **Then** every screen agrees on
   it and on the winner: in Deathmatch, when only one player is left in, every screen shows them
   winning the round (last players out at the same moment = draw); in Quick match, every screen
   shows the same timer and, at 0, the same winner.
5. **Given** a full room, **When** another player tries to join, **Then** they're told it's full.
6. **Given** a match, **When** a player leaves or drops, **Then** their snake is taken out and the
   match goes on; if only one player is left in the room, they win the match and see "Everyone
   else left", with a way back to the room list.
7. **Given** a player who is out, **When** the round goes on, **Then** they watch the rest of the
   round (following the leader) until it ends.
8. **Given** the relay can't be reached, **When** Online is picked, **Then** a clear message shows
   within 5 seconds and 1 Player and 2 Players still work.

---

### User Story 5 - Customise your snake (Priority: P1)

Before playing, a player opens the snake garage (like Turbo Tumble's) and picks their snake's
name, main colour, accent colour, body pattern and eyes, seeing a live preview of their snake. In
2 Players there's a tab for each player. The choices are remembered on this device and other
players see them online.

**Why this priority**: Asked for by the owner; players want their own snake, and it tells snakes
apart in a crowded arena.

**Independent Test**: Open the garage, pick a colour, the Stripes pattern and Angry eyes: the
preview changes at once; reload: the same choices are back; start a game: the snake looks the same.

**Acceptance Scenarios**:

1. **Given** the garage, **When** the player changes name, main colour, accent colour, pattern or
   eyes, **Then** the preview updates immediately.
2. **Given** saved choices, **When** the page reloads, **Then** the garage and the game show them.
3. **Given** 2 Players, **When** the garage is open, **Then** a Player 1 / Player 2 tab picks whose
   snake is being edited; if both pick the same main colour, player 2's is changed and they're told.
4. **Given** an online room, **When** a player changes their snake in the garage, **Then** the
   other players see the new look on their snake and in the room's player list within 2 seconds.
5. **Given** a name with characters like `<`, **When** it's shown anywhere, **Then** it shows as
   typed (text, never markup).

---

### User Story 4 - Find the game on the site (Priority: P2)

The home page and games page list Snake Duel next to Turbo Tumble.

**Independent Test**: The home page shows a Snake Duel card that opens the game.

**Acceptance Scenarios**:

1. **Given** the home page, **When** it loads, **Then** a Snake Duel card shows the tag
   "1–2 players · Online up to 8 · iPad ready" and opens the game.
2. **Given** the games page, **When** it loads, **Then** Snake Duel is listed with its description.

---

### Edge Cases

- A snake can't shrink below its starting length by boosting.
- Orbs keep being topped up so the arena never runs out; computer snakes that go out are replaced
  after a moment so the arena stays lively.
- A snake's head touching its own body is harmless (as in the genre); only other snakes' bodies,
  and the edge, take it out.
- Hidden tab: offline the game pauses and resumes. Online, if the player whose device runs the
  arena hides the tab, the next player takes over running it at once and the match goes on from
  the latest arena state; a hidden guest's snake keeps going straight.
- Blank names show "Player 1" / "Player 2"; names are shown as text, never markup.
- Resize or rotate: the view adapts with no scrolling; split screen stacks top/bottom in portrait.
- Online, a brief network hiccup doesn't end the match; a disconnect takes that player out (US3
  scenario 6).
- Online, nobody can join while a match is being played (as with a Turbo Tumble race); they can
  join while the room waits between matches.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST offer 1 Player, 2 Players and Online and be listed on the home page and
  games page.
- **FR-002**: Snakes MUST move smoothly and continuously and turn toward the steering direction at
  a limited turn rate; the view MUST follow the player's snake around an arena larger than the
  screen, with a small map showing where they are.
- **FR-003**: Eating orbs MUST lengthen the snake; length is the score.
- **FR-004**: Boost MUST make the snake faster while slowly shrinking it (dropping small orbs), and
  MUST stop at the starting length.
- **FR-005**: A snake MUST be out when its head touches another snake's body or the arena edge; an
  out snake's body MUST turn into orbs. A snake's own body MUST NOT take it out.
- **FR-006**: The arena MUST hold 20 snakes: every player plus computer snakes filling the rest
  (19 in 1 Player, 18 in 2 Players, 20 minus the room's players online), all in the same arena.
  Computer snakes eat, grow and can be taken out, and are replaced after a short time.
- **FR-016**: Computer snakes MUST play at a chosen difficulty: Easy (turn slowly, rarely boost,
  avoid players), Normal (default) or Hard (hunt players: boost to cut across a player's path).
  It is picked in the garage for 1 Player and 2 Players and by the host in the waiting room online
  (shown to everyone), and remembered on this device.
- **FR-007**: 1 Player MUST be one endless game (until the player is out) and remember the best
  length on this device; match types (FR-008) don't apply to it.
- **FR-008**: 2 Players and Online MUST offer two match types, picked before the match (locally in
  the garage, online by the host in the waiting room): **Deathmatch** — no time limit; a round ends
  when only one player (not counting computer snakes) is left in, who wins it; the last players out
  at the same moment = draw; first to 3 round wins takes the match. **Quick match** — one 5-minute
  game with an on-screen timer; a player who goes out rejoins at the starting length after 3
  seconds; at 0 the longest player still in wins; equal lengths or nobody in = draw.
- **FR-009**: Controls: mouse (point to steer, click to boost) and keys (1P: ←/→ or A/D to turn,
  ↑/W/Space to boost; 2P: A/D + W for player 1, ←/→ + ↑ for player 2); touch: a stick and a boost
  button per player.
- **FR-010**: Online MUST work the same way as Turbo Tumble's: the Online popup with the live room
  list, Host a room (size 2 to 8 here), join by list, code or link; the waiting room with room name,
  n/size, the player list (number, colour, name, host, you), a 60-second countdown, Start/Cancel
  for the host and Leave for guests, host hand-over, and the room waiting again with a fresh
  countdown after each match. Snake Duel rooms never mix with other games' rooms.
- **FR-011**: Online, both devices MUST agree on orbs, computer snakes, take-outs and results.
- **FR-012**: Online, a player who leaves or drops MUST be taken out of the round; when only one
  player remains in the room, they MUST win the match. When the device running the arena leaves,
  drops or hides its tab, the next player MUST take over running it without stopping the match.
- **FR-013**: When online play isn't available the game MUST say so within 5 seconds and keep
  1 Player and 2 Players usable.
- **FR-014**: A garage MUST let each player set their snake's name (up to 10 characters), main
  colour, accent colour, body pattern (Solid, Stripes, Spots, Two-tone) and eyes (Round, Sleepy,
  Angry, Starry), with a live preview; choices are remembered on this device; on one device the two
  players' main colours MUST differ; online, each player's look is shown to everyone, with name
  labels over their snakes.
- **FR-015**: The game's name, look, art and sounds MUST be original (not taken from snake.io or
  any other game).

### Key Entities

- **Arena**: its size, the orbs in it, and the snakes in it.
- **Snake**: owner (player 1, player 2, or computer), body path from head to tail, heading, speed,
  boosting or not, length, colour, name, in or out.
- **Orb**: position, size (how much length it gives), colour.
- **Match**: type (Deathmatch or Quick match); Deathmatch: round wins per player (first to 3), the
  current round, who is still in; Quick match: time left (5:00 at the start), rejoin timers.
- **Room (online)**: size 2–8 chosen by the host, its players.
- **Snake look**: name, main colour, accent colour, pattern, eyes.
- **Difficulty**: Easy, Normal or Hard, for the computer snakes in a game.
- **Settings (per device)**: a snake look for players 1 and 2, difficulty, match type, best solo
  length, sound on/off.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can start a 1 Player game within 10 seconds of opening the page.
- **SC-002**: Steering responds within one frame of input; movement looks smooth (no visible
  stutter) with 20 snakes in the arena on the devices Turbo Tumble supports.
- **SC-003**: Online, every player in the room sees the same winner in 100% of rounds and quick
  matches, and Quick match timers differ by at most 1 second between players.
- **SC-004**: Online, other players' snakes show where they really are within half a second on a
  normal home connection, with 8 players in the room.
- **SC-005**: When online play fails, 1 Player and 2 Players still work every time.

## Assumptions

- "Same style like snake.io" means the arena-snake genre (smooth movement, big scrolling arena,
  orbs, boost, computer snakes), built as an original game named Snake Duel (Q2).
- Solo play (1 Player) is included because it's the basic game, even though 2-player modes were
  what was asked for.
- The arena always holds 20 snakes (Q3): players plus computer snakes; online the device running
  the arena (first the host) runs the computer snakes.
- Online rooms hold 2 to 8 players (clarification Q1; default 2, the duel asked for) and use
  Turbo Tumble's lobby as is, including the 60-second countdown.
- If the countdown runs out with only the host in the room, the match plays like 1 Player against
  the computer snakes (the round ends when the host is out), then the room waits again.
- Drawn in 2D from above; no 3D.
- Sound is simple and can be muted. No accounts and no online leaderboard.
- Opening the game with `?seed=<number>` fixes where orbs and computer snakes start in 1 Player and
  2 Players, so a game can be replayed and tested exactly; it is ignored online and changes nothing
  else. `?bots=0` (also offline only) keeps computer snakes still, for practice and tests.
