# Tasks: Snake Duel

**Input**: Design documents from `/specs/006-snake-duel/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages.md, quickstart.md

**Tests**: required by the constitution (VII): unit tests with 100% function coverage for every pure
module (`src/shared/online/*` logic, `snake-duel/{seed,settings,sim,bots,messages}.ts`), Playwright
e2e against the production build for every acceptance scenario. No test-only code ships: browser
tests set up exact situations with `?seed=` and `?bots=0` (research R9) and real input. Write each
test first and see it fail.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 solo, US5 garage, US2 two on one device, US3 online, US4 on the site

---

## Phase 1: Setup

- [X] T001 In `src/games/index.ts` add `GameSlug.SnakeDuel = 'snake-duel'` and its `games` entry (name "Snake Duel", summary, description mentioning the arena, 1–2 players and online up to 8, `homeTag: '1–2 players · Online up to 8 · iPad ready'`, `tag`, original `art` emoji 🐍, `load: () => import('./snake-duel/index.tsx')`); create `src/games/snake-duel/index.tsx` like `turbo-tumble/index.tsx` (title "Snake Duel", `mount` from `./game.ts`, `./game.css`) and a stub `game.ts`/`game.css` so the route builds
- [X] T002 [P] In `package.json` add `--test-coverage-include` for `src/shared/online/**` and `src/games/snake-duel/{seed,settings,sim,bots,messages}.ts`; register the new enums (T006) in `src/no-stray-literals.test.ts`

---

## Phase 2: Foundational (blocking)

The lobby moves to `src/shared/online/` in three steps (research R5); after each, `yarn test` and all
existing Turbo Tumble e2e (`online`, `lobby`, `standings`, `online-down`, `load`) must pass unchanged.

- [X] T003 Move the relay client: create `src/shared/online/client.ts` (+ `client.test.ts`, moved from `turbo-tumble/net.test.ts`) with `connect` taking a `game` slug option, `closeMessage`, `NetText`, `fetchRooms(game)`, `joinLink(origin, game, code)`, `roomFromUrl`, `deadlineFrom`, `secondsLeft`, `CONNECT_TIMEOUT_MS`, `LIST_POLL_MS`, `ROOM_QUERY`; `turbo-tumble/net.ts` keeps `parseGameMessage`, `allowedFrom`, `MAX_SLOTS`, `ROOM_SIZES`, `COUNTDOWN_MS` and imports the rest
- [X] T004 Move the roster: create `src/shared/online/roster.ts` (+ test, moved from `turbo-tumble/standings.test.ts`) with `rosterRows`, `playerName`, `computerSpots` (was `computerKarts`); `turbo-tumble/standings.ts` keeps `standingRows` and its constants
- [X] T005 Move the lobby UI: create `src/shared/online/lobby.ts` + `lobby.css` from the Online popup and waiting-room code and styles in `turbo-tumble/game.ts`/`game.css`, parameterised by slug, room sizes, default size, countdown length, wording ("computer karts" / "computer snakes"), extra waiting-room controls (a slot for game pickers) and callbacks (start, cancel, leave, profile changes); Turbo Tumble mounts it with its own settings and looks the same
- [X] T006 [P] Create `src/games/snake-duel/constants.ts` (research R7: `ARENA_RADIUS = 2000`, `ARENA_SNAKES = 20`, `START_LENGTH = 10`, `ORB_TARGET = 400`, `STEP_HZ = 60`, `NET_HZ = 20`, `INTERP_MS = 100`, `WIN_ROUNDS = 3`, `QUICK_MS = 300_000`, `REJOIN_MS = 3000`, `BOT_RESPAWN_MS`, `TURN_RATE`, `SPEED`, `BOOST_SPEED`, `BOOST_COST`, `SEGMENT`, `ROOM_SIZES = [2..8]`, `DEFAULT_ROOM_SIZE = 2`, a `DIFFICULTY` table per level, `SEED_QUERY = 'seed'`, `BOTS_QUERY = 'bots'`) and `enums.ts` (`SnakePattern` Solid/Stripes/Spots/TwoTone, `SnakeEyes` Round/Sleepy/Angry/Starry, `Mode` 1 Player/2 Players/Online, `MatchType` Deathmatch/Quick match, `Difficulty` Easy/Normal/Hard, `SnakeMsg` look/in/orbs/mode/begin/snap/round/clock/match/hand, `MatchState`), as const objects + union types
- [X] T007 [P] Write `seed.test.ts`, then `src/games/snake-duel/seed.ts` (research R9): `seeded(n)` returns a repeatable random source (same seed → same sequence); `gameSetup(url, online)` reads `?seed=<number>` and `?bots=0`, returning `{random, stillBots}`, and ignores both when online; a unit test pins the starting layouts the browser tests rely on: seed 1 puts an orb straight ahead of player 1 and a still computer snake within steering reach, seed 2 starts the two players facing each other (so a change to `sim.ts` that moves them fails here first)
- [X] T008 [P] Write `settings.test.ts`, then `src/games/snake-duel/settings.ts`: `SnakeLook` "name up to 10 characters; blank shows 'Player N'", `color`/`accent` `#rrggbb`, `pattern`/`eyes` from their enums; `fixLook` cleans field by field to defaults; `loadSettings`/`saveSettings` under one storage key with `{players: [look, look], difficulty, match, best, muted}`; P2's main colour changes when it equals P1's
- [X] T009 Write `sim.test.ts`, then `src/games/snake-duel/sim.ts` core (research R2), taking the random source from `seed.ts`: `createArena(random)`, `addSnake`, `step(arena, inputs, dt)` at a fixed step: heading turns toward the target by at most `TURN_RATE`, body path spaced `SEGMENT`, eating an orb adds its size, boost only while `length > START_LENGTH` (faster, `−BOOST_COST`/s, drops small orbs), orbs topped up to `ORB_TARGET` on empty spots; take-outs: head within another snake's body radius or outside `ARENA_RADIUS` → out (own body harmless; head-to-head = both out); an out snake's body becomes orbs. Tests cover every rule, and that the same seed gives the same arena

**Checkpoint**: `yarn test` at 100% functions; Turbo Tumble unchanged on screen.

---

## Phase 3: User Story 1 - Play solo in the arena (P1) 🎯 MVP

**Goal**: 1 Player against computer snakes, endless, best length kept.

**Independent test**: quickstart step 3.

- [X] T010 [P] [US1] Write `e2e/snake.spec.ts` part 1 against the production build: the page loads with no console errors; 1 Player at `?seed=1&bots=0` starts → canvas, length 10, a minimap; pressing → turns the snake right; with seed 1 an orb lies straight ahead, so 1 s of going straight raises the length; holding boost shortens it back down to 10 and no further; steering into a parked computer snake's body (seed 1's layout) → "You're out", final length, "Play again"; the best length survives a reload; frame times sampled for 3 s in a normal seeded game average 50 fps or better in Chromium (SC-002). Confirm it fails
- [X] T011 [P] [US1] Write `bots.test.ts`, then `src/games/snake-duel/bots.ts` (research R3): `botInput(arena, bot, level, random)` → `{heading, boost}`: steer to the nearest orb cluster or a wander point, look ahead along the heading and ±angles for bodies or the edge and turn away; Easy (slow turns, rare boost, avoids players), Normal, Hard (targets a player's predicted path and boosts across it) from the `DIFFICULTY` table; `fillBots(arena)` keeps `ARENA_SNAKES` snakes, respawning after `BOT_RESPAWN_MS`; still bots (`?bots=0`) don't move. Tests with a seeded random for each behaviour
- [X] T012 [US1] Create `src/games/snake-duel/draw.ts`: draw the arena (dot grid, circular edge), orbs (soft circles), snakes (round-capped strokes along the path with the look's pattern and eyes, name labels), a view following a snake that zooms out slightly as it grows, the minimap; all colours/sizes from `constants.ts`; original art only (FR-015)
- [X] T013 [US1] In `src/games/snake-duel/game.ts`: `mount(root)` with the mode picker, `gameSetup` from `seed.ts`, 1 Player loop (fixed `STEP_HZ` steps, interpolated drawing), input (mouse: point to steer, hold/Space to boost; keys ←/→ or A/D turn, ↑/W/Space boost; touch: stick + boost button), length HUD, out screen with final length and best, "Play again", pause on hidden tab; cleanup on unmount like Turbo Tumble; T010 passes
- [X] T014 [US1] Style in `src/games/snake-duel/game.css` (scoped `.sd`, phone width, safe-area insets, no scrolling in either orientation)

---

## Phase 4: User Story 5 - Customise your snake (P1)

**Goal**: a garage with name, two colours, pattern, eyes and a live preview; P1/P2 tabs; remembered.

**Independent test**: quickstart step 2.

- [X] T015 [P] [US5] Write `e2e/snake.spec.ts` part 2: change name, main and accent colour, pattern Stripes, eyes Angry → the preview canvas changes (pixel snapshot differs) at once; reload → the same choices; a `<b>` name shows as text; in 2 Players the Player 2 tab edits P2; picking P1's main colour for P2 changes it and says so. Confirm it fails
- [X] T016 [US5] In `src/games/snake-duel/game.ts` add the garage panel (name input maxlength 10, two colour inputs, pattern and eyes option buttons, P1/P2 tabs in 2P, match type and difficulty pickers for local play) with a live preview drawn by `draw.ts`; saves through `settings.ts`; T015 passes

---

## Phase 5: User Story 2 - Two players on one device (P1)

**Goal**: split screen, Deathmatch (first to 3, no limit) or Quick match (5 min, rejoins, longest wins).

**Independent test**: quickstart step 4.

- [X] T017 [P] [US2] Add to `sim.test.ts` and `sim.ts` the match rules (data-model Match): Deathmatch round over when only one player is in (they win it; last out together = draw), first to `WIN_ROUNDS`; Quick match `timeLeft` from `QUICK_MS`, out players rejoin at `START_LENGTH` after `REJOIN_MS`, at 0 the longest player in wins (tie or nobody in = draw); 1 Player endless (no match)
- [X] T018 [P] [US2] Write `e2e/snake.spec.ts` part 3 at `?seed=2&bots=0`: 2 Players → two views (side by side in landscape, stacked in portrait), 3-2-1 countdown; A/D + W and ←/→ + ↑ steer each snake; Deathmatch: P2 steers into P1's body (seed 2 puts them facing each other) → round to P1, round score 1–0; three such rounds → match result + "Play again"; Quick match: timer shows 5:00, P2 crashing is back after 3 s, fast-forwarding the clock (`page.clock`) to 0 shows the longer snake as winner; on a touch viewport each half has its own stick and boost. Confirm it fails
- [X] T019 [US2] In `src/games/snake-duel/game.ts` add 2 Players: two views over one arena, per-player controls and touch halves, round/match/timer HUD and result screens; T018 passes

---

## Phase 6: User Story 3 - Play online, 2 to 8 players (P1)

**Goal**: Turbo Tumble's lobby; one device (the runner) runs the arena; every screen agrees.

**Independent test**: quickstart step 6.

- [X] T020 [P] [US3] Write `messages.test.ts`, then `src/games/snake-duel/messages.ts` per [contracts/messages.md](contracts/messages.md): `parseMessage(raw)` checks every field (finite numbers inside the arena, ≤20 snakes per `snap`, look cleaned with `fixLook`, enums for `mode`), `allowedFrom(msg, runner)` (`orbs`, `mode`, `begin`, `snap`, `round`, `clock`, `match`, `hand` only from the current runner; `in`/`look` from anyone in the room), `nextRunner(runner, slots, msg)` (follows `hand`, or the lowest remaining slot when the runner leaves), `encodeSnap`/`applySnap` (heads → body trails, eaten/added orbs, outs) with a size test (`snap` for 20 snakes < 8 KB) and a delay test (drawn `INTERP_MS` behind, snapshots every `1000/NET_HZ` ms: worst case ≤ 150 ms before the network, SC-004)
- [X] T021 [P] [US3] Write `e2e/snake.spec.ts` part 4 (three contexts, `page.clock` for the countdown): Online shows only Snake Duel rooms (a Turbo Tumble room hosted meanwhile doesn't appear); A hosts a room of 4 → waiting room with name, 1/4, roster with A's colour, 60 s countdown, Start/Cancel, match type and difficulty pickers; B and C join from the list → rosters show 3, guests see Leave and the host's picks; Start → all three see the same orb count and snake count (20); B turns → A sees B's snake change direction within 0.5 s (SC-004); A's tab is hidden (on A's page, `page.evaluate` overrides `document.visibilityState` to `'hidden'` and fires `visibilitychange`) → B takes over running the arena and the game keeps moving on C's screen; A closes mid-round → B shows the host marks, the round goes on, and B and C see the same winner when B and C are taken out; after B is out, B's screen still shows the arena moving with the view following the leader until the round ends (US3 scenario 7) by steering into each other or a bot; with only one player left → "Everyone else left"; a fourth player into a full room → "That room is full"; Cancel → guests see "The host closed the room"; relay unreachable → message within 5 s and 1P works. Confirm it fails
- [X] T022 [US3] In `src/games/snake-duel/game.ts` wire Online with `src/shared/online/lobby.ts` (sizes 2–8, default 2, countdown 60 s, "computer snakes", match type and difficulty pickers in the waiting room): the host sends `room-lock` + `mode` + `orbs` + `begin`; the runner runs `sim.ts` and `bots.ts` for everyone, applies `in`, sends `snap` at `NET_HZ`, `clock` ~1/s in Quick match, `round`/`match`; on `visibilitychange` to hidden the runner sends a final `snap` and `hand` to the next slot; when the runner leaves, `nextRunner` picks the lowest slot, which continues from its last `snap`; the host sends `room-open` when back in the waiting room; guests send `in` at `NET_HZ` and draw `INTERP_MS` behind; out players follow the leader; T021 passes

---

## Phase 7: User Story 4 - Find the game on the site (P2)

**Independent test**: quickstart step 1.

- [X] T023 [US4] Add to `e2e/home.spec.ts`: the home page shows a Snake Duel card with "1–2 players · Online up to 8 · iPad ready" that opens `/games/snake-duel/`; the games page lists it with its description

---

## Phase 8: Polish

- [X] T024 [P] `README.md`: Snake Duel (modes, controls, match types, difficulty, online, `?seed=`) and the shared lobby folder
- [X] T025 Performance tuning (SC-002): 20 snakes and ~400 orbs hold 60 fps on desktop and the iPad project; profile `step` and drawing if T010's frame check is close
- [X] T026 Run `yarn test` (100% functions) and `yarn e2e:local`
- [X] T027 `/code-review` on the diff, also confirming no snake.io names, graphics, sounds or text are used (FR-015); fix each finding or note why it was skipped
- [ ] T028 Commit with any waivers; push; CI green (including Firefox)
- [ ] T029 `yarn deploy`; check quickstart steps 1–8 live

---

## Dependencies & Execution Order

- T001 → T002; T003 → T004 → T005 (each followed by Turbo Tumble's tests); T006–T008 in parallel; T009 after T006 and T007 → US1 → US5 → US2 → US3 → US4 → Polish
- US5, US2 and US3 all add to `game.ts`, so they run one after the other; their tests can be written
  ahead in parallel

## Parallel Example

```text
T006 constants/enums, T007 seed, T008 settings      # Phase 2, different files
T010 e2e part 1, T011 bots                          # US1
T017 match rules (sim), T018 e2e part 3             # US2
T020 messages, T021 e2e part 4                      # US3
```

## Implementation Strategy

1. MVP = Phases 1–3: Snake Duel playable solo with computer snakes.
2. Add the garage (US5) and two players on one device (US2).
3. Add online (US3), the site card (US4), then polish, review, commit, deploy.
