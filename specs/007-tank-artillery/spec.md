# Feature Specification: Tank Clash — a turn-based tank artillery game for 1–2 players, local and online

**Feature Branch**: `master` (no feature branch)

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "need to make another game like Scorchedearth but similar to `Turbo tumble`, user can choose to play 1 or 2. each game can be from 2 to 10 tanks(default 2, when 2 with 2 players, then they are against each other). and players can change choose different tanks( different tanks can be more flexible with the angle the their cannon can tile. different tanks can be firing bullet with more damage, or with different armar( from 3 hearts to 5 hearts). and the host or player 1 can choose different maps or random. some maps are connected with wood(easier to break, when the wood under the tank is gone, then the tank fall and kill instantly), or with water which tanks can't get into. or with snow, it will be a bit slippy"

## Style

An original game in the turn-based artillery genre that Scorched Earth belongs to, not a copy of
it: its own name, look, art and rules. The battlefield is seen from the side and fits on one
screen: hills of ground, with tanks sitting on top. On its turn a tank can drive a little, tilt its
cannon, set the shot's power and fire; the shell flies in an arc and blows a
hole in the ground where it lands. Nothing (name, logo, graphics, sounds, text) is taken from
Scorched Earth or any other game.

"Similar to Turbo Tumble" means it is organised like the site's existing games: a menu with
1 Player, 2 Players and Online, a garage to pick and customise your tank, and Turbo Tumble's online
lobby (room list, host/join, waiting room with countdown).

**Tank look**: chunky, cartoon "toy-tank" style like the owner's reference pictures of Chinese
online tank games: oversized tracks with big road wheels, stubby bodies piled with armour plates,
rivets, exhaust pipes and hatches, outsized cannons, bold colours with glossy metal shading and dark
outlines. Each tank type has its own silhouette that hints at its stats: the Scout is a small,
light buggy-like tank on big wheels; the Allrounder a classic one-turret tank; the Heavy a wide,
armour-heavy tank with a twin cannon; the Artillery a long-barrelled gun on a light body. The
player's colour paints the main armour. Tanks are drawn side-on to fit the battlefield. Every
design is drawn for this game: no tank, logo, character or theme (e.g. superhero or robot-movie
tanks) is copied from those games or anyone else.

**Battlefield look**: bright, cartoon side-view landscapes like the owner's second set of reference
pictures (mobile hill-climb tank games): smooth rolling hills with a grass strip on top over a
lighter edge and darker earth below, a sunny sky with clouds, and soft distant hills and scenery
behind (each map with its own: fields and farmhouses, forest, lakeside, snowy peaks). Snow areas
show as white caps on the hills, water as blue pools in the dips, wood as plank bridges. Big
cartoon explosions with smoke. Original art; nothing copied from those games.

## Clarifications

### Session 2026-10-29

- Q: How do turns work? → A: One tank at a time moves and fires once while all the others wait; each turn lasts at most 30 seconds, with a countdown on screen.
- Q: With more than 2 tanks, who fights whom? → A: There are only ever two sides, Left and Right. The tank count is even (2, 4, 6, 8 or 10), split equally between the two sides, with computer tanks filling the places not taken by players.
- Q: What should the game be called on the site? → A: Tank Clash (address `/games/tank-clash/`).
- Q: How are hearts shown and taken? → A: A life panel on screen lists every tank and its hearts left. Every shell that hits does damage, and how much depends on the firing tank's type; damage can be a fraction of a heart (e.g. 1.5), so hearts left can be fractional too.
- Q: Do all tanks handle snow the same? → A: No: some tank types grip better on snow and ice, and those are the lightly armed ones.
- Q: When do tanks slide? → A: Only a bit, and only when moving (a little on after stopping) or firing (a little back from the shot); never on their own while parked.
- Q: Is the shell's flight path shown? → A: Yes, as a trail behind the shell while it flies, fading out from the tank end towards the shell, until it explodes.
- Q: Where do tanks start? → A: At random spots on their side's half (Left or Right), different every game.
- Q: Are there pick-ups? → A: After every round (all tanks have fired once) an air drop floats slowly down at a random spot: a repair kit (+hearts), a power shell (more damage on the next shot), grip gear (better grip for the next round) or, very rarely, a shield that blocks all damage once.
- Q: How does a tank show what it picked up, and is there a missile? → A: Repair: a heart rises and fades above the tank; power shell: a golden ring around it; grip gear: shiny gold wheels; shield: a shiny gold outline. A new Missile drop sits on top of the tank and, when fired, flies very far and does double damage.
- Q: Which sounds should the game use? → A: Recorded clips from freesound.org: "tracked vehicle.wav" for driving, "Tank fire Mixed.wav" for firing, "Exploding Car (with Fire) (Mixed)" when a shell or missile destroys a tank, "10091 water bomb exploding.wav" for other blasts; credited in the garage.
- Q: Can players pick a different look? → A: Yes: a Style switch at the top of the garage, Normal (default, the cartoon look with the recorded clips) or Arcade (pixel-art tanks and battlefields, a pixel font and bevelled buttons, retro made-here sounds); remembered on this device.
- Q: Does the battlefield's background fill the screen? → A: Yes, at any window size: the field (tanks and hills) is scaled to fit, and the sky, scenery and ground carry on to the screen's edges.
- Q: What should the tanks look like? → A: Like the owner's reference pictures: chunky cartoon tanks with big tracks, armour plates and big cannons, in original designs (see Style).
- Q: What should the maps look like? → A: Bright cartoon rolling hills like the owner's reference pictures; each game the number of hills, their heights (never too high) and the snow and water areas are random, but water is never under a tank at the start.
- Q: Can all ground be destroyed? → A: Yes: on every map, earth, wood and ice can be blown away by shells; once all of it is gone under a tank, the tank falls out of the screen and is destroyed at once.
- Q: How can a tank move? → A: Only left or right, along the ground.
- Q: When sides are uneven, how do turns go? → A: Each tank still in fires once per round; sides alternate while both have tanks waiting, then the bigger side's remaining tanks go one after another (e.g. L, R, R, R).
- Q: Is there an aiming guide before firing? → A: No: players aim by the cannon's tilt and the angle and power numbers, learning from watching their previous shots.
- Q: Is health shown on the battlefield too? → A: Yes: a small health bar and the tank's name above each tank; full hearts and numbers stay in the life panel.
- Q: Does a battle have a round or time limit? → A: No: it goes on until one side has no tanks left.
- Q: How do players see which tank is playing? → A: The active tank (the one that can move and fire) is highlighted on the battlefield, as well as in the life panel.
- Q: Online, what happens to the tank of a player who leaves or drops? → A: A computer takes it over, keeping its hearts and bonuses; if the player reconnects during the battle, they take it back from its next turn.
- Q: Online, can players choose their side? → A: Yes: each player is put on a random side by default, and can switch to the other side in the waiting room while it has room.
- Q: How are the sides told apart, and which way can tanks fire? → A: There's no side colour: each tank keeps its own colour (health bar included). Left tanks always face and fire only to the right, Right tanks only to the left.
- Q: Can a tank drive past the middle into the enemy's half, or through other tanks? → A: It can cross the middle into the enemy's half (no middle line is drawn), but never through other tanks: it stops when it bumps one.
- Q: Which sound effects should there be? → A: Firing, a tank moving, explosions, an air drop landing, and winning.
- Q: What happens to a destroyed tank? → A: Its steel wreck stays on the map and takes no damage; it only goes when the ground under it is blown away, then it falls (off the screen and disappears if nothing is left below).
- Q: Online, can players all switch onto the same side? → A: Yes, as long as that side has a free place (half the tanks); friends can team up against computer tanks.
- Q: How does a tank sit on a slope? → A: Tilted to follow the ground under it, and only where there's ground under its middle (it never hangs on by a corner).
- Q: How far can a tank drive on its turn? → A: As much as it likes until it fires or time runs out (no fuel); heavier tanks drive slower, lighter ones faster. The last 10 seconds show a big countdown.
- Q: How does grip change driving? → A: High grip drives slower but stops dead when the drive key is let go; low grip drives faster but rolls on a little after letting go.
- Q: Is there wind? → A: No.
- Q: How is the active tank highlighted on the battlefield? → A: Only by a bobbing arrow above it; no outline or circle.
- Q: Does the garage preview the choices? → A: Yes, like Turbo Tumble: the chosen map and the tanks are shown behind the garage.
- Q: Can a tank type be tuned? → A: Yes: each type has builds A, B (standard) and C; A tilts its cannon further but hits softer, C tilts less but hits harder.
- Q: Does a harder-hitting gun reach as far? → A: No: each gun has its own reach; tanks and builds that hit harder have a lower top power, so they can't fire as far. Damage doesn't change with distance.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Battle computer tanks solo (Priority: P1)

A visitor opens the game, picks 1 Player and plays against computer tanks. By default it is one
computer tank (2 tanks in all); they can choose 4, 6, 8 or 10 tanks, split into a Left and a Right
side, with computer tanks as both the player's teammates and their enemies. Tanks take turns. On
their turn the player drives a little, aims, sets power and fires. A shell that lands near a tank
takes hearts off it; a tank with no hearts left is destroyed. The side with a tank still standing
wins.

**Why this priority**: The core game loop; every other mode is built on it.

**Independent Test**: Choose 1 Player with the defaults: two tanks appear on opposite sides; on the
player's turn, aim and fire; a shell that lands next to the computer tank removes hearts; destroy
it: "You win" and "Play again".

**Acceptance Scenarios**:

1. **Given** the game page, **When** a player starts 1 Player with the defaults, **Then** a
   battlefield appears with the player's tank and one computer tank on opposite sides, the life panel listing both tanks with their hearts, and a name and
   small health bar above each tank.
2. **Given** the player's turn, **When** they change the cannon's angle or the shot's power,
   **Then** the cannon tilts on screen and the angle and power are shown as numbers; the angle
   can't go past the limits of their tank type and always points towards the enemy side, and the
   power can't go past their tank's top power.
3. **Given** the player's turn, **When** they drive left or right, **Then** the tank moves along
   the ground, tilted to the slope, climbing gentle slopes but not steep ones, for as long as the
   turn lasts, at its type's speed.
4. **Given** the player's turn, **When** they fire, **Then** the shell flies in an arc affected by
   gravity, leaving a trail along the path it has flown: faintest at the tank end and
   strongest right behind the shell, so the older part fades away. Where it hits the ground it
   blows a round hole, and the trail disappears with the explosion.
5. **Given** a shell blast that reaches a tank, **When** it explodes, **Then** that tank loses as
   many hearts as the firing tank's damage (any tank, including the one that fired), which can be
   a fraction: a Heavy's hit takes a 4-heart tank down to 2.5, and the life panel shows 2½ hearts
   and "2.5" at once.
6. **Given** a tank's hearts reach 0 or less, **When** that happens, **Then** it is destroyed,
   shown as destroyed in the life panel, skips all later turns, and leaves a blackened steel wreck
   where it stood. **Given** a wreck, **When** a shell hits it or a blast reaches it, **Then** the
   wreck takes no damage and doesn't move (the shell explodes on it as on ground); **when** the
   ground under it is blown away, **Then** it drops onto what's left below, or falls out of the
   bottom of the screen and disappears if nothing is left.
7. **Given** ground removed under a tank (earth, snow or ice), **When** some ground is still left
   below it, **Then** the tank drops onto it, with no damage; **when** a blast has cut all the way
   through so nothing at all is left beneath the tank, **Then** it falls out of the bottom of the
   screen and is destroyed at once, whatever hearts it had.
8. **Given** a shell that leaves the screen's sides or falls into water, **When** that happens,
   **Then** it does nothing and the turn passes.
9. **Given** only one side has tanks left, **When** the other side's last tank is destroyed,
   **Then** the game shows the winning side and "Play again"; if both sides' last tanks are
   destroyed by the same shot, it's a draw.
10. **Given** 1 Player and the tank count set to 2, 4, 6, 8 or 10, **When** the game starts,
    **Then** half the tanks are on the Left side (the player's tank and computer teammates) and
    half on the Right (computer tanks), each tank at a random spot on its side's half of the
    battlefield (different every game), and turns go round them in a fixed order shown on screen,
    alternating sides.
11. **Given** a computer tank's turn, **When** it plays, **Then** it aims and fires on its own
    within a few seconds, at the difficulty picked (Easy, Normal or Hard).
12. **Given** any tank's turn, **When** it starts, **Then** a 30-second countdown shows on screen
    and every other tank waits; in the last 10 seconds a big countdown shows in the middle of the
    screen; **when** the countdown reaches 0 without a shot, **Then** the turn
    passes to the next tank with no shot fired.
13. **Given** sound on, **When** a tank drives, fires, a shell explodes, a crate lands or the
    player's side wins, **Then** the matching sound plays (engine rumble only while driving);
    **when** the player presses mute, **Then** all sounds stop, and stay off after reloading.

---

### User Story 2 - Two players on one device (Priority: P1)

Two people share one keyboard or one tablet and take turns, passing the device like a board game.
Player 1 leads the Left side and player 2 the Right. With 2 tanks (the default) they fight each
other one on one; with 4, 6, 8 or 10 tanks, computer tanks fill each side equally, so each player
has computer teammates against the other player's side.

**Why this priority**: Explicitly requested; the head-to-head draw of the game.

**Independent Test**: Choose 2 Players with the defaults: player 1's tank is on the left, player
2's on the right; each plays a turn in turn; player 1 destroys player 2's tank: "Player 1 wins".

**Acceptance Scenarios**:

1. **Given** 2 Players with 2 tanks, **When** the game starts, **Then** both players' tanks appear
   on opposite sides and player 1 goes first.
2. **Given** a turn, **When** it starts, **Then** the screen clearly shows whose turn it is (name and
   colour), the active tank has a bobbing arrow above it on the battlefield and is highlighted
   in the life panel, and only that player's controls act.
3. **Given** a player's tank is destroyed, **When** only the other player's tank is left, **Then**
   that player wins.
4. **Given** 2 Players with 6 tanks, **When** the game starts, **Then** the Left side has player 1's
   tank and 2 computer tanks, the Right side has player 2's tank and 2 computer tanks; the side
   with a tank left at the end wins, even if its player's own tank was destroyed.

---

### User Story 3 - Choose and customise your tank (Priority: P1)

Before playing, each player opens the garage (like Turbo Tumble's) and picks a tank type, which
sets how many hearts it has, how fast it drives and how well it grips, and a build (A, B or C)
that sets how far its cannon can tilt, how hard its shells hit and how far they can reach; and gives
it a name and colour. A live preview (the chosen map with the tanks on it) and the tank's stats are
shown. In 2 Players
there's a tab for each player. Choices are remembered on this device and shown to others online.

**Why this priority**: Explicitly requested; tank types give each player a different way to play.

**Independent Test**: Open the garage, pick the Heavy tank: the preview changes and its stats show
5 hearts, 1.5 damage and a narrow angle range; start a game: the tank looks the same and has 5 hearts.

**Acceptance Scenarios**:

1. **Given** the garage, **When** the player picks a tank type or build, **Then** the preview and
   its stats (angle range, damage, top power, hearts, grip, speed) update immediately.
2. **Given** a game, **When** it starts, **Then** each tank has the hearts, damage, top power and
   angle limits of its type and build.
3. **Given** the garage, **When** the player changes name or colour, **Then** the preview updates,
   and the choices are back after reloading.
4. **Given** 2 Players, **When** both pick the same colour, **Then** player 2's colour is changed
   and they're told.
5. **Given** a name with characters like `<`, **When** it's shown anywhere, **Then** it shows as
   typed (text, never markup).

---

### User Story 4 - Pick the map (Priority: P1)

Player 1 (or the host online) picks the map before the game: a named map or Random. Each map has its
own ground: plain dirt hills, wooden bridges over gaps, lakes, or snow.

**Why this priority**: Explicitly requested; the maps change how a battle plays.

**Independent Test**: Pick the wooden-bridge map; a tank sits on a bridge; shoot the wood under
it: the wood breaks, the tank falls and is destroyed at once.

**Acceptance Scenarios**:

1. **Given** the map picker, **When** player 1 / the host picks a map or Random, **Then** the game
   uses it (Random picks one of the maps at random) and the map's name is shown when it starts.
2. **Given** wood, **When** a shell blast reaches it, **Then** a bigger piece of wood breaks than
   the dirt the same blast would remove.
3. **Given** a tank standing on wood, **When** the wood under it is gone, **Then** the tank falls
   and is destroyed at once, whatever hearts it had left.
4. **Given** water, **When** a tank drives towards it, **Then** it stops at the water's edge; tanks
   never start in water.
5. **Given** ground removed under a tank so it would drop into water, **When** that happens,
   **Then** the tank is destroyed.
6. **Given** a tank on snow or ice, **When** it stops driving, **Then** it slides on a bit further
   in the direction it was going; **when** it fires, **Then** the kick slides it back a bit, away
   from where the cannon points. How far depends on its grip (a Heavy slides a bit, a Scout not
   at all) and is a little more on ice (on earth a low-grip tank still rolls on a little after
   driving, FR-011). A tank standing still and not firing never slides, even on
   a slope.
7. **Given** the same map picked twice, **When** each game starts, **Then** the number of hills,
   their heights and where the snow or water areas are (and how many and how big) are different
   each time, while keeping that map's character.
8. **Given** any generated battlefield, **When** it starts, **Then** no hill rises higher than
   about half the battlefield's height, so a tank can always lob a shell over it at full power.
9. **Given** a map with water, **When** the battlefield is made, **Then** no water is under or right
   next to any tank's starting spot.

---

### User Story 5 - Air drops (Priority: P2)

After every round (every tank still in has had its turn), a crate drifts down slowly on a
parachute at a random spot over the battlefield and lands on the ground. A tank picks it up by
driving onto it on its turn. Each crate holds one of: a repair kit, a power shell, grip gear or,
rarely, a shield.

**Why this priority**: Requested; it gives tanks a reason to move and changes each battle, but the
battle works without it.

**Independent Test**: With `?seed=` fixed so the first crate is a repair kit landing near the
player: play one round, watch the crate come down, drive onto it: the tank's hearts go up by 1 in
the life panel.

**Acceptance Scenarios**:

1. **Given** every tank still in has had a turn, **When** the round ends, **Then** one crate
   appears at the top of the screen at a random spot and drifts slowly down (taking a few seconds)
   until it lands on the ground; the next round starts while it falls.
2. **Given** a crate on the ground, **When** a tank drives onto it (or the crate lands on a tank),
   **Then** that tank gets what's inside, it's named on screen ("Repair kit!"), and the crate is
   gone.
3. **Given** a **repair kit**, **When** picked up, **Then** the tank gains 1 heart, but never more
   than its type's starting hearts.
4. **Given** a **power shell**, **When** picked up, **Then** the tank's next shot does 1.5 times its
   normal damage (e.g. a Heavy's 1.5 becomes 2.3, rounded to one decimal place); after that shot,
   damage is back to normal.
5. **Given** **grip gear**, **When** picked up, **Then** the tank has High grip (doesn't slide)
   until the end of the next round.
6. **Given** a **shield** (rare), **When** picked up, **Then** the next blast that reaches the tank
   does it no damage, and the shield is used up. It doesn't save a tank from falling off wood or
   into water.
7. **Given** a tank holding a power shell, grip gear or shield, **When** the life panel shows it,
   **Then** an icon for each one shows next to that tank until it's used up.
8. **Given** a crate, **When** a shell blast reaches it (falling or landed), **Then** it's destroyed
   and nobody gets it; **when** it lands in water or its ground is blown away beneath it, **Then**
   it sinks or falls with the ground like a tank (lost in water).

---

### User Story 6 - Play online (Priority: P2)

Two to ten people on different devices play the same battle online, meeting the way Turbo Tumble
players do: Online, the room list, host a room (picking how many players it holds, 2 to 10) or join
from the list, a code or a link; the waiting room with the player list, a 60-second countdown,
Start/Cancel for the host and Leave for guests. In the waiting room the host picks the map, the
number of tanks (an even number, at least the number of players, up to 10) and the computer tanks'
difficulty, all shown to everyone. Each joining player is put on a random side (keeping the numbers
of players on the two sides as even as possible), and any player can switch to the other side
while it has room; computer tanks fill the places left on each side. Everyone sees the same battlefield and plays
their own tank on their turn.

**Why this priority**: Implied by "the host"; it reuses the site's online lobby but comes after
the offline game works.

**Independent Test**: Two browsers: A hosts a room of 2, B joins from the list, A starts; each
fires on their own turn; B's tank is destroyed; both screens show A winning.

**Acceptance Scenarios**:

1. **Given** Online, **When** the popup opens, **Then** it lists only this game's waiting rooms and
   offers "Host a room".
2. **Given** players joining a waiting room, **When** each joins, **Then** they're put on a random
   side (the sides' player counts never differ by more than one) and the player list shows every
   player's side; **when** a player taps to switch side and that side has a free place, **Then**
   they move and everyone sees it within 2 seconds; if it's full, they're told.
3. **Given** a waiting room, **When** the host changes the map, tank count or difficulty, **Then**
   every player sees the change within 2 seconds.
4. **Given** a battle, **When** a player fires, **Then** every screen shows the same shot, the same
   holes and the same hearts lost.
5. **Given** a player's turn, **When** 30 seconds pass without firing, **Then** the turn passes to
   the next tank and every screen shows it.
6. **Given** a battle, **When** a player leaves or drops, **Then** every screen says so and a
   computer takes over their tank (same hearts, bonuses and place in the turn order) at the room's
   difficulty; the battle goes on, even if only one player is left. **When** that player comes
   back to the same room (same device, or by the room's link or code) before the battle ends,
   **Then** they get their tank back, as it is now, from its next turn.
7. **Given** a full room, or a battle in progress, **When** someone new (not a player rejoining,
   scenario 6) tries to join, **Then** they're
   told it's full or busy.
8. **Given** the relay can't be reached, **When** Online is picked, **Then** a clear message shows
   within 5 seconds and 1 Player and 2 Players still work.

---

### User Story 7 - Find the game on the site (Priority: P3)

The home page and games page list the game next to Turbo Tumble and Snake Duel.

**Independent Test**: The home page shows the game's card, which opens the game.

**Acceptance Scenarios**:

1. **Given** the home page, **When** it loads, **Then** the Tank Clash card shows the tag
   "1–2 players · Online up to 10 · iPad ready" and opens the game.
2. **Given** the games page, **When** it loads, **Then** the game is listed as Tank Clash with its description.

---

### Edge Cases

- A tank only ever moves left or right, following the ground's surface; it can't climb slopes
  steeper than a set limit and stops at the screen's edges and when it bumps another tank; it may
  cross the middle into the enemy's half. It moves down only by falling or dropping when the
  ground beneath it goes. Sliding also stops at other tanks.
- Any tank can pick up any crate it reaches, on either half.
- A shell that flies off the top of the screen keeps going and comes back down (shown by a marker
  at the top edge).
- A tank can be hurt by its own shell (e.g. a steep shot that comes straight back down), and by teammates' shells.
- Several tanks hit by one blast all lose hearts, teammates included; if both sides' last tanks are
  destroyed by the same shot, it's a draw.
- Online with an odd number of players (e.g. 3 in a 4-tank game), one side has one more person and
  the other side gets one more computer tank, so both sides still have equal tanks. If the host
  picks a tank count below the number of players, it rises to the next even number that fits.
- A player whose own tank is destroyed watches on; their side can still win.
- A tank destroyed by falling (wood gone, into water, or out of the screen) is destroyed even if it had full hearts, and leaves no wreck. Wrecks can shield a tank behind them: shells explode on them.
- On every map, all ground (earth, snow, ice and wood) can be blown away by shells, all the way
  through to the bottom of the screen, leaving an open gap. A tank or crate with nothing beneath
  falls out of the screen; a tank is destroyed at once, even with full hearts or a
  shield.
- Tanks start at random spots on their side's half, but never touching another tank, never on
  or next to water and never on a slope too steep to stand on. If a generated battlefield has no
  room for every tank, a new one is generated before the game starts.
- At most 3 crates can be on the battlefield at once; when 3 are already there, no new one drops.
- Power shell and shield don't stack: picking up a second one while still holding one leaves it at
  one (the crate is still used up). A repair kit picked up at full hearts is wasted.
- A crate's contents are hidden until it's picked up.
- Hidden tab: offline the game pauses, countdown included; online the countdown keeps running for
  that player.
- The countdown stops once a shell is fired; the next turn starts after the shell and any falling
  tanks have settled.
- Resize or rotate: the whole battlefield stays visible with no scrolling, scaled to fit; the sky, scenery and ground fill the rest of the screen (no empty bands).
- Blank names show "Player 1" / "Player 2".
- Hearts left are shown to one decimal place (e.g. 0.6); a tank with any hearts above 0 is still
  in, however small.
- With 10 tanks on a phone, the life panel stays readable without covering the tank whose turn it
  is (e.g. it can be collapsed to a compact strip).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST offer 1 Player, 2 Players and Online and be listed on the home page and
  games page.
- **FR-002**: A game MUST have 2, 4, 6, 8 or 10 tanks (default 2), chosen by player 1 offline and
  by the host online, split equally into exactly two sides, Left and Right. Each game, every tank
  MUST start at a random spot on its side's half of the battlefield. Places not taken by people are
  filled by computer tanks.
- **FR-003**: Tanks MUST take turns in a fixed order shown on screen; destroyed tanks are skipped.
  Only one tank acts at a time; all others wait. On its turn a tank can drive left or right
  along the ground, any time and as much as it likes until it fires (it may cross the middle into
  the enemy's half; it stops at the screen's edge and when it bumps another tank; tanks never pass
  through each other; no other movement: no jumping, no flying), at its type's speed (heavier
  drives slower, lighter faster); change cannon angle within its type and build's limits, change
  power up to its top power, and fire once; firing ends its turn. A tank MUST sit tilted to the
  ground under it and needs ground under its middle to stand (it never hangs on by a corner).
  Every turn, in every mode, MUST last at most 30 seconds, with a countdown on screen and a big
  countdown in the middle of the screen for the last 10 seconds; at 0 the turn passes with no shot.
- **FR-004**: Shells MUST fly in an arc under gravity only (there is no wind). A shell explodes where it hits ground or a tank, removing a round piece of ground.
  While a shell flies, a trail MUST show the path it has flown, fading from faint at the tank end
  to full strength just behind the shell; the trail MUST vanish when the shell explodes (or leaves
  play), and every player sees the same trail online. There MUST be no aiming guide or predicted
  path before firing: only the cannon's tilt and the angle and power numbers.
- **FR-005**: A blast MUST take the firing tank's damage in hearts from every tank it reaches;
  damage and hearts left may be fractions of a heart; a tank at 0 hearts or less is destroyed. The side with a tank still standing wins; if both sides' last
  tanks are destroyed together, it's a draw. A battle MUST have no round or time limit; it ends
  only when a side has no tanks left.
- **FR-006**: Sides MUST be filled like this: 1 Player — the player on Left, everything else
  computer; 2 Players — player 1 on Left, player 2 on Right; Online — each player who joins
  the waiting room MUST be put on a random side, keeping the sides' player counts within one of
  each other; in the waiting room any player MUST be able to switch themselves to the other side
  while it has a free place (each side holds half the tanks), even if that puts every player on one side against computer tanks, and everyone sees the change within
  2 seconds. Sides are fixed once the battle starts. In each round every tank still in MUST get exactly one turn: turns
  alternate Left, Right while both sides have tanks yet to play this round, then the remaining
  tanks of the bigger side play one after another (Left 1 vs Right 3 → L, R, R, R).
- **FR-007**: The garage MUST offer these tank types, each with its stats, in front of a preview of
  the chosen map (Random shows Green Hills) with the tanks on it:

  | Tank | Hearts | Grip | Speed |
  |------|--------|------|-------|
  | Scout | 3 | High | 85 |
  | Allrounder (default) | 4 | Medium | 75 |
  | Heavy | 5 | Low | 60 |
  | Artillery | 3 | Low | 105 |

  Each type comes in three builds; B (default) is standard, A tilts 5° further each way and hits
  softer (×0.8), C tilts 8° less each way and hits harder (×1.25); angles stay within 0°–85°.
  Harder hits reach less far: a tank's top power is 100 − 12 × (damage − 0.6), rounded, and never
  above 100 (power 100 at 45° crosses the battlefield):

  | Tank | A: angle · damage · top power | B | C |
  |------|-------------------------------|---|---|
  | Scout | 0°–85° · 0.6 · 100 | 5°–80° · 0.8 · 98 | 13°–72° · 1.0 · 95 |
  | Allrounder | 5°–80° · 0.8 · 98 | 10°–75° · 1.0 · 95 | 18°–67° · 1.3 · 92 |
  | Heavy | 25°–70° · 1.2 · 93 | 30°–65° · 1.5 · 89 | 38°–57° · 1.9 · 84 |
  | Artillery | 25°–85° · 1.4 · 90 | 30°–80° · 1.8 · 86 | 38°–72° · 2.3 · 80 |

  Angles are measured from flat ground towards the enemy side (0° = flat towards the enemy, 90° =
  straight up). Every tank always faces the enemy side: Left tanks face and fire only to the
  right, Right tanks only to the left; no angle reaches straight up or backwards, and driving
  either way never turns a tank around.

  Good grip comes with lighter damage: no B build with more than 1.0 damage has better than Low
  grip.

  Each player also sets a name (up to 10 characters) and a colour; choices are remembered on this
  device; on one device two players' colours MUST differ.
- **FR-008**: Player 1 / the host MUST be able to pick a map or Random. Maps:
  - **Green Hills** — grassy dirt hills only.
  - **Timber Gap** — dirt hills with 1–2 deep gaps crossed by wooden bridges.
  - **Lake Valley** — dirt hills with 1–3 lakes in the dips.
  - **Frost Ridge** — hills with 1–3 snow areas, some with ice patches.
  Each game the battlefield MUST be generated afresh: a random number of hills (2 to 6), each of
  random height but never higher than about half the battlefield's height, and the map's snow,
  water or gap areas random in number (within the ranges above), size and place. Water MUST NOT be
  under or right next to any tank's starting spot.
- **FR-009**: On every map, every kind of ground (earth, snow, ice, wood) MUST break when a shell
  blast reaches it, and blasts MUST be able to cut all the way through to the bottom of the
  screen; wood breaks more easily (a bigger piece per blast). When ground under a tank goes, the
  tank drops onto what is left below. It is destroyed at once if it was on wood, if it drops into
  water, or if nothing is left beneath it (it falls out of the bottom of the screen).
- **FR-010**: Tanks MUST NOT drive into water; shells that land in water do nothing.
- **FR-011**: A tank MUST slide only in two cases: a short way on after the drive key is let go
  (on any ground, longest on ice, shortest on earth), and, on snow or ice, a short way back from its
  cannon's direction when it fires. The distance is set by its type's grip (FR-007: High stops dead,
  Medium a little, Low a bit — never more than about a tank's length). A tank that is standing still and not firing MUST NOT
  slide, even on a slope. Sliding never takes a tank into water; it stops at the edge.
- **FR-012**: Computer tanks MUST play at a chosen difficulty: Easy (big aiming errors), Normal
  (default), Hard (nearly exact aim). Picked by player 1 offline and by the host
  online; remembered on this device.
- **FR-013**: Controls: keyboard — ←/→ drive, ↑/↓ cannon angle, Q/E (or −/+) power, Space fire;
  the same keys for whoever's turn it is. Touch: on-screen buttons to drive and tilt, a power
  slider and a Fire button. No mouse-only or hover-only controls.
- **FR-014**: Online MUST work the same way as Turbo Tumble's lobby (room list, Host a room with
  size 2 to 10, join by list, code or link, waiting room with player list, 60-second countdown,
  Start/Cancel/Leave, host hand-over, waiting again after each battle). Rooms never mix with
  other games' rooms. The host's map, tank count and difficulty choices are shown to everyone.
- **FR-015**: Online, every device MUST agree on the battlefield, every shot, holes, hearts, turn
  order and the winner, and show the same turn countdown (within 1 second).
- **FR-016**: Online, when a player leaves or drops during a battle, a computer MUST take over
  their tank (keeping its hearts, bonuses and turn order) at the room's difficulty, and every
  screen MUST say so. If it was that tank's turn, the computer plays it. If the player rejoins the
  room before the battle ends, they MUST get their tank back from its next turn (a tank already
  destroyed stays destroyed and they watch). The battle goes on until a side has no tanks left.
  A rejoining player is recognised by the private rejoin key their device got when it joined the
  room (kept on that device until the battle ends); nobody else can claim the tank.
- **FR-017**: When online play isn't available the game MUST say so within 5 seconds and keep
  1 Player and 2 Players usable.
- **FR-018**: The game's name, look and art MUST be original; sounds follow FR-024 (made by the game or credited free clips, never taken from another game). Tanks MUST follow the "Tank
  look" in Style: chunky cartoon tanks, one distinct silhouette per tank type, painted in the
  player's colour, in the garage preview and on the battlefield.
- **FR-019**: A life panel MUST stay on screen during every battle, in every mode, listing every
  tank grouped by side (Left, Right): its colour, name, tank type and hearts left, drawn as hearts
  (partly filled for fractions) and as a number to one decimal place. The tank whose turn it is
  MUST be highlighted and destroyed tanks marked as destroyed. It MUST update the moment hearts
  change, and online every player's panel MUST show the same values. It MUST also show an icon for
  each air-drop bonus a tank is holding (FR-021). On the battlefield, each tank still in MUST show
  its name and a small health bar (hearts left out of its starting hearts, in the tank's own colour)
  just above it, moving with it and updating with the panel.
- **FR-023**: The active tank (the one whose turn it is, which alone can move and fire) MUST be
  highlighted on the battlefield, in every mode: a bobbing arrow above its health bar (no outline
  or circle), shown from the start of its turn until it fires or the
  countdown runs out, and on no other tank. It is highlighted in the life panel at the same time.
- **FR-020**: After every round (each tank still in has had one turn), one crate MUST drop by
  parachute at a random spot, drifting slowly down over a few seconds while play goes on, and stay
  where it lands until picked up or destroyed. At most 3 crates at once. A tank collects a crate by
  driving onto it on its turn or by the crate landing on it. A shell blast destroys a crate; a crate
  in water is lost.
- **FR-021**: A crate MUST hold one of these, picked at random with these chances:

  | Drop | Chance | Effect |
  |------|--------|--------|
  | Drop | Chance | Effect | On the battlefield |
  |------|--------|--------|--------------------|
  | Repair kit | 35% | +1 heart, up to the tank type's starting hearts | A heart rises from the tank and fades out above it |
  | Power shell | 25% | Next shot does 1.5× damage, then back to normal | A shining golden ring around the tank until it fires |
  | Grip gear | 25% | High grip (no sliding) until the end of the next round | The tank's wheels turn shiny gold while it lasts |
  | Shield | 5% (rare) | Blocks all damage from the next blast that reaches the tank, then used up; doesn't stop a fall off wood or into water | The tank's outline turns shiny gold until it's used |
  | Missile | 10% | Next shot is a missile: it flies 1.5× as fast (over twice as far) and does 2× damage (3× with a power shell too) | A missile sits on top of the tank; the shot flies as a missile with a flame |

  A tank holds at most one of each (power shell, shield, missile) at a time.
- **FR-022**: Computer tanks MUST go for crates within reach on their turn when it doesn't stop them
  firing, and online every device MUST see the same crates, contents and pick-ups.
- **FR-024**: The game MUST play sound effects for: a tank firing; a tank moving (an engine rumble
  while it drives, stopping when it stops); an explosion (also when a crate is blown up); an air
  drop landing; and a fanfare when a battle is won (a softer tune for a loss or draw). Online,
  every device plays them for every tank's actions. A tank destroyed by a blast (not by a fall) MUST
  get a bigger, burning explosion instead of the plain one. Firing, driving, blasts and a tank
  destroyed MUST use these recorded clips from freesound.org: "tracked vehicle.wav" (cognito
  perceptu, CC0) for driving, "Tank fire Mixed.wav" (GaryQ, CC0) for firing, "10091 water bomb
  exploding.wav" (Robinhood76, CC BY-NC 4.0) for blasts and "Exploding Car (with Fire) (Mixed)"
  (EvanBoyerman, CC BY-NC 3.0) for a tank destroyed, "gewonnen.mp3" and "Verloren.mp3"
  (Kastenfrosch, CC0) for winning and losing; the garage MUST credit them all (title, author,
  link, licence), and because two are non-commercial the game MUST stay free with no ads. Other
  sounds are made by the game. No sound is taken from another game. Sounds start only after the player's first tap or key press (browser rule), and
  a mute button MUST silence them all, remembered on this device.
- **FR-026**: The garage MUST offer a Style switch at the top of its panel: Normal (default) or Arcade,
  remembered on this device and applying to this device only. Arcade MUST draw pixel-art tanks (one
  sprite per type in the player's colour, cannons at the tank's angle, bonuses shown as in FR-021),
  pixel-art scenery and ground for every map, a pixel font with square bevelled buttons and panels,
  and play retro sounds made by the game instead of the recorded clips. Gameplay is the same in both.
- **FR-025**: A tank destroyed by losing its hearts MUST leave a steel wreck in its place. A wreck
  MUST take no damage and never be pushed by blasts; shells explode on it as on ground; tanks
  can't drive or slide through it and crates rest on it. It has no hearts, no turns and no health
  bar, and doesn't count towards its side for winning. When the ground beneath it goes, it MUST
  drop onto what is left, or fall out of the bottom of the screen and disappear if nothing is left;
  a wreck that drops into water sinks and disappears. A tank destroyed by falling (off wood, into
  water or out of the screen) leaves no wreck.

### Key Entities

- **Battlefield**: the map picked, the ground shape (dirt, wood, snow, water areas).
- **Map**: name, its features (dirt, wooden bridges, lakes, snow, ice) and their allowed counts;
  each game's battlefield is generated from it (number and heights of hills, feature areas).
- **Tank type**: name, hearts, grip, speed; per build (A, B, C): cannon angle range, damage per
  hit, top power.
- **Side**: Left or Right; its tanks.
- **Tank**: side, owner (player 1, player 2, an online player, or computer), type, name, colour,
  type and build, position, tilt, facing (fixed by side: Left faces right, Right faces left), cannon angle, power, hearts left (may be fractional),
  destroyed or not.
- **Wreck**: what's left of a tank destroyed by losing its hearts: position and look (blackened);
  indestructible, falls only when the ground beneath it goes.
- **Shell**: position, speed and direction, damage, who fired it.
- **Battle**: tanks in turn order, whose turn, round number, turn countdown,
  crates on the battlefield, winner.
- **Round**: one pass of the turn order in which every tank still in has had one turn; an air drop
  follows each.
- **Crate (air drop)**: position, falling or landed, contents (repair kit, power shell, grip gear,
  shield).
- **Bonus held by a tank**: power shell (until its next shot), grip gear (until the end of the next
  round), shield (until the next blast that reaches it).
- **Room (online)**: size 2–10, players, and the host's choices (map, tank count, difficulty).
- **Settings (per device)**: tank type and build, name and colour for players 1 and 2, map, tank count,
  difficulty, sound on/off.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can fire their first shot within 20 seconds of opening the page.
- **SC-002**: Shells and falling tanks move smoothly (no visible stutter) with 10 tanks on the
  battlefield on the devices Turbo Tumble supports.
- **SC-003**: Online, every player sees the same holes, hearts and winner in 100% of battles.
- **SC-004**: Online, a shot fired by one player starts on everyone else's screen within half a
  second on a normal home connection.
- **SC-005**: A computer tank takes its turn within 3 seconds.
- **SC-006**: When online play fails, 1 Player and 2 Players still work every time.

## Assumptions

- "Like Scorched Earth" means the side-view, turn-based artillery genre; the game is original.
- "Similar to Turbo Tumble" means the same site structure: modes, garage, online lobby (not 3D
  racing). The battlefield is drawn in 2D from the side.
- Online is included because the request mentions "the host"; rooms hold 2 to 10 players, matching
  the 10-tank limit.
- One weapon per tank (its normal shell, boosted only by a power shell crate); no shop, money or
  special weapons in this version.
- A battle is one game, played over as many rounds as it takes: the last side standing wins, then
  "Play again". No match scores across battles, no accounts and no online leaderboard.
- "Randomly placed on the map's left or right" means each tank starts at a random spot within its
  own side's half; which players are on which side follows FR-006.
- Air drop chances, the 1.5× power shell and the 3-crate limit are first guesses, to be tuned.
- Dropping onto earth, snow or ice that is still there does no damage; only falling off wood, into
  water or out of the bottom of the screen destroys a tank.
- Tank types are balanced against each other by trading angle range, damage, reach, hearts, grip
  and speed (FR-007);
  the exact numbers can be tuned during planning.
- Sound effects are short and simple (FR-024); there is no background music.
- Opening the game with `?seed=<number>` fixes the battlefield shape, tank positions and air
  drops (where and what) in
  1 Player and 2 Players so a game can be replayed and tested exactly; it is ignored online.
