# Tasks: Critter Hop

**Input**: Design documents from `/specs/012-creature-checkers/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages.md, quickstart.md

**Tests**: required by the constitution (VII): unit tests at 100% function coverage for every pure
module (`critter-hop/{boards,types,rules,bots,cursor,messages,settings,seed}.ts`), Playwright e2e
against the production build for every acceptance scenario (Chromium, WebKit iPad touch, Firefox),
with no console errors. No test-only code ships: browser tests use `?seed=` (research R9) and real
input. Write each test first and see it fail.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 solo vs computer, US2 2/4/6 on one device, US3 online, US4 turn timer and hints

---

## Phase 1: Setup

- [X] T001 In `src/games/index.ts` add `GameSlug.CritterHop = 'critter-hop'` and its `games` entry (name "Critter Hop", summary "Hop your creatures across a 3D star board.", description mentioning 2, 4 or 6 players, six creature types with type advantages, local and online, `homeTag: '2–6 players · Online up to 6 · iPad ready'`, `tag: 'Mouse, keyboard or touch · 2–6 players · online up to 6'`, `art: '🐾'`, `load: () => import('./critter-hop/index.tsx')`); create `src/games/critter-hop/index.tsx` like `tank-clash/index.tsx` (title "Critter Hop", `mount` from `./game.ts`, `./game.css`) and stub `game.ts`/`game.css` so the route builds
- [X] T002 [P] In `package.json` add `--test-coverage-include='src/games/critter-hop/{boards,types,rules,bots,cursor,messages,settings,seed}.ts'`

---

## Phase 2: Foundational (blocking)

- [X] T003 Create `src/games/critter-hop/enums.ts` as const objects + union types (data-model.md): `CritterType` Fire/Water/Grass/Electric/Psychic/Rock ("sent online: don't change"), `BoardKind` Star/Cross, `SeatKind` Person/Computer, `Difficulty` Easy/Normal/Hard, `HopKind` Step/Hop/LongHop, `GameState` Setup/Playing/Over, `HopMsg` pick/types/begin/turn/move/seat/over/sync, `HopSpeed` Normal/Fast, `Screen` Setup/Play/End, `ResultAction` Again/Menu; register every one in `src/no-stray-literals.test.ts` (home `games/critter-hop/enums.ts`; use an alias such as `HopDifficulty`/`HopScreen`/`HopResultAction` for names other games also export)
- [X] T004 [P] Create `src/games/critter-hop/constants.ts`: `PIECES = 10`, `PLAYER_COUNTS = [2, 4, 6]`, `DEFAULT_PLAYERS = 2`, `STAR_SIDE = 4` (star point rows), `CROSS_CENTRE = 5`, `CROSS_ARM_DEPTH = 4`, `CROSS_HOME_ROWS = 2`, `TURN_MS = 60_000`, `STALL_ROUNDS = 20`, `STALL_WARN = 10`, `COUNTDOWN_MS = 60_000`, `ROOM_SIZES = [2, 4, 6]`, `DEFAULT_ROOM_SIZE = 4`, `BOT_BUDGET_MS = 1000`, bot weights (`REAR_BONUS`, `EASY_TOP = 3`, `EASY_STEP_CHANCE = 0.25`, `BLOCK_BONUS`), `LEADER_SCALE = 1.3`, camera limits, `SEED_QUERY = 'seed'`
- [X] T005 [P] Write `types.test.ts`, then `src/games/critter-hop/types.ts`: `BEATS = { Water: Fire, Fire: Grass, Grass: Rock, Rock: Electric, Electric: Psychic, Psychic: Water }`; `strong(a, b) = BEATS[a] === b`, `weak(a, b) = BEATS[b] === a`; per type: display name, colour (`#rrggbb`), creature shape parts and hop-effect name; tests: the ring is one cycle of all six, each type strong against exactly one and weak against exactly one, a type is never strong against itself
- [X] T006 [P] Write `seed.test.ts`, then `src/games/critter-hop/seed.ts`: `seeded(n)` (mulberry32, as Tank Clash) and `gameSetup(url, online, now)` reading `?seed=<number>` offline only
- [X] T007 Write `boards.test.ts`, then `src/games/critter-hop/boards.ts` (research R1): `star()` → 121 axial-hex holes, 6 `dirs`, 6 clockwise `homes` of 10, `opposite = (h + 3) % 6`; `cross()` → 105 square holes (5 × 5 centre + four arms 5 wide × 4 deep), 8 `dirs`, 4 clockwise homes = the outer 2 rows of each arm (10 holes), `opposite = (h + 2) % 4`; `index` coord → hole, `neighbour(board, hole, dir, d)` → hole or −1, `distance(board, a, b)` (hex metric / Chebyshev); built once and cached; tests: counts 121/105, each home 10 and disjoint, `opposite` an involution, neighbours inside the board
- [X] T008 Write `rules.test.ts`, then `src/games/critter-hop/rules.ts` core (research R2–R3, data-model Game): `newGame({ players: 2|4|6, seats, difficulty, timerMs })` → star for 2 (homes 0 and 3) and 6 (0–5), cross for 4 (0–3), pieces `id = seat * 10 + n`, `leader = n === 0`, `occupant` per hole; `legalMoves(game, piece)` → `{ path, kinds }[]`: single steps to empty neighbours; BFS hop chains with a visited set; per direction scan to the first creature at distance `d`: mover weak against it → no hop; `d = 1` → hop if hole at 2 exists and is empty; `d > 1` and mover strong against it → long hop if the `d − 1` holes beyond are empty and the hole at `2d` exists and is empty; step and hops never mixed; hopped creatures stay; `isLegal(game, seat, piece, path)`; `applyMove` updates holes and `left`, assigns a place when the seat finishes (target full, at least one own creature, the rest opponents' that never left), advances `turn` clockwise skipping finished seats and seats with no legal move (returns a `skipped` note), bumps `round` and `stall` (reset when a creature newly enters its own target), ends at `STALL_ROUNDS` ranking unfinished seats by creatures in target then total distance left (less is better), when one unfinished seat is left, and when no Person seat is still playing; `endNow(game)` for "End game" ranks as the stall rule; tests for every rule incl. the long-hop and blocked-hop examples from spec US1 scenario 6, chains that can't loop, blocking rule, simultaneous finish order, stall ranking
- [X] T009 Write `bots.test.ts`, then `src/games/critter-hop/bots.ts` (research R4): `score(game, move)` = cut in team distance to target plus `REAR_BONUS` for moving the rear-most creature; `botMove(game, random, Difficulty)`: Easy ignores long hops, picks randomly among the top `EASY_TOP`, with `EASY_STEP_CHANCE` a plain forward step; Normal the best move; Hard best of (move + its own best follow-up) plus `BLOCK_BONUS` for taking away the leader's best hop; `hint(game)` and `timeoutMove(game)` = Normal; tests: always legal, seeded results repeat, Normal never moves backwards when a forward move exists, an all-computer 2/4/6 game finishes or stalls within a bounded number of turns, each move under `BOT_BUDGET_MS` on the test machine
- [X] T010 [P] Write `settings.test.ts`, then `src/games/critter-hop/settings.ts` (data-model Settings, key `ch-cfg`): `{ type (default Fire), players (2|4|6, default 2), seats: SeatKind[] (default [Person, Computer, …]), difficulty (default Normal), localTimer (default false), speed (HopSpeed, default Normal), muted (default false) }`, field-by-field fallback, never throws, storage errors ignored

**Checkpoint**: `yarn test` at 100% functions.

---

## Phase 3: User Story 1 — Pick a type and play against the computer (P1) 🎯 MVP

**Goal**: 1 Player: pick 2/4/6 players, strength and a type; play on the 3D board against computer players to a winner.

**Independent Test**: 1 Player, 2 players, Fire: ten Fire creatures and ten of a computer type in opposite points; select, see reachable holes, move; the computer replies.

- [X] T011 [P] [US1] Write `e2e/critter.spec.ts` US1 cases (spec US1 scenarios 1–9): setup flow and taken types, type picker shows name/creature/strong/weak, board per player count (star 2 and 6, cross 4 with `data-board`), select highlights and clears, illegal hole does nothing, move then computer replies, finish banner while play continues, end screen with finishing order and "Play again"/"Menu" — reached by playing the Person's turns with H then Enter on a seeded 2-player game at Fast hop speed until the end screen shows, long-hop highlight and blocked hop on a seeded position, keyboard-only game (arrows/Enter/Escape/Q/E/+/−), touch tap/drag/pinch on WebKit iPad, no console errors, no sideways scroll at phone width
- [X] T012 [P] [US1] Write `cursor.test.ts`, then `src/games/critter-hop/cursor.ts` (research R8): `nextCandidate(from, candidates[{id, x, y}], arrow)` → nearest candidate within 60° of the arrow direction by angle then distance, or `from` if none
- [X] T013 [US1] Create `src/games/critter-hop/scene.ts` (research R7): three.js board slab for star and cross, instanced hole discs, home areas tinted per type, lights and soft shadows; creatures per type from primitives with shared geometries/materials (original designs, FR-020), leader at `LEADER_SCALE` with a crown ring; highlight rings (long hops stronger colour); `animateMove(path, kinds)` hopping along the path with the type's hop effect; `pick(x, y)` via `Raycaster` → creature or hole; `OrbitControls` from `three/examples/jsm/controls/OrbitControls.js` with polar/zoom limits; `face(home)` turns the camera to a home; low-detail fallback via `src/shared/detail.ts`; `softwareGpu`/`texture` from `src/shared/render.ts`; resize handling
- [X] T014 [P] [US1] Create `src/games/critter-hop/sound.ts`: Web Audio blips for select, hop and win, `setMuted`
- [X] T015 [US1] Implement `src/games/critter-hop/game.ts` `mount(root)` for 1 Player: mode buttons from `src/shared/modes.ts`; setup screen (player count 2/4/6, strength, type picker with name, colour, creature, strong/weak, taken types disabled); computer seats get the remaining types (seeded); play screen with turn banner (type name and colour), `aria-live` status line, select/highlight/move with mouse, touch and keyboard (`cursor.ts`), computer turns via `botMove` within `BOT_BUDGET_MS`, skip message, stall counter from round `STALL_WARN`, finish banner (name and place) while play continues, end screen with finishing order and `ResultAction` buttons; hop speed Normal/Fast on setup (`HopSpeed`, Fast ≈ 5× quicker animation, FR-023); `root.dataset.ready`, `data-turn`, `data-board` for tests; saves settings
- [X] T016 [P] [US1] Write `src/games/critter-hop/game.css`: setup, type cards, banner, status, end screen; light/dark via shared tokens, safe-area insets, no horizontal scroll, tap targets ≥ 44 px

**Checkpoint**: US1 e2e green in Chromium and WebKit iPad.

---

## Phase 4: User Story 2 — 2, 4 or 6 players on one device (P1)

**Goal**: local games with any mix of Person/Computer seats; the board faces each person in turn.

**Independent Test**: 4 Players, four types, one move each; banner and board facing follow clockwise order back to player 1.

- [X] T017 [P] [US2] Add US2 cases to `e2e/critter.spec.ts` (spec US2 scenarios 1–4): each player picks a different type in turn, board turns and banner names the next player, seats set Person/Computer with at least one Person enforced, finished player skipped and game continues to full order (reach it with H then Enter at Fast hop speed, as in T011), "End game" shows order
- [X] T018 [US2] Extend `src/games/critter-hop/game.ts` setup for local play, using `PlayerMode` from `src/shared/modes.ts` as is ("1 Player" = one Person seat; "2 Players" = local setup with 2, 4 or 6 seats, each Person or Computer): one type pick per Person seat in seat order, Person/Computer toggle per seat ("at least one seat is a Person"), strength picked once; on each turn `scene.face(home)` for Person seats; "End game" button ranks as the stall rule does

**Checkpoint**: US1 + US2 e2e green.

---

## Phase 5: User Story 3 — Play online in a room (P2)

**Goal**: host/join via the shared lobby with sizes 2/4/6; unique type picks; every device checks every move; computer takes over dropped seats; rejoin.

**Independent Test**: two browsers, 4-player room, A Water, B sees Water taken and picks Grass; Start → same board with two computer seats; A's move appears on B.

- [X] T019 [P] [US3] Write `messages.test.ts`, then `src/games/critter-hop/messages.ts` (contracts/messages.md): `parseMessage(raw)` for `pick`, `types`, `begin`, `turn`, `move`, `seat`, `over`, `sync` with the limits "≤6 seats; piece ids 0..59; hole indices within the board; paths of distinct holes; every message ≤ 8 KB"; `allowedFrom(m, runner, host, turnSlot)` (`types` host only; `begin`/`turn`/`seat`/`over`/`sync` runner only; `move` from the slot owning the seat in turn, or the runner for computer seats and timeouts); `assignTypes(requests)` first come wins, never two slots one type; `freeType(taken, random)`; `beginRows`/`syncRows` and their inverse; `nextRunner` (same as Tank Clash's, own copy)
- [X] T020 [P] [US3] Add US3 cases to `e2e/critter.spec.ts` (spec US3 scenarios 1–8): hosting with 2/4/6 and the room list count, type taken within 1 s on the other client and never duplicated, countdown/Start fills computer seats and a free type for a player who didn't pick, move appears on the other client within 1 s, non-turn player can't move but can turn/zoom, dropped player → message + computer seat, Rejoin takes the seat back with the current board, two rooms and another game don't see each other's moves, relay down → plain message and 1 Player still works (reuse `e2e/online-down.spec.ts` helpers)
- [X] T021 [US3] Wire online in `src/games/critter-hop/game.ts` with `createLobby` from `src/shared/online/lobby.ts` (`sizes: ROOM_SIZES`, `defaultSize: DEFAULT_ROOM_SIZE`, `countdownMs: COUNTDOWN_MS`, `botWord: 'computer players'`, `rowTag` = the slot's type name, `rejoin` from the saved key; the host's strength picker sits in the waiting-room panel and is sent in `types.level`): `pick` → host replies `types` (+ `level`); host's Start/countdown → `lock`, `begin` with seed and seats; turn clock from `turn`; local move → `move` after `isLegal`; incoming `move` checked with `allowedFrom` + `isLegal` then animated; runner sends computer and timeout moves, `seat` on leave/rejoin, `sync` to a rejoiner, `over`; runner hand-over via `nextRunner`; after the game the host `reopen`s the room

**Checkpoint**: US1–US3 e2e green; relay e2e (`relay/relay.e2e.test.ts`) still green unchanged.

---

## Phase 6: User Story 4 — Turn timer and hints (P3)

**Goal**: 60 s turn limit online (optional locally); Hint shows one good move.

**Independent Test**: online, wait 60 s without moving: a move is made and the turn passes.

- [X] T022 [P] [US4] Add US4 cases to `e2e/critter.spec.ts` (spec US4 scenarios 1–3; use Playwright's clock to skip the 60 s): online timeout plays `timeoutMove`, local timer off by default and on when chosen, Hint (button or H) highlights one creature and hole without moving, Enter plays the shown hint
- [X] T023 [US4] In `src/games/critter-hop/game.ts`: visible turn countdown (`TURN_MS`), always on online and per `localTimer` locally; on expiry the runner (or local device) plays `timeoutMove`; Hint button and H key (Person turns only) show `hint(game)`; Enter with a hint showing plays it

---

## Phase 7: Polish & cross-cutting

- [X] T024 [P] Add the Critter Hop card to `e2e/home.spec.ts` and the route to `e2e/load.spec.ts` if routes are listed there
- [X] T025 [P] Update `README.md`: the new game, its controls (mouse, keyboard keys, touch), online room sizes
- [X] T026 Run `yarn build`, `yarn test` (100% functions), `yarn e2e` (Chromium, WebKit iPad, Firefox) and fix failures; check bundle shows `critter-hop` as its own chunk
- [X] T027 Run `/code-review` on the diff and fix or waive (one-line reason in the commit message) every finding; re-review fixes
- [ ] T028 Play once by hand on a real iPad (quickstart rows 1–8) for touch feel and frame rate before release

---

## Dependencies

- Setup (T001–T002) → Foundational (T003–T010) → US1 (T011–T016) → US2 (T017–T018) → US3 (T019–T021) → US4 (T022–T023) → Polish.
- Within Foundational: T003 before T005, T007–T010; T007 before T008; T008 before T009.
- US2 builds on US1's `game.ts`; US3 needs `rules.ts` and `bots.ts` only, but edits `game.ts` after US2; US4 needs `bots.hint/timeoutMove` (T009) and the online clock (T021).

## Parallel examples

- Foundational: T004, T005, T006, T010 together after T003.
- US1: T011 (e2e), T012 (cursor), T014 (sound), T016 (css) together; then T013 → T015.
- US3: T019 and T020 together, then T021.

## Implementation strategy

1. **MVP = Phases 1–3**: playable 1 Player on both boards with types, long and blocked hops, three strengths, keyboard and touch. Demo-able and deployable.
2. Add US2 (local 2/4/6) — the family-iPad case.
3. Add US3 (online), then US4 (timer, hints).
4. Each phase ends with its e2e green; `/code-review` before every commit.
