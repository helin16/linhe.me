# Feature Specification: Critter Hop — 3D star checkers for 2, 4 or 6 players, local and online

**Feature Branch**: `master` (no feature branch)

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "we need a new game using three.js: 1. it can be 2, 4, 6 player for the chess, 2. it can be online as well 3. it's Pokimon theme, the player will need to choos the type of pokiemons before start"

## Style

"Chess for 2, 4 or 6 players" is read as **star checkers** (often called Chinese checkers): a
six-pointed star board where each player starts in one point and races to move all their pieces
into the opposite point, stepping to a neighbouring hole or hopping over pieces. It is played on a
3D board that can be turned and zoomed.

The theme is an **original** monster-trainer style, in the spirit of Pokémon but not taken from
it: every piece is a cute creature, and before the game each player picks an **elemental type**
for their team (Fire, Water, Grass, Electric, Psychic or Rock). The type sets the team's colour,
its creatures' look and their hop effects. No Pokémon names, characters, art, logos, sounds or text
are used, because the site is public and those belong to their owners. The game is called
**Critter Hop** (address `/games/critter-hop/`).

## Clarifications

### Session 2026-11-19

- Q: Does the creature type change how the game plays? → A: Yes, through type advantages (option C).
  The six types form one ring, each strong against the next: Water → Fire → Grass → Rock →
  Electric → Psychic → Water. A creature may make a **long hop** over a creature it is strong
  against, and may **not** hop over a creature it is weak against (see FR-009).
- Q: What should the game be called on the site? → A: Critter Hop (address `/games/critter-hop/`).
- Q: Should every creature in a team look the same? → A: One creature per type (6 in total), and
  each team has one bigger "leader" piece; the leader looks different only and follows the same
  rules.
- Owner addition: with 4 players (people or computer), the board is a cross, not the star.
- Q: For the 4-player cross board, which way can creatures step and hop? → A: Square-grid cross,
  8 directions (straight and diagonal); each team starts at the end of one arm and races to the
  opposite arm.
- Q: Should players be able to choose how strong the computer players are? → A: Easy, Normal or
  Hard (Normal by default), picked on the setup screen; online the host picks it in the waiting
  room. It applies to every computer player in that game.
- Q: When a game stops making progress, should it end on its own, and when? → A: After 20 full
  rounds in a row in which no creature newly enters its target area; players still playing are
  ranked by creatures in their target, ties broken by total distance left (less is better).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pick a type and play against the computer (Priority: P1)

A visitor opens Critter Hop, chooses 1 Player and picks 2, 4 or 6 players in total (1 Player = one
Person seat, all others Computer). They pick
their creature type from the six types; computer players take the remaining types. The 3D board
appears with each team's ten creatures in its home area. On their turn the player selects one of
their creatures, the game highlights every hole it can reach (one step, or a chain of hops), and
the player picks one. Computer players then take their turns. The first player to fill their
target area with their creatures wins.

**Why this priority**: The core game: board, moves, turns, win, and the type pick the owner asked
for. Every other mode builds on it and it works with no server.

**Independent Test**: Choose 1 Player, 2 players, pick Fire: the board shows ten Fire creatures and
ten creatures of a computer-chosen type in opposite star points; select a creature, the reachable holes
light up, move it; the computer replies.

**Acceptance Scenarios**:

1. **Given** the menu, **When** a player chooses 1 Player, **Then** they choose the number of
   players (2, 4 or 6, 2 unless changed), the computer strength (Normal unless changed) and then
   their type; types already taken cannot be picked
   twice.
2. **Given** the type picker, **When** the player looks at a type, **Then** they see its name, its
   colour, its creature, and which type it is strong and weak against, so the six are easy to tell
   apart (not by colour alone).
3. **Given** 2 players, **When** the game starts, **Then** the star board is used and the two
   teams start in opposite points; **Given** 6 players, **Then** the star board is used with every
   point filled; **Given** 4 players (any mix of people and computer), **Then** the cross board is
   used and each team starts at the end of one arm, facing the opposite arm.
4. **Given** it is the player's turn, **When** they select one of their creatures, **Then** every
   hole it can legally reach this turn is highlighted, and selecting another creature or the same
   one again changes or clears the selection.
5. **Given** a selected creature, **When** the player picks a highlighted hole, **Then** the
   creature moves there along its path (step or each hop in turn) and the turn passes to the next
   player clockwise.
6. **Given** a Water creature with a Fire creature two holes away in a straight line with
   empty holes between and the same number of empty holes beyond, **When** the Water creature is
   selected, **Then** the hole beyond is highlighted as a long hop; **Given** a Water creature
   next to a Psychic creature (Psychic is strong against Water), **Then** hopping over it is
   not offered.
7. **Given** a creature, **When** the player picks a hole that is not highlighted, **Then** nothing
   moves and the turn is not used.
8. **Given** a player's last creature reaches their target area, **When** that happens, **Then** a
   banner names them and their place (1st, 2nd …) and play continues for the others; the end
   screen with the full finishing order, "Play again" and "Menu" shows once every place is decided,
   every Person has finished, the stall rule triggers, or a player chooses "End game".
9. **Given** a desktop, **When** playing, **Then** the board can be played with mouse clicks or
   with the keyboard alone (arrow keys move a cursor between their creatures and then between
   highlighted holes, Enter selects, Escape cancels, H shows a hint), and the camera can be turned
   and zoomed;
   **Given** a touch screen, **Then** tap selects and moves, drag turns the board and pinch zooms.

---

### User Story 2 - 2, 4 or 6 players on one device (Priority: P1)

Friends share one computer or tablet and take turns. They choose **2 Players** (the site's local
mode), then 2, 4 or 6 seats, each set to Person or Computer; each person in turn picks a type. The board turns so the current player's home point
faces them, and a banner shows whose turn it is in that type's name and colour.

**Why this priority**: Explicitly asked for (2, 4 and 6 players); the family-on-one-iPad case.

**Independent Test**: Choose 4 Players, pick four different types; play one move each; the turn
banner and board facing follow the clockwise order and come back to player 1.

**Acceptance Scenarios**:

1. **Given** the menu, **When** players choose a local game with 2, 4 or 6 players, **Then** each
   player picks a different type, one after another, before the board appears.
2. **Given** a local game, **When** a turn ends, **Then** the board turns to face the next player
   and the banner names them.
3. **Given** a local game, **When** some seats should be computer players, **Then** each seat can
   be set to Person or Computer before the game starts, as long as at least one seat is a Person,
   and the computer strength (Easy, Normal or Hard; Normal unless changed) is picked once for the
   game.
4. **Given** one player has finished, **When** others are still playing, **Then** the game carries
   on for the rest until every place is decided (or players choose "End game"), and shows the
   final order 1st, 2nd, 3rd ….

---

### User Story 3 - Play online in a room (Priority: P2)

A player presses Online and hosts or joins a room, the same way as the other games' online lobby:
the host picks the room size (2, 4 or 6 players), the room gets a generated name, it appears in
the list of waiting rooms, and a countdown runs with Start, Cancel and Leave. In the room each
player picks a type; a type taken by one player is shown as taken to everyone. When the game
starts, empty seats become computer players. Every player sees the same board and moves; only the
player whose turn it is can move.

**Why this priority**: Explicitly asked for, but the game is complete and playable without it.

**Independent Test**: Two browsers: A hosts a 4-player room and picks Water; B joins and sees Water
taken, picks Grass; A presses Start: both see the same board with Water, Grass and two computer
teams; a move made by A appears on B's screen.

**Acceptance Scenarios**:

1. **Given** the Online popup, **When** a player hosts a room, **Then** they choose 2, 4 or 6
   players and the room appears in other players' room list with its name and count (for example
   1/4); **Given** the waiting room, **When** the host changes the computer strength (Normal unless
   changed), **Then** everyone in the room sees it.
2. **Given** a waiting room, **When** a player picks a type, **Then** every player in the room sees
   that type taken within a second, and two players can never end up with the same type.
3. **Given** a waiting room, **When** the countdown ends or the host presses Start, **Then** the
   game starts for everyone with the same seats and types, and computer players fill empty seats;
   a player who hasn't picked a type yet gets a free one.
4. **Given** an online game, **When** a player makes a move, **Then** every other player sees the
   same move within a second, and the turn passes to the next seat for everyone.
5. **Given** an online game, **When** it is not a player's turn, **Then** they cannot move any
   creature, but can still turn and zoom the board.
6. **Given** an online game, **When** a player leaves or loses connection, **Then** the others are
   told and a computer player takes over that seat so the game can continue.
7. **Given** a game in one room, **When** moves are made, **Then** they never appear in another
   room or another game.
8. **Given** the relay is down or the room is full, **When** a player tries Online, **Then** they
   see a plain message and can still play 1 Player and local games.

---

### User Story 4 - Turn timer and hints (Priority: P3)

To keep online and big local games moving, each turn has a time limit (60 seconds by default,
shown as a countdown); when it runs out the turn is played for the player with a simple move. A
"Hint" button shows one good move for new players.

**Why this priority**: Quality of life; the game is complete without it.

**Independent Test**: In an online game, wait 60 seconds without moving: a move is made for the
player and the turn passes.

**Acceptance Scenarios**:

1. **Given** an online game, **When** the current player doesn't move within the time limit,
   **Then** a legal move is made for them and the turn passes.
2. **Given** a local game, **When** the players start it, **Then** the turn timer is off unless
   they turn it on.
3. **Given** it is a person's turn, **When** they press Hint, **Then** one of their creatures and
   a hole it can reach are highlighted; nothing moves until they choose. With a hint showing,
   Enter plays it.

---

### Edge Cases

- A creature has no legal move: it cannot be selected (it shows as unavailable). If no creature of
  a player can move, their turn is skipped with a short message.
- Two players pick types that are not next to each other on the ring (e.g. Water and Grass): their
  creatures hop over each other normally; the type picker shows each matchup so players can see
  this before starting.
- A creature is boxed in only by creatures it is weak against: it can still step into any empty
  neighbouring hole.
- A chain of hops returns to a hole already visited: the hop chain cannot loop forever; each hole
  is reached at most once per move.
- A player tries to park creatures in another player's home point forever to block them: the
  standard rule applies — a team that has filled every hole it can of its target area, with the
  rest taken by an opponent's creatures that never left, still wins.
- Two players finish on the same round: they finish in turn order (the one who moved first places
  higher).
- A game stalls (for example creatures blocking each other near their targets): after 20 full
  rounds in a row in which no creature newly enters its target area (counted once any creature
  has reached its target), the game ends. Players
  already finished keep their places; the rest are ranked by how many creatures are in their
  target, ties broken by total distance left (less is better). A round counter shows from round
  10 of a stall so players can see it coming.
- Online: the host leaves during the waiting countdown: the next player becomes host (as in the
  other games' lobby). The host leaves during the game: the game continues and a computer takes the
  host's seat.
- Online: every person leaves except one: the game continues for that player against computer
  players.
- Online: a player who dropped reopens the game mid-game: they are offered "Rejoin", get the board
  as it is now, and take their seat back from the computer.
- A late joiner opens a room link after the game started: they are told the game is in progress
  and are offered the Online popup.
- Window resized or phone rotated mid-game: the board refits the screen; no state is lost.
- Six teams on a small phone: holes and creatures stay tappable (zoom in when needed) and the
  highlighted holes stand out.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST be a new game on the site at its own address, listed with the others,
  with a 3D board the player can turn and zoom.
- **FR-002**: There MUST be two boards, and every team MUST have ten creatures:
  - **Star** (2 and 6 players): a six-pointed star with 121 holes; each point holds ten holes;
    each hole has up to 6 neighbours.
  - **Cross** (4 players): a square grid shaped like a plus sign: a 5 × 5 centre with four arms,
    each 5 holes wide and 4 deep (105 holes); each team's home is the outer 2 rows of one arm
    (10 holes); each hole has up to 8 neighbours (straight and diagonal). Exact arm size may be
    tuned in planning as long as each home holds ten.
- **FR-003**: Games MUST support 2, 4 or 6 players; 2 players use opposite star points, 6 use
  every star point, 4 use the cross with each team heading for the opposite arm.
- **FR-004**: On either board, a move MUST be either one step into an empty neighbouring hole, or
  one or more hops, each over a single adjacent creature (any team) into the empty hole straight
  behind it in the same direction; a move
  cannot mix a step with hops. Hopped creatures are not removed.
- **FR-005**: When a creature is selected, the game MUST highlight every hole it can reach this
  turn and MUST reject any other destination.
- **FR-006**: Turns MUST go clockwise. A player finishes by filling their target area (a target
  area blocked by an opponent's never-moved creatures still counts as filled, see Edge Cases);
  places are given in finishing order. The game MUST end (end screen) when every place is decided,
  no Person is still playing, the stall rule triggers (FR-022), or a player chooses "End game";
  unfinished players are then ranked as in FR-022.
- **FR-007**: Before any game starts, every person MUST pick an elemental type from Fire, Water,
  Grass, Electric, Psychic and Rock; no two players in one game may share a type; computer players
  get the remaining types.
- **FR-008**: Each type MUST have its own colour, one creature look and a hop effect, and MUST be
  identifiable without colour (by name and creature shape). Each team's pieces are all that
  creature, with exactly one shown bigger as the team's leader; the leader moves and is hopped
  like any other piece.
- **FR-009**: Types MUST follow one advantage ring, each strong against the next: Water → Fire →
  Grass → Rock → Electric → Psychic → Water. In addition to the moves in FR-004:
  - **Long hop**: a creature may hop over a creature it is strong against that sits any number of
    holes away in a straight line, provided every hole between them is empty and the same number
    of holes beyond it are empty; it lands at the mirror point. Long hops can be chained with
    normal hops in the same move.
  - **Blocked hop**: a creature MUST NOT hop over a creature it is weak against.
  - Creatures of the same type, or of types not next to each other on the ring, hop over each
    other normally. Hopped creatures are never removed.
- **FR-010**: 1 Player MUST play against computer players with no server.
- **FR-011**: Local games MUST allow 2, 4 or 6 seats on one device, each seat a Person or a
  Computer, with at least one Person.
- **FR-012**: Computer players MUST have three strengths, chosen per game (Normal by default):
  **Easy** sometimes makes a weak move and ignores long hops; **Normal** always moves toward its
  target and uses long hops; **Hard** also plans hop chains and blocks the leading rival. All
  strengths MUST make a legal move within about a second.
- **FR-013**: Online play MUST use the same lobby as the site's other online games (host with a
  generated room name, room list, countdown, Start/Cancel/Leave, join links), with room sizes of 2,
  4 or 6.
- **FR-014**: In an online room, type picks MUST be shown to everyone and two players MUST never be
  given the same type.
- **FR-015**: Online, every player MUST see the same board after every move, only the current
  player can move, and illegal moves sent by anyone MUST be ignored.
- **FR-016**: Online, a seat whose player leaves or disconnects MUST be taken over by a computer
  player and everyone MUST be told.
- **FR-017**: Online, each turn MUST have a time limit (60 seconds by default); when it runs out a
  legal move is made for the player.
- **FR-018**: When online play is unavailable, the game MUST say so plainly and keep 1 Player and
  local games usable.
- **FR-019**: The game MUST be fully playable by mouse, by keyboard alone and by touch (tap, drag,
  pinch), and fit phone screens without sideways scrolling.
- **FR-020**: The game MUST NOT use Pokémon names, characters, artwork, logos, sounds or text; all
  creatures and names are original.
- **FR-021**: The game MUST show whose turn it is, each player's type, and at the end the finishing
  order, with "Play again" and "Menu".
- **FR-022**: A game MUST end on its own after 20 full rounds in a row with no creature newly
  entering its target area, ranking unfinished players as in Edge Cases. The count starts once any
  creature has reached its target (before that every game is still on its way: beginners can take
  more than 20 rounds to get the first creature home).
- **FR-023**: Setup MUST offer a hop speed, Normal or Fast (Normal by default); Fast animates moves
  about 5× quicker.

### Key Entities

- **Board**: Star (121 holes, six points, 6 directions) or Cross (105 holes, four arms,
  8 directions); its home areas and which home is each home's opposite.
- **Type**: one of Fire, Water, Grass, Electric, Psychic, Rock; has a name, colour, creature look,
  hop effect, and the one type it is strong against and the one it is weak against.
- **Player (seat)**: a Person or Computer, a type, a home area, a target area, a turn position
  and, once finished, a place.
- **Target area**: the opposite star point, or the home rows of the opposite cross arm.
- **Creature (piece)**: belongs to one player; sits in one hole; one per team is the leader
  (looks only).
- **Move**: a creature, its start hole and the holes it passes through to its end hole.
- **Game**: number of players, board, seats, computer strength, whose turn it is, turn count,
  finishing order, turn timer setting.
- **Room** (online): generated name, size (2/4/6), host, players and their type picks, countdown,
  state (waiting / playing).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can go from the game page to their first move in under
  30 seconds, including picking a type.
- **SC-002**: In 100% of tested positions, the highlighted holes are exactly the legal moves (no
  missing hop chains or long hops, no blocked hops, no illegal holes).
- **SC-003**: A 2-player game against the computer can be finished in under 15 minutes.
- **SC-004**: Online, a move made by one player appears on every other player's screen within
  1 second on a normal home connection.
- **SC-005**: A 6-player game (online or local) never leaves players waiting on a computer seat
  for more than 2 seconds per computer move.
- **SC-006**: The game plays smoothly (no visible stutter while turning the board or moving
  creatures) on a recent iPad with all 60 creatures on the star board.
- **SC-007**: When the relay is unreachable, 1 Player and local games remain 100% playable.

## Assumptions

- "Chess for 2, 4, 6 players" means star checkers (Chinese checkers), the classic board game for
  exactly those player counts; 3-player games are left out because they weren't asked for.
- "Pokémon theme" means an original creature-and-type theme as described in Style; real Pokémon
  content is not used (FR-020).
- The advantage ring and the long-hop / blocked-hop rule are the owner-approved reading of "type
  advantages"; the ring order is a game-design choice and can be tuned in planning.
- Six types, one per board point, so a 6-player game always has enough distinct types.
- The online lobby, relay and room rules are the ones already used by the site's other games
  (specs 003 and 004), with room sizes 2, 4 or 6 instead of their own sizes.
- A player who disconnects online can rejoin the same game and take their seat back, using the
  rejoin the site's online games already have (plan research R6).
- No accounts or saved history; nothing is kept after a game or room ends.
