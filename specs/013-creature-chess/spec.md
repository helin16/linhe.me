# Feature Specification: Critter Chess — 3D chess for 2, 4 or 6 players, local and online

**Feature Branch**: `master` (no feature branch)

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "we need a new game using three.js: 1. it can be 2, 4, 6 player for the chess, 2. it can be online as well 3. it's Pokimon theme, the player will need to choos the type of pokiemons before start"; owner follow-up: "I don't want that... I want the chess" (spec 012 built star checkers by mistake). Owner decisions: Critter Hop (spec 012) stays live as its own game; 6 players play on a hexagon board; the creature type is looks only; 4- and 6-player games are won by the last king standing.

## Style

Real chess — kings, queens, rooks, bishops, knights and pawns, check and checkmate — on a 3D board
that can be turned and zoomed:

- **2 players**: standard chess on the 8 × 8 board.
- **4 players**: the classic cross-shaped four-player board (an 8 × 8 centre with a 3-deep, 8-wide
  arm on each side), one army per arm.
- **6 players**: a hexagon board with one army on each of its six sides; pieces move along the hex
  board's lines (hexagonal chess moves).

The theme is an **original** monster-trainer style, in the spirit of Pokémon but not taken from it:
before the game each player picks a creature type (Fire, Water, Grass, Electric, Psychic or Rock).
The type is **looks only**: that player's army becomes creatures of that type — each chess piece a
different creature of the type, in its colours and with its effects — and the chess rules are the
same for everyone. No Pokémon names, characters, art, logos, sounds or text are used.

The game is called **Critter Chess** (address `/games/critter-chess/`). It sits beside Critter Hop
(spec 012), which stays live as a separate game; the two may share the six types' names and
colours.

## Clarifications

### Session 2026-11-19

- Q: How big is each army on the 6-player hexagon board? → A: The full army, 16 pieces each (96 on
  the board); the hexagon is sized to fit them (each side long enough for 8 pieces in a row).
- Q: How long can an online player think per move? → A: 60 seconds per move, as in Critter Hop;
  when it runs out a move is made for them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play chess against the computer (Priority: P1)

A visitor opens Critter Chess, chooses 1 Player, picks 2, 4 or 6 players in total, the computer
strength and their creature type. The board appears with every army in place. On their turn they
select one of their pieces, the game highlights every square it can legally move to, and they pick
one. Computer players reply. In a 2-player game, checkmate wins and stalemate or the usual draw
rules end it in a draw; with 4 or 6 players, a checkmated player is out and the last player left
wins.

**Why this priority**: The core game: boards, chess moves, check and mate, winning, and the type
pick. Everything else builds on it, and it needs no server.

**Independent Test**: 1 Player, 2 players, pick Water: a standard chess position with Water
creatures as your pieces; select a pawn, its one- and two-step squares light up; move; the
computer replies.

**Acceptance Scenarios**:

1. **Given** the menu, **When** a player chooses 1 Player, **Then** they choose the number of
   players (2, 4 or 6; 2 unless changed), the computer strength (Easy, Normal or Hard; Normal
   unless changed) and their type; computer players get other types.
2. **Given** the type picker, **When** a player looks at a type, **Then** they see its name,
   colour and its six creatures (one per piece kind), told apart by shape as well as colour.
3. **Given** 2 players, **When** the game starts, **Then** it is the standard starting position on
   the 8 × 8 board; **Given** 4, **Then** the cross board with an army on each arm; **Given** 6,
   **Then** the hexagon board with an army on each side.
4. **Given** it is the player's turn, **When** they select one of their pieces, **Then** exactly
   the squares it may legally move to are highlighted (moves that would leave their own king in
   check are not offered), and captures are shown differently from plain moves.
5. **Given** a highlighted square, **When** the player picks it, **Then** the piece moves there
   (capturing anything on it) and the turn passes to the next player clockwise.
6. **Given** a pawn reaches its promotion row, **When** it arrives, **Then** the player picks a
   queen, rook, bishop or knight for it (computer players pick a queen).
7. **Given** a player's king is attacked, **When** their turn comes, **Then** the game shows
   "Check" and only moves that get out of check are offered.
8. **Given** a 2-player game, **When** a player is checkmated, **Then** the other player wins;
   **When** stalemate, threefold repetition, the 50-move rule or insufficient material happens,
   **Then** the game is a draw.
9. **Given** a 4- or 6-player game, **When** a player is checkmated (or their king is captured),
   **Then** they are out, their remaining pieces leave the board, and play continues; the last
   player left wins and the end screen shows the order players went out.
10. **Given** any game, **When** the player chooses Resign, **Then** they are out (in 2 players the
    other side wins).
11. **Given** a desktop, **When** playing, **Then** the game is fully playable with the mouse or
    with the keyboard alone (arrows move a cursor, Enter selects and moves, Escape cancels, H shows
    a hint), and the camera turns and zooms; **Given** a touch screen, **Then** tap selects and
    moves, drag turns the board and pinch zooms.

---

### User Story 2 - 2, 4 or 6 players on one device (Priority: P1)

Friends share one computer or tablet. They choose 2 Players, then 2, 4 or 6 seats, each a Person
or a Computer, and each person picks a different type. The board turns to face whoever's turn it
is, and a banner names them.

**Why this priority**: The family-on-one-iPad case the owner asked for.

**Independent Test**: 2 Players, 4 seats (two people, two computers): the cross board; the turn
banner and board facing follow the clockwise order and come back to the first player.

**Acceptance Scenarios**:

1. **Given** local setup, **When** players choose 2, 4 or 6 seats, **Then** each seat can be a
   Person or a Computer (seat 1 always a Person) and each person picks a type no other person has.
2. **Given** a local game, **When** a turn ends, **Then** the board turns to face the next person
   and the banner names them; computer turns play themselves.
3. **Given** one player is out, **When** others remain, **Then** play continues with the rest until
   one is left.

---

### User Story 3 - Play online in a room (Priority: P2)

A player presses Online and hosts or joins a room through the site's shared lobby. The host picks
the room size (2, 4 or 6) and the computer strength; each player picks a type nobody else in the
room has. When the game starts, empty seats become computer players. Every player sees the same
board and moves; only the player in turn can move. A player who drops out is replaced by a
computer and can rejoin to take their seat back.

**Why this priority**: Asked for, but the game is complete without it.

**Independent Test**: Two browsers: A hosts a 4-player room and picks Fire; B joins, sees Fire
taken and picks Rock; A starts: both see the same cross board with two computer armies; A's move
appears on B's screen.

**Acceptance Scenarios**:

1. **Given** the Online popup, **When** a player hosts, **Then** they choose 2, 4 or 6 players and
   the room appears in the room list with its name and count.
2. **Given** a waiting room, **When** a player picks a type, **Then** everyone sees it taken within
   a second; two players never end up with the same type.
3. **Given** the countdown ends or the host presses Start, **When** the game starts, **Then**
   everyone gets the same seats and types; computer players fill empty seats; a player without a
   type gets a free one.
4. **Given** an online game, **When** a player moves, **Then** every other player sees the same
   move within a second; illegal or out-of-turn moves are ignored by everyone.
5. **Given** an online game, **When** a player leaves or loses connection, **Then** the others are
   told and a computer plays that seat; the player can rejoin and take it back.
6. **Given** an online game, **When** a player doesn't move within 60 seconds (a countdown shows),
   **Then** a legal move is made for them and the turn passes.
7. **Given** the relay is down, **When** a player tries Online, **Then** they see a plain message
   and can still play offline.
8. **Given** two rooms or another game, **When** moves are made, **Then** they never leak between
   rooms or games.

---

### User Story 4 - Hints and move list (Priority: P3)

A beginner can press Hint to see one good move, and everyone can see the last moves made, so they
can follow what the computers and other players did.

**Why this priority**: Helps children and beginners; the game is complete without it.

**Independent Test**: Press Hint: one piece and square are highlighted; Enter plays it; the move
list shows it.

**Acceptance Scenarios**:

1. **Given** a person's turn, **When** they press Hint (or H), **Then** one piece and one square are
   highlighted without moving; Enter (or tapping it) plays it.
2. **Given** any game, **When** moves are made, **Then** the last move is marked on the board and
   the recent moves are listed by player.

---

### Edge Cases

- Several players attack one king at once (4/6 players): on that player's turn they must get out
  of every check; if they can't, they are mated and out.
- A player's move leaves another player's king in check, and a third player moves before that
  king's owner can respond: if the third player can capture the king, they may, and the king's
  owner is out.
- Stalemate in 4/6 players: the stalemated player sits out that turn (skipped) and stays in; if
  they are still stalemated when every other player is out, the game is a draw between those left.
- A player goes out: their pieces leave the board; any check they were giving disappears.
- Only kings (or not enough pieces to mate) remain between two players in a 4/6-player game: those
  players draw and share the top place.
- A 4/6-player game drags on: after 50 full rounds with no capture or pawn move the game ends and
  the players left share the top place.
- Castling: allowed in 2- and 4-player games under the usual conditions; not on the hexagon board.
  En passant: only in 2-player games.
- Promotion: in 2 players on the far rank; in 4 players on the middle line of the board (the 8th
  row from the player's start); on the hexagon, on reaching the board's far edge.
- Online: the host leaves while waiting: the next player becomes host. The runner of the game
  leaves mid-game: the next player takes over running it.
- A join link opened after the game started: "That game has already started".
- Window resized or phone rotated mid-game: the board refits; nothing is lost.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST be a new game on the site at its own address, listed with the others,
  with a 3D board the player can turn and zoom. Critter Hop MUST stay as it is.
- **FR-002**: There MUST be three boards: 8 × 8 for 2 players; the cross-shaped four-player board
  (8 × 8 centre plus four 3 × 8 arms, 160 squares) for 4; a hexagon board with an army on each of
  its six sides for 6.
- **FR-003**: Every army on every board MUST be the full chess set (king, queen, two rooks, two
  bishops, two knights, eight pawns): in the usual starting rows on the 8 × 8 and cross boards, and
  on the hexagon in two rows along its own side (pieces behind, pawns in front), the hexagon being
  big enough for six such armies.
- **FR-004**: Pieces MUST move by standard chess rules on the square boards; on the hexagon board
  rooks move along the six straight lines, bishops along the six diagonal lines, the queen both, the
  king one step along any of them, the knight by the hex-chess knight jump, and pawns forward along
  the straight line toward the far side, capturing on the two forward diagonals.
- **FR-005**: The game MUST offer only legal moves (never one that leaves the mover's own king in
  check), highlight them when a piece is selected, and reject anything else.
- **FR-006**: Check MUST be shown; checkmate MUST end the game in 2 players and put the player out
  in 4/6; stalemate, threefold repetition, the 50-move rule and insufficient material MUST draw a
  2-player game; 4/6-player games follow the Edge Cases.
- **FR-007**: Castling, en passant and promotion MUST follow the Edge Cases for each board; a
  promoting person MUST choose the new piece.
- **FR-008**: Players MUST be able to resign; a resigning player is out.
- **FR-009**: Turns MUST go clockwise; a 4/6-player game MUST be won by the last player left, and
  the end screen MUST show the order players went out (draws share a place).
- **FR-010**: Before a game every person MUST pick a type from Fire, Water, Grass, Electric,
  Psychic, Rock; no two players in one game share a type; computer players get other types.
- **FR-011**: The type MUST change only looks: each type has six original creatures, one per piece
  kind, in that type's colours and with its own move effects, recognisable by shape and not only by
  colour. Rules MUST be identical for every type.
- **FR-012**: 1 Player MUST play against computer players with no server; 2 Players MUST allow 2, 4
  or 6 seats on one device, each a Person or a Computer, with at least one Person.
- **FR-013**: Computer players MUST have Easy, Normal and Hard strengths (Normal by default), always
  make legal moves, and move within 2 seconds.
- **FR-014**: Online play MUST use the site's shared lobby (generated room names, room list,
  countdown, Start/Cancel/Leave, join links, rejoin), with room sizes 2, 4 or 6, unique type picks,
  the host's strength choice, computer players for empty or dropped seats, and a 60-second move
  limit after which a move is made for the player.
- **FR-015**: Online, every player MUST see the same game after every move; out-of-turn or illegal
  moves MUST be ignored by everyone.
- **FR-016**: When online play is unavailable, the game MUST say so plainly and keep offline play
  working.
- **FR-017**: The game MUST be fully playable by mouse, keyboard alone and touch, fit phone screens
  without sideways scrolling, and give screen readers each selectable piece and move.
- **FR-018**: The game MUST offer a Hint and show the last move and the recent moves.
- **FR-019**: The game MUST NOT use Pokémon names, characters, artwork, logos, sounds or text.

### Key Entities

- **Board**: 8 × 8, cross or hexagon: its cells, how they connect for each kind of move, each army's
  starting cells, promotion cells and the direction its pawns move.
- **Army / Seat**: Person or Computer, a type, a side of the board, in or out, and its place.
- **Piece**: king, queen, rook, bishop, knight or pawn; belongs to a seat; on one cell; whether it
  has moved (castling, pawn double step).
- **Move**: piece, from, to, capture, promotion choice, castling or en passant.
- **Game**: board, seats, pieces, whose turn, move history (for repetition and the 50-move rule),
  status (playing, over) and result.
- **Room** (online): as in the shared lobby, plus each player's type pick and the host's strength.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor gets from the game page to their first move in under 30 seconds,
  including picking a type.
- **SC-002**: In 100% of tested positions, the highlighted squares are exactly the legal moves
  (standard chess positions on the 8 × 8 board match well-known move counts).
- **SC-003**: Computer players move within 2 seconds on a recent iPad, at every strength.
- **SC-004**: Online, a move appears on every other screen within 1 second on a normal home
  connection.
- **SC-005**: Turning the board and moving pieces stays smooth on a recent iPad with all armies on
  the largest board.
- **SC-006**: When the relay is unreachable, offline play remains 100% usable.
- **SC-007**: Normal-strength computer players beat Easy in most games, and Hard beats Normal in most
  games.

## Assumptions

- The four-player board and its rules follow the widely played four-player chess layout (cross of
  160 squares), playing "free for all" with last king standing, as the owner chose.
- There is no single standard six-player hexagonal chess; the hexagon's exact size and the armies'
  cell-by-cell layout are set in planning (full 16-piece armies, FR-003), using the common
  hex-chess piece moves (FR-004).
- In 4/6 players, pieces of a player who is out leave the board (they don't stay as obstacles).
- Kings may be captured in 4/6-player games when their owner couldn't respond in time (Edge Cases);
  in 2-player games the usual rules make that impossible.
- Critter Chess reuses the six types (names, colours) from Critter Hop for consistency; the
  creatures themselves are new, one per piece kind.
- Same site patterns as the other games: same-device setup, saved choices on this device, no
  accounts, nothing kept after a room closes.
