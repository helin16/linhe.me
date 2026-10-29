# Tasks: Tank Clash

**Input**: Design documents from `/specs/007-tank-artillery/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages.md,
contracts/relay-rejoin.md, quickstart.md

**Tests**: required by the constitution (VII): unit tests with 100% function coverage for every pure
module (`tank-clash/{seed,settings,tanks,terrain,sim,bots,messages}.ts`, the relay change, the lobby
additions), Playwright e2e against the production build for every acceptance scenario, relay e2e for
rejoin and isolation. No test-only code ships: browser tests set up exact situations with `?seed=`
(research R12) and real input. Write each test first and see it fail.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 solo, US2 two on one device, US3 garage, US4 maps, US5 air drops, US6 online,
  US7 on the site

---

## Phase 1: Setup

- [X] T001 In `src/games/index.ts` add `GameSlug.TankClash = 'tank-clash'` and its `games` entry (name "Tank Clash", summary, description mentioning turn-based tank battles on destructible hills, 1–2 players and online up to 10, `homeTag: '1–2 players · Online up to 10 · iPad ready'`, `tag: 'Keyboard or touch · 1–2 players · online up to 10'`, `art: '💥'`, `load: () => import('./tank-clash/index.tsx')`); create `src/games/tank-clash/index.tsx` like `snake-duel/index.tsx` (title "Tank Clash", `mount` from `./game.ts`, `./game.css`) and a stub `game.ts`/`game.css` so the route builds
- [X] T002 [P] In `package.json` add `--test-coverage-include` for `src/games/tank-clash/{seed,settings,tanks,terrain,sim,bots,messages}.ts`; register the new enums (T003) in `src/no-stray-literals.test.ts`

---

## Phase 2: Foundational (blocking)

- [X] T003 [P] Create `src/games/tank-clash/constants.ts` (research R13: `WORLD_W = 1600`, `WORLD_H = 900`, `CELL = 4`, `STEP_HZ = 60`, `TURN_MS = 30_000`, `FUEL = 160`, `MAX_CLIMB_DEG = 50`, `GRAVITY`, `POWER_SCALE`, `WIND_MAX`, `BLAST_R = 40`, `WOOD_BLAST_FACTOR = 1.5`, `SLIDE = 24`, `ICE_SLIDE_FACTOR = 1.3`, `TANK_W = 48`, `HILLS_MIN = 2`, `HILLS_MAX = 6`, `HILL_MIN_H = 0.2`, `HILL_MAX_H = 0.5`, `CRATE_FALL_MS = 4000`, `MAX_CRATES = 3`, `DROP_CHANCES` {Repair 35, Power 30, GripGear 30, Shield 5}, `POWER_SHELL_FACTOR = 1.5`, `REPAIR = 10` (tenths), `TANK_COUNTS = [2,4,6,8,10]`, `DEFAULT_TANKS = 2`, `ROOM_SIZES = [2..10]`, `DEFAULT_ROOM_SIZE = 2`, `COUNTDOWN_MS = 60_000`, `POSE_HZ = 15`, `DIFFICULTY` table {aim error per level}, `SEED_QUERY = 'seed'`, `GRIP_SLIDE` {High 0, Medium 0.5, Low 1}) and `enums.ts` (`TankType` Scout/Allrounder/Heavy/Artillery, `MapId` GreenHills/TimberGap/LakeValley/FrostRidge/Random, `Material` Air/Earth/Snow/Ice/Wood/Water, `Side` Left/Right, `Grip` High/Medium/Low, `Drop` Repair/Power/GripGear/Shield, `Difficulty` Easy/Normal/Hard, `Phase` Aim/Flight/Settle/Over, `TankMsg` look/mode/begin/turn/pose/fire/settle/drop/over/hand/sync), as const objects + union types
- [X] T004 [P] Write `tanks.test.ts`, then `src/games/tank-clash/tanks.ts`: the tank table, hearts and damage in tenths — Scout 0°–85°, damage 8, hearts 30, High grip; Allrounder (default) 10°–75°, 10, 40, Medium; Heavy 30°–65°, 15, 50, Low; Artillery 30°–80°, 18, 30, Low; a test asserts "no tank with more than 1.0 damage has better than Low grip" and every angle is within 0–85 (never straight up or backwards)
- [X] T005 [P] Write `seed.test.ts`, then `src/games/tank-clash/seed.ts` (research R12): `seeded(n)` repeatable random source; `gameSetup(url, online)` reads `?seed=<number>`, ignored online; a unit test pins layouts the browser tests rely on: seed 1 (Green Hills, 2 tanks) has open ground between the tanks and a known winning angle/power for the Left tank with the first wind; others added by later stories
- [X] T006 [P] Write `settings.test.ts`, then `src/games/tank-clash/settings.ts`: `Look` "name up to 10 characters; blank shows 'Player N'", `color` `#rrggbb`, `type` from `TankType` (default Allrounder), online `side`; `fixLook` cleans field by field to defaults; `loadSettings`/`saveSettings` under one storage key with `{p1, p2, map (default Random), tanks (2|4|6|8|10, default 2), difficulty (default Normal), muted}`; P2's colour changes when it equals P1's
- [X] T007 Write `terrain.test.ts`, then `src/games/tank-clash/terrain.ts` core (research R2, R3): a `Uint8Array` grid of `WORLD_W/CELL × WORLD_H/CELL` cells of `Material`; `generate(random, map, slots)` for Green Hills: `HILLS_MIN`–`HILLS_MAX` peaks at random x, heights `HILL_MIN_H`–`HILL_MAX_H` of `WORLD_H`, cubic Hermite curves using only + − × ÷ (no `Math.sin`/`pow`); `startSpots(random, side counts)` — random x in each side's half, flat enough, not touching another tank, never on or within one tank width of water, retry with the next seed up to 20 times then fall back to Green Hills; `carve(x, y, r)` clears cells within r (never water), all the way to the bottom row; `supportUnder(x, width)` → highest solid cell and its material, or null; `surfaceAt(x)`; tests: same seed → identical grid, no hill above 50%, carve reaches the bottom, floating ground stays
- [X] T008 Write `sim.test.ts`, then `src/games/tank-clash/sim.ts` core (research R4, R5): `createBattle(random, map, tanks)` places Left/Right tanks at start spots, Left facing right, Right facing left; turn order per round: alternate Left, Right while both have tanks to play, then the bigger side's rest (Left 1 vs Right 3 → L, R, R, R); `step(battle, input, dt)` at `STEP_HZ`: driving by ←/→ along the surface within the tank's half (stops at the middle line, screen edge, another tank, water, slopes steeper than `MAX_CLIMB_DEG`; uses `FUEL`), angle clamped to the type, power 0–100; `fire` → shell with gravity and the turn's wind, explodes on solid cell or tank, lost off the sides/bottom or in water, flies on above the top; blast carves and takes the firer's damage (tenths) from every tank in radius, teammates and itself included; hearts ≤ 0 → destroyed, leaving a wreck (FR-025: `alive = false`, takes no damage, never pushed, solid to shells and to driving/sliding tanks, crates rest on it, no turns, not counted for winning); after the blast, support checks for tanks and wrecks: drop onto remaining ground (no damage), nothing beneath → falls off (a tank is destroyed with no wreck; a wreck disappears, `gone`); turn ends on shot settled or `TURN_MS` timeout (no shot); battle over when a side is empty (both empty after one shot = draw), no round or time limit. Tests for every rule, including the countdown pause hook for hidden tabs

**Checkpoint**: `yarn test` at 100% functions.

---

## Phase 3: User Story 1 - Battle computer tanks solo (P1) 🎯 MVP

**Goal**: 1 Player, 2–10 tanks, turns, shots, damage, life panel, winner.

**Independent test**: quickstart step 3.

- [X] T009 [P] [US1] Write `e2e/tank.spec.ts` part 1 against the production build: page loads with no console errors; 1 Player at `?seed=1` starts → two tanks, wind shown, life panel lists both with hearts, a name and health bar above each, the active tank glowing with an arrow, a 30 s countdown; ↑/↓ changes the angle shown and stops at the type's limits; ←/→ drives and stops at the middle line; Space fires → a fading trail, a hole; seed 1's winning angle/power hits → the enemy's hearts drop by the damage in panel and bar; destroy it → its blackened wreck stays where it stood, and "You win" and "Play again"; a pinned seed with a wreck: a shell landing on it explodes but the wreck stays; digging out the ground under it → it falls off the screen and disappears; leaving the countdown to run out passes the turn; 6 tanks → 3 per side, turns alternate sides; frame times sampled for 3 s average 50 fps or better in Chromium (SC-002); from page load, 1 Player → Start → Space fires within 20 s (SC-001); the mute button toggles, stays muted after reload, and driving/firing/exploding/winning with sound on raise no console errors (FR-024). Confirm it fails
- [X] T010 [P] [US1] Write `bots.test.ts`, then `src/games/tank-clash/bots.ts` (research R8): `botTurn(battle, tank, level, random)` → `{moveTo, angle, power}`: nearest living enemy, search angle (within the type's limits) and power by simulating the flight with the real wind, pick the closest landing, add the `DIFFICULTY` error (Easy large, Normal medium, Hard almost none); the flight search uses `sim.ts`'s own shell flight code, so ground and wrecks block simulated shots exactly as real ones (FR-025); the whole computer turn, driving included, takes at most 3 s (SC-005), with driving capped at 1.5 s. Tests with a seeded random for each level
- [X] T011 [US1] Create `src/games/tank-clash/draw.ts`: field scaled to fit the screen with no scrolling; sky, clouds and distant scenery per map; ground from the grid in an offscreen canvas repainted only where blasts change it (grass strip on earth tops); tanks drawn from paths per type in the "Tank look" style (chunky tracks with road wheels, armour plates, rivets, exhaust, big cannon; Scout small on big wheels, Allrounder one turret, Heavy wide with twin cannon, Artillery long barrel) filled with the tank's own colour and a dark outline, facing its enemy; name and health bar above each tank in its own colour; active tank glow and bobbing arrow (FR-023); wrecks drawn as blackened, smoking hulls with no name or health bar (FR-025); shell trail fading from tank end to shell; cartoon explosion with smoke; off-top marker; wind arrow and number; the life panel by side (colour, name, type, hearts drawn partly filled plus number to one decimal, active highlighted, destroyed marked, bonus icons), collapsible to a strip on phones; original art only (FR-018)
- [X] T012 [US1] In `src/games/tank-clash/game.ts`: `mount(root)` with the mode picker, tank count picker (2/4/6/8/10), difficulty, `gameSetup` from `seed.ts`; 1 Player loop (fixed `STEP_HZ` steps, interpolated drawing), keys (←/→ drive, ↑/↓ angle, Q/E and −/+ power, Space fire), touch controls (◀ ▶, ▲ ▼, power slider, Fire), computer turns via `bots.ts`, countdown, win/draw screen, "Play again", pause on hidden tab, sounds from `sound.ts` (T013) on drive start/stop, fire, blast, crate landing and battle end, mute button saved in settings; cleanup on unmount like Snake Duel; T009 passes
- [X] T013 [US1] Create `src/games/tank-clash/sound.ts` (research R14, FR-024): Web Audio, no audio files; audio context starts on the first tap or key press; one master gain muted by the mute setting; `fire()` short low thump, `engine(on)` looped low rumble faded in/out while a tank drives, `boom(size)` filtered noise burst scaled by blast size, `crateLand()` wooden clunk, `win()` rising four-note fanfare, `lose()` short falling tune (loss or draw); `dispose()` closes the context on unmount; all sounds original
- [X] T014 [US1] Style in `src/games/tank-clash/game.css` (scoped `.tc`, phone width, safe-area insets, controls clear of the life panel, no scrolling in either orientation)

---

## Phase 4: User Story 2 - Two players on one device (P1)

**Goal**: hot-seat play; player 1 Left, player 2 Right, computer teammates fill sides.

**Independent test**: quickstart step 6.

- [X] T015 [P] [US2] Add to `e2e/tank.spec.ts` part 2: 2 Players at `?seed=1` → player 1's tank on the left goes first, the screen names whose turn it is; only the active player's keys act; player 1 destroys player 2 → "Player 1 wins"; 6 tanks → each side has its player plus 2 computer tanks; a side wins with a computer tank left even if its player's tank was destroyed. Confirm it fails
- [X] T016 [US2] In `game.ts`: 2 Players mode (player 1 = Left, player 2 = Right, computer tanks fill both sides), turn banner with the active player's name and colour, input only during that player's turn; T015 passes

---

## Phase 5: User Story 3 - Choose and customise your tank (P1)

**Goal**: garage with tank type, name, colour, live preview and four stats; P1/P2 tabs.

**Independent test**: quickstart step 2.

- [X] T017 [P] [US3] Add to `e2e/tank.spec.ts` part 3: garage → pick Heavy → preview changes, stats show 5 hearts, 1.5 damage, 30°–65°, Low grip; set name and colour → preview updates; reload → kept; start → the tank looks the same and has 5 hearts; 2 Players with the same colour → player 2's changes with a note; a name `<b>x</b>` shows as typed. Confirm it fails
- [X] T018 [US3] In `game.ts`: the garage panel like Snake Duel's (type option buttons, name input max 10, colour picker, P1/P2 tabs in 2 Players), live preview drawn with `draw.ts`'s tank function, stats from `tanks.ts`, saved via `settings.ts`; T017 passes

---

## Phase 6: User Story 4 - Pick the map (P1)

**Goal**: four maps plus Random, each generated afresh; wood, water, snow and ice rules.

**Independent test**: quickstart step 5.

- [X] T019 [P] [US4] Extend `terrain.test.ts`, then `terrain.ts`: Timber Gap (1–2 gaps cut to the bottom, each crossed by a 2-cell wood bridge), Lake Valley (1–3 water pools filling the lowest dips), Frost Ridge (1–3 snow areas as top layers, some with ice patches), Random resolves to one of the four; wood carves within `BLAST_R × WOOD_BLAST_FACTOR`; water never under or within one tank width of a start spot; tests per map that counts stay in range and that the same seed gives the same map
- [X] T020 [P] [US4] Extend `sim.test.ts`, then `sim.ts`: a tank whose support was wood when it went → destroyed at once (any hearts); dropping into water → destroyed; driving stops at the water's edge; snow/ice sliding only after driving stops (on) and when firing (back from the cannon), `SLIDE × GRIP_SLIDE[grip]`, × `ICE_SLIDE_FACTOR` on ice, capped at `TANK_W`, stopping at the middle line, other tanks and water; a parked tank never slides
- [X] T021 [US4] Add to `seed.ts` pinned seeds (Timber Gap with a tank on a bridge; Lake Valley with a tank near water; Frost Ridge with a Heavy and a Scout on snow) and add `e2e/tank.spec.ts` part 4: map picker → each map's name shows at start; shoot the bridge under a tank → it falls and is destroyed; a tank stops at the water; (tank positions are not on the page, so sliding, the water edge and digging through are covered by sim unit tests); draw snow caps, water pools and plank bridges in `draw.ts`; the picker in `game.ts`

---

## Phase 7: User Story 5 - Air drops (P2)

**Goal**: a crate after every round with one of four bonuses.

**Independent test**: quickstart step 4.

- [X] T022 [P] [US5] Extend `sim.test.ts`, then `sim.ts` (research R7): after a round's last turn, if fewer than `MAX_CRATES`, a crate at a random x with contents by `DROP_CHANCES`, falling over `CRATE_FALL_MS` while play goes on; collected by a tank touching it (driving, sliding, dropping, or the crate landing on it); destroyed by any blast; rests on ground or on a wreck and uses the same support check as tanks, so it drops with them when what is under it goes; lost in water or off the bottom; Repair +`REPAIR` up to the type's hearts (wasted at full); Power: next shot does `Math.round(damage × POWER_SHELL_FACTOR)` tenths (halves round up: Heavy 15 → 23 = 2.3), then normal; Grip gear: High grip until the end of the next round; Shield: blocks all damage from the next blast that reaches the tank, not falls; at most one power shell and one shield held
- [X] T023 [P] [US5] Extend `bots.ts`: drive to a crate in reach in the tank's own half when fuel allows, then aim (FR-022); test it
- [X] T024 [US5] Pin a seed whose first crate is a repair kit near the player in `seed.ts`; add `e2e/tank.spec.ts` part 5: after one round a crate floats down; drive onto it → "Repair kit!" and hearts +1 in the panel; bonus icons show in the panel until used; draw crates with parachutes and bonus icons in `draw.ts`

---

## Phase 8: User Story 6 - Play online (P2)

**Goal**: shared lobby rooms of 2–10, random sides with switching, host picks, runner-settled
battles, computer takeover and rejoin.

**Independent test**: quickstart step 8.

- [X] T025 [P] [US6] Relay rejoin (contracts/relay-rejoin.md): extend `relay/rooms.test.ts`, `relay/protocol.test.ts` and `relay/relay.e2e.test.ts` first, then `relay/protocol.ts` (`Hello.key`, `KEY_QUERY = 'key'`, `parseRelayPath` returns `key`), `relay/rooms.ts` (a random 16-character key per slot; leave while locked → slot reserved for its key and skipped by new joins and counted as taken in `list`; join a locked room with a matching key → same slot, new key, others get `join`; wrong/missing key → `started`; reservations dropped on `room-open` or when the room empties) and `relay/server.ts`; tests also confirm keys from another room or game fail and isolation holds
- [X] T026 [P] [US6] Extend `src/shared/online/client.ts` (+ test): `connect(..., {key})` adds `?key=`; `NetText.Started` becomes the game-neutral "That game has already started" (update its test); extend `src/shared/online/lobby.ts`: optional `rowTag(slot)` label on player-list rows, and a "Rejoin battle" button in the popup when the game reports a saved key for a room; Turbo Tumble and Snake Duel pass neither and look the same
- [X] T027 [P] [US6] Write `messages.test.ts`, then `src/games/tank-clash/messages.ts` per contracts/messages.md: parse and validate every message type (≤10 tanks, ≤3 crates, ≤200 blasts per `sync` chunk, finite numbers inside the field, angles within the type's limits, looks cleaned with `fixLook`); `allowedFrom(type, from, runner, host, activeOwner)`; `sidePlace(looks, tanks, side)` (a side holds at most `tanks/2`); `randomSide(looks, random)` keeping player counts within one
- [X] T028 [US6] Add to `e2e/tank.spec.ts` part 6 (two and three browsers, local relay): Online lists only Tank Clash rooms; host a room of 4 → each player's row shows Left/Right; a player switches side (refused when full); host changes map/tanks/difficulty → everyone sees it within 2 s; Start → same battlefield; each fires on their turn and every screen shows the same holes, hearts and winner; turn timeout passes on every screen; the countdowns shown on two browsers differ by at most 1 s (FR-015); a shot fired on one browser appears on the other within 0.5 s on the local relay (SC-004); a full room or one in battle refuses newcomers; closing a guest mid-battle → a computer plays its tank; reopening on that device → "Rejoin battle" → the tank is theirs again from its next turn; relay unreachable → message within 5 s, 1P/2P still work. Confirm it fails
- [X] T029 [US6] In `game.ts`: Online mode with the shared lobby (`game: GameSlug.TankClash`, `sizes: ROOM_SIZES`, `defaultSize: DEFAULT_ROOM_SIZE`, `countdownMs: COUNTDOWN_MS`, `botWord: 'computer tanks'`, `rowTag` = side); waiting-room side switch button and host pickers (map, tank count raised to fit players, difficulty) sending `look`/`mode`; runner role like Snake Duel (`begin`, `turn`, relayed `pose`, `fire`, `settle`, `drop`, `over`, `hand` on hidden tab, lowest slot takes over on leave); the active guest drives and aims locally sending `pose` at `POSE_HZ` and `fire`; a dropped player's tank becomes computer-driven until their key rejoins, then `sync` and hand back from its next turn; store `{code, key}` in local storage on `hello` (survives closing the tab) and delete it when the battle ends or the room reopens; T028 passes

---

## Phase 9: User Story 7 - Find the game on the site (P3)

**Independent test**: quickstart step 1.

- [X] T030 [US7] Add to `e2e/home.spec.ts`: the home page shows a Tank Clash card with "1–2 players · Online up to 10 · iPad ready" that opens `/games/tank-clash/`; the games page lists it with its description

---

## Phase 10: Polish

- [X] T031 [P] `README.md`: Tank Clash (modes, controls, tank types, maps, air drops, online sides and rejoin, `?seed=`) and the relay's rejoin key
- [X] T032 Performance tuning (SC-002): 10 tanks, a shell and an explosion hold 60 fps on desktop and the iPad project; profile drawing and carving if T009's frame check is close
- [X] T033 Run `yarn test` (100% functions) and `yarn e2e:local`; confirm Turbo Tumble and Snake Duel online e2e still pass after the relay and lobby changes
- [X] T034 `/code-review` on the diff, also confirming no names, graphics, sounds or text are taken from Scorched Earth, the reference tank games or the hill-climb games (FR-018); fix each finding or note why it was skipped
- [ ] T035 Commit with any waivers; push; CI green (including Firefox)
- [ ] T036 `yarn deploy` (relay included); check quickstart steps 1–10 live

---

## Dependencies & Execution Order

- T001 → T002; T003–T006 in parallel; T007 after T003 and T005; T008 after T004 and T007 → US1 →
  US2 → US3 → US4 → US5 → US6 → US7 → Polish
- US2–US6 all add to `game.ts`, so their game tasks run one after the other; their tests and pure
  module work (marked [P]) can be done ahead in parallel
- In US6, T025 (relay), T026 (shared lobby) and T027 (messages) are independent of each other;
  T029 needs all three

## Parallel Example

```text
T003 constants/enums, T004 tanks, T005 seed, T006 settings   # Phase 2, different files
T009 e2e part 1, T010 bots                                   # US1
T019 terrain maps, T020 sim map rules                        # US4
T022 sim crates, T023 bots crates                            # US5
T025 relay rejoin, T026 shared lobby, T027 messages          # US6
```

## Implementation Strategy

1. MVP = Phases 1–3: Tank Clash playable solo against computer tanks on Green Hills.
2. Add two players on one device (US2), the garage (US3) and the other maps (US4).
3. Add air drops (US5), then online with rejoin (US6) and the site card (US7); polish, review,
   commit, deploy.
