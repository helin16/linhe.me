# Research: Tank Clash

## R1. Drawing: 2D canvas, no new dependency

- **Decision**: one `<canvas>` with the 2D context and a fixed world of 1600 × 900 units, scaled to
  fit the screen (letterboxed, never scrolled). The ground is kept in an offscreen canvas that is
  repainted only in the cells a blast changes; sky, clouds and distant scenery are a few gradient
  and path layers per map. Tanks are drawn from canvas paths (one drawing function per tank type:
  tracks with road wheels, armour plates with rivets, exhaust, cannon), filled with the player's
  colour and a dark outline, so the garage preview and the battlefield use the same code.
- **Rationale**: side view on one screen (spec Style); the 2D canvas is native and fast enough for
  10 tanks, one shell and an explosion on phones; drawing tanks from paths gives original art with
  no image files to source (FR-018).
- **Alternatives**: three.js (nothing gained in 2D); bitmap sprites (art to commission, and colour
  tinting is harder than filling paths).

## R2. Ground: a cell grid, carved by blasts

- **Decision**: the ground is a `Uint8Array` grid of 4-unit cells (400 × 225), each cell one of
  `Air`, `Earth`, `Snow`, `Ice`, `Wood`, `Water`. A blast clears every cell within its radius
  except water (water is static, no flowing — `ponytail:` water never moves; add flow only if
  owners ask for it); wood cells clear within a 1.5× radius. Holes may reach the bottom row, so a
  column can be empty all the way down. Ground left floating stays put (spec).
- **Tank support**: a tank rests on the highest solid cell under its track footprint. After every
  blast each tank is checked: still supported → stays; support gone but solid cells below → drops
  (no damage); nothing solid below → falls out of the screen and is destroyed; it was resting on
  wood when its support went → destroyed; lands in water → destroyed.
- **Wrecks** (FR-025): a tank whose hearts reach 0 stays in the tank list with `alive = false` and
  becomes a wreck: same footprint, drawn blackened, no health bar. Blasts never damage or move it;
  shells and driving/sliding tanks treat its footprint as solid; crates rest on it. It uses the same
  support check as tanks: it drops onto remaining ground; nothing below, or water → removed
  (`gone = true`). A tank destroyed by falling is `gone` at once (no wreck).
- **Rationale**: a grid gives exact, deterministic carving with integer maths (R6), gaps to the
  bottom, and cheap support checks.
- **Alternatives**: a height line per column (can't hold bridges, floating ground or holes under
  overhangs).

## R3. Battlefield generation

- **Decision**: `terrain.ts` builds the grid from a seed and a map: 2–6 hill peaks at random x,
  heights from 20% to 50% of the world height (never higher, FR-008), joined by smooth curves made
  with additions and multiplications only (cubic Hermite between control points — no `Math.sin`,
  `Math.pow` or other library maths whose last digits can differ between browser engines). Then the
  map's features:
  - Green Hills: earth with a grass strip (drawn, not a material).
  - Timber Gap: 1–2 deep gaps cut to the bottom, each crossed by a 2-cell-thick wood bridge.
  - Lake Valley: 1–3 water pools filling the lowest dips.
  - Frost Ridge: 1–3 snow areas (top layer of cells), some with ice patches.
- **Start spots**: each tank gets a random x in its side's half, on flat-enough ground, not on or
  within one tank width of water, not touching another tank. If spots can't be found, the
  generator tries the next seed (at most 20 tries, then falls back to Green Hills) — spec edge case.
- **Rationale**: the same seed must build the identical battlefield on every device (R6); random
  counts, heights and places each game (FR-008).

## R4. Shots, wind, damage

- **Decision**: fixed 60 Hz steps. A shell starts at the cannon tip with speed `power × k` at the
  cannon angle (towards the enemy side only, FR-007), then each step: velocity += gravity + wind;
  position += velocity. It explodes on the first solid cell, tank or wreck it touches; it is lost (no
  effect) when it leaves the sides or bottom or touches water; leaving the top it keeps flying and a
  marker shows its x. Wind is a random value from −max to +max, new each turn, shown as an arrow and
  number.
- **Damage**: every tank whose hull is inside the blast radius loses the firing tank type's damage
  (× 1.5 with a power shell), unless its shield takes the hit. Hearts are stored in tenths (whole
  numbers), so 4 − 1.5 = 2.5 exactly and every device agrees (FR-005). A power shell's damage is
  `Math.round(damage × 1.5)` in tenths — halves round up — so a Heavy's 15 becomes 23 (2.3) on
  every device.
- **Trail**: the shell's last positions are kept and drawn as a line whose opacity rises from 0 at
  the tank end to 1 at the shell; cleared when the shell explodes or leaves (FR-004).
- **Rationale**: simple projectile maths, deterministic; tenths avoid float drift in hearts.

## R5. Turns, rounds, timers

- **Decision**: `sim.ts` keeps the turn order per round: both sides' living tanks in fixed order,
  taken alternately Left, Right while both have tanks still to play, then the rest (FR-006). A
  turn is: driving/aiming (≤30 s), then the shot flies, then everything settles (falls, slides,
  crate drops), then the next turn. The countdown pauses offline when the tab is hidden. After the
  last turn of a round, a crate drop starts (R7). A battle ends when a side has no tanks (draw if
  both empty after one shot); no round or time limit.
- **Driving**: each turn a tank has a fuel budget (units of distance). It moves along the ground
  surface, can't climb slopes steeper than a limit, and stops at the screen edge, the middle line,
  another tank and water. On snow/ice it slides on after stopping and back from the cannon when
  firing, by its grip (High 0, Medium 0.5, Low 1 × a slide distance, ×1.3 on ice, capped at one tank
  length), stopping at the same obstacles (FR-011).

## R6. Online: one runner, deterministic replay of events

- **Decision**: as Snake Duel, one device (the *runner*, first the host) is the authority. Because
  play is turn-based, little needs sending:
  - `begin` carries the seed, map and every tank (owner, type, look, side, start x). Every device
    builds the identical battlefield (R3, integer and + − × ÷ maths only).
  - The active tank's own device drives and aims locally (no input lag) and sends `pose` (x, angle,
    power, fuel) ~15/s; the runner checks it against fuel and the half's bounds and relays its own
    copy in `pose` for everyone else. Computer tanks are driven by the runner.
  - `fire` (from the active device, or the runner for computers) carries x, angle, power and the
    wind. Every device flies the shell itself for smooth drawing and the trail; the runner then
    sends `settle` with the authoritative result: blasts applied, every tank's x, y, hearts, alive
    and bonuses, crates. Devices replace their state with it, so even a drift can't last (SC-003).
  - `turn` starts each turn (tank id, ms left, wind); devices count down between, ≤1 s apart
    (FR-015).
- **Rationale**: tiny traffic (a few messages per turn), well under the relay's 8 KB / 40 per s
  limits; a guest's own driving feels instant; one authority settles every outcome.
- **Runner hand-over**: as Snake Duel — `hand {to}` when the runner's tab is hidden; if the runner
  leaves or drops, the lowest remaining slot takes over from the last `settle` it holds.

## R7. Air drops

- **Decision**: after each round the runner rolls one crate (if fewer than 3 on the field): random x
  over the whole field and contents by the table in FR-021 (35/30/30/5). The crate falls slowly
  (about 4 s from the top), is destroyed by any blast, is lost in water or off the bottom, and is
  collected by a tank touching it (driving, sliding, dropping onto it, or it landing on the tank).
  Contents are hidden until picked up. Online the crate's x and contents come in the runner's
  `drop` message; pick-ups are confirmed in `settle`.

## R8. Computer tanks

- **Decision**: `bots.ts` picks the nearest living enemy, then searches angle and power for a shot
  that lands closest, simulating the shell with the real wind (the same flight code as R4). Easy
  adds a large random error to angle and power, Normal a medium one, Hard almost none. Before
  aiming, a bot drives to a crate in reach in its own half if one is there and fuel allows
  (FR-022). Its whole turn — driving included — takes at most 3 s (SC-005): driving to a crate is capped at 1.5 s, then it aims and fires. Its aim search uses the same shell flight code as real shots, so wrecks and ground block its shots as they really would. Teammate bots use the same difficulty.
- **Rationale**: simple, deterministic given the seeded random source, unit-testable.

## R9. Online sides, switching and rejoining (relay change)

- **Sides**: each player's side is part of their `look` message. A joining player picks a random
  side that keeps the sides within one player of each other; a player switches by sending a new
  `look` with the other side, accepted by everyone only while that side has a free place (half the
  tank count). The host's `mode` message (map, tank count, difficulty) can raise the tank count to
  fit the players. Sides are fixed at `begin`.
- **Rejoin (FR-016) needs a small relay change**, because the relay refuses joins to a locked room
  (`4423 Started`), and slots are reused:
  - the relay's `hello` gains a random `key` for that slot;
  - when a player leaves a *locked* room, the relay keeps their slot reserved for their key until the
    room reopens (reserved slots are skipped for new joins);
  - `/relay/<game>/<code>?key=<key>` joins a locked room only if the key matches a reservation, and
    gets that same slot back (the others get the usual `join`).
  The game stores `{code, key}` in this device's local storage when it gets `hello` (it survives
  closing the tab), and deletes it when the battle ends or the room reopens; the
  Online popup offers "Rejoin battle" for that room. The runner keeps the tank under computer
  control while the slot is empty and hands it back from its next turn, sending the rejoiner a
  `sync` (current state in chunks). Turbo Tumble and Snake Duel ignore `key`, so nothing changes for
  them.
- **Rationale**: the relay stays game-agnostic (a reserved slot is generic); keys are random and
  per-room, so nobody can take another's tank (spec); "same device" is the key in local storage.
- **Wording**: the relay's `4423 Started` message in `src/shared/online/client.ts` changes from
  "That race has already started" to the game-neutral "That game has already started" (Snake Duel
  showed "race" too).
- **Alternatives**: keep the room open during battles and let the game turn newcomers away (they
  would see busy rooms in the list, and a newcomer could take slot 0 and become host mid-battle).

## R10. Shared lobby additions

- **Decision**: two small, optional additions to `src/shared/online/lobby.ts`: a `rowTag(slot)`
  option that adds a label to a player-list row (Tank Clash shows "Left"/"Right"), and passing a
  rejoin key through `connect`. The side-switch button and the host's map / tank count / difficulty
  pickers live in Tank Clash's own garage panel, as Snake Duel does with match type.
- **Rationale**: the lobby stays one shared module (constitution II) with no game-specific code.

## R11. Controls

- **Decision**: keys ←/→ drive, ↑/↓ angle (hold to repeat), Q/E and −/+ power, Space fire; the
  same keys for whoever's turn it is. Touch: ◀ ▶ drive buttons, ▲ ▼ angle buttons, a power slider
  and a big Fire button along the bottom, kept clear of the life panel. Controls are disabled when
  it isn't this device's turn (online) or during a shot.

## R12. Seeded games for tests

- **Decision**: as Snake Duel: `?seed=<number>` fixes the battlefield, wind, start spots and air
  drops in 1 Player and 2 Players; ignored online. No test-only code ships.

## R14. Sound effects

- **Decision**: `sound.ts` makes every sound with Web Audio, like Turbo Tumble (no audio files):
  - **Fire**: a short low "thump" (noise burst through a low-pass filter, falling pitch);
  - **Engine**: a looped low sawtooth rumble with a little wobble, started when a tank begins
    driving and faded out when it stops or its fuel runs out;
  - **Explosion**: a longer noise burst with a falling low-pass filter, louder for bigger blasts;
  - **Crate landing**: a soft wooden "clunk" (short filtered noise plus a low tone);
  - **Win**: a short rising fanfare of four notes; **loss or draw**: a short falling tune.
  The audio context starts on the first tap or key press; one master gain is set to 0 by the mute
  button, saved in settings. Online, sounds are triggered by the same events (`pose` movement,
  `fire`, blasts in the shot, `settle` crate landings, `over`) on every device.
- **Rationale**: original sounds with no assets to source (FR-018, FR-024); Web Audio is native.
  Sound playback is browser-only, so it's covered by e2e (mute button and saved setting, no console
  errors) rather than unit tests (constitution VII).

## R13. Constants

- World 1600 × 900, cell 4; step 60 Hz; turn 30 s; fuel 160 units per turn; max climb 50°; gravity,
  power scale and wind max tuned so a full-power 45° shot crosses the field with no wind; blast
  radius 40 (wood 60); slide distance 24 (× grip, × 1.3 on ice, ≤ one tank length 48); crate fall
  4 s, at most 3; drop chances 35/30/30/5; power shell × 1.5; repair +1 heart; room sizes 2–10;
  tank counts 2/4/6/8/10. All in one constants module (constitution VIII); first guesses to tune.
