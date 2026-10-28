# Tasks: Live standings and room roster for Turbo Tumble

**Input**: Design documents from `/specs/005-race-standings/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: required by the constitution (VII): unit tests with 100% function coverage for
`standings.ts`, and Playwright e2e for each acceptance scenario. Write each test first and see it fail.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 standings in races, US2 room roster

---

## Phase 1: Setup

- [X] T001 In `package.json` add `--test-coverage-include='src/games/turbo-tumble/standings.ts'` to the `test` script so the 100%-functions gate covers the new module

---

## Phase 2: Foundational

- [X] T002 Write `src/games/turbo-tumble/standings.test.ts`, then create `src/games/turbo-tumble/standings.ts` (no three.js import): constants `COMPACT_MEDIA = '(max-width: 700px), (max-height: 500px)'`, `COMPACT_TOP = 3`, `UNKNOWN_COLOR = '#888888'`; types `Standing {place, name, color, local, time}` and `RosterRow {slot, name, color, host, you}` per data-model.md; `standingRows(order, compact)`: all rows when not compact, else "places 1–3 plus any `local` row outside them, in order"; `rosterRows(me, peers, profiles, ownLook)`: one row per occupied slot sorted by slot, `host` = lowest slot, `you` = `me`, name from the profile or "Player N" when blank or missing, colour from the profile or `UNKNOWN_COLOR` until it arrives; `computerKarts(size, players)` = `size − players` (never below 0). Tests cover 4 and 12 karts, compact with the local player in and outside the top 3, two local players (2P), blank names, missing profiles, host after hand-over (lowest slot ≠ 0); rows follow the order they're given (an overtake = a new order) and a finished kart's row carries its time (US1 scenarios 2 and 4)

**Checkpoint**: `yarn test` passes with 100% functions.

---

## Phase 3: User Story 1 - See the standings while racing (P1) 🎯 MVP

**Goal**: a HUD panel lists every kart's place, colour dot and name in race order (compact on
phones), local rows highlighted, finish times shown.

**Independent test**: quickstart steps 1, 2 and 4.

- [X] T003 [P] [US1] Write `e2e/standings.spec.ts` part 1: 1 Player race → `#standings` lists 4 rows with places 1–4, each with a colour dot and a name, exactly one row marked local (`.mine`); 2 Players → one panel, two `.mine` rows; online 8-player room hosted and started → 8 rows, the guest's row shows the guest's chosen name; on a 640×360 viewport (phone landscape) in a 12-player room the panel shows 3 or 4 rows including `.mine`, and its box doesn't overlap `.steer` or `.acts` (bounding boxes); during the 1P race, sampled for 3 s, the `.mine` row's place always equals the big `.pos` number (the panel follows the live order); a player named `<b>x</b>` shows as that text in the panel; no console errors. Confirm it fails
- [X] T004 [US1] In `src/games/turbo-tumble/game.ts` add `<ol id="standings" aria-label="Standings"></ol>` to the HUD markup; in `hud()` build `Standing`s from `ranked()` (`local` = in `humans()`, `time` = `fmt(finishTime)` when finished, colour from `k.color`), pick rows with `standingRows(order, matchMedia(COMPACT_MEDIA).matches)`, and rebuild the list only when a key of the shown places/names/finished flags changes; rows use `textContent` for names and `style.background` for the dot; local rows get class `mine`
- [X] T005 [US1] Style `#standings` in `src/games/turbo-tumble/game.css` (scoped `.tt`): top-left under `.lap`, small rows with a round colour dot, `.mine` highlighted; in `.tt.touch` place it under `#tbar` and above the steering pad, and move `#map` to the right so they don't overlap; in 2P one shared panel; T003 passes

---

## Phase 4: User Story 2 - See who is in the waiting room, and their colours (P1)

**Goal**: in an online waiting room, host and guests see each player's number, colour swatch,
name, host and "you" marks, live, plus how many computer karts will fill the rest.

**Independent test**: quickstart step 3.

- [X] T006 [US2] Write `e2e/standings.spec.ts` part 2 (two contexts): A hosts a 4-player room → `#roster` shows "P1", A's name, "host" and "you", a swatch in A's kart colour, and "+3 computer karts"; B joins → within 2 s both rosters show two rows (B's row "P2" with B's colour, "you" on B's side only) and "+2 computer karts"; B changes kart colour in the garage → A's swatch for P2 changes within 2 s; B changes name → A sees it; B leaves → A's roster is back to one row within 2 s; host hand-over (A leaves while B and C wait) → "host" moves to B; a name with `<b>` shows as text; no console errors. Confirm it fails
- [X] T007 [US2] In `src/games/turbo-tumble/game.ts` add `<ul id="roster" aria-label="Players"></ul>` and `<div id="botCount"></div>` to the waiting-room panel; in `netInfo()` (already run on join, leave, `me` and our own garage edits) fill them from `rosterRows(net.slot, net.peers, net.profiles, cfg.players[0])` and `computerKarts(net.size, net.peers.size + 1)` ("+N computer karts", hidden at 0); names via `textContent`, swatch via `style.background`
- [X] T008 [US2] Style `#roster` in `src/games/turbo-tumble/game.css` (rows: swatch, "P{n}", name, small "host"/"you" tags; fits the 260 px garage panel); T006 passes

---

## Phase 5: User Story 3 - The site says the game can be played online (P2)

**Goal**: the home page card and the game's listing mention online play.

**Independent test**: quickstart step 4.

- [X] T009 [P] [US3] Create `e2e/home.spec.ts`: the home page's Turbo Tumble card shows the tag "1–2 players · Online up to 12 · iPad ready"; the games page (`Route.Games`, `/games/`) shows Turbo Tumble's `tag` "Keyboard or touch · 1–2 players · online up to 12" and a `description` ending "…or up to 11 others online in a room.". Confirm it fails
- [X] T010 [US3] In `src/games/index.ts` set `homeTag: '1–2 players · Online up to 12 · iPad ready'`, `tag: 'Keyboard or touch · 1–2 players · online up to 12'`, and end `description` with "… and race a friend split-screen, or up to 11 others online in a room."; T009 passes

---

## Phase 6: Polish

- [X] T011 [P] `README.md`: mention the standings panel and the room's player list in the Online play / Turbo Tumble notes
- [X] T012 Run `yarn test` (100% functions) and `yarn e2e:local`
- [X] T013 `/code-review` on the diff; fix each finding or note why it was skipped
- [X] T014 Commit with any waivers; push; CI green (including Firefox)
- [X] T015 `yarn deploy`; check quickstart steps 1–4 live

---

## Dependencies & Execution Order

- T001 → T002 → US1 (T003–T005) and US2 (T006–T008), which only share `game.ts`/`game.css` (do them one after the other) → Polish
- US3 (T009–T010) touches only `src/games/index.ts` and can be done any time
- T003 can be written while T002 is reviewed; T006 adds to the same file, so after T003

## Parallel Example

```text
T003 standings e2e part 1  +  T004 HUD panel            # test first, then the panel in another file
T011 README                                               # while T012 runs
```

## Implementation Strategy

1. MVP = Phases 1–3: the standings panel in every race.
2. Add US2 (room roster) and US3 (home page says online), then polish, review, commit, deploy.
