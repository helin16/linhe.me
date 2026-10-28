# Tasks: Online lobby for Turbo Tumble

**Input**: Design documents from `/specs/004-online-lobby/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/relay-protocol.md, quickstart.md

**Tests**: required by the constitution (VII): unit + relay e2e with 100% function coverage for
`relay/` and `net.ts`, and Playwright e2e for each user story. Write each test first and see it fail.

**Organization**: by user story; the relay protocol and the 12-kart field are foundational.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 host + countdown, US2 browse + join, US3 links still work

---

## Phase 1: Setup

- [X] T001 In `relay/config.ts` change `DEFAULTS.roomSize` to 12 ("`RELAY_ROOM_SIZE` | `12` (was 4)") and add `listRate: 5` read from `RELAY_LIST_RATE` (in `KEYS`); extend `relay/config.test.ts`; document both in `.env.example` (commented defaults)

---

## Phase 2: Foundational (blocking)

- [X] T002 [P] Extend `relay/protocol.test.ts`, then `relay/protocol.ts`: `MIN_ROOM_SIZE = 2`; `ROOMS_PATH = 'rooms'`; `RelayMsg` adds `Room: 'room'`, `Lock: 'room-lock'`, `Open: 'room-open'`, `Close: 'room-close'`; `CloseCode` adds `Closed: 4410`, `Started: 4423`; `parseRelayPath(path, search)` returns `{game, create: true, size}` for `new` (`size` from `?size=`, missing → 4, outside `MIN_ROOM_SIZE`…max → null; max passed in), `{game, list: true}` for `rooms`, `{game, code}` otherwise; `relayUrl(base, game, room, size?)` adds `?size=`; `roomsUrl(base, game)` gives the `https:` list address; types `Hello` (+ `name`, `size`, `open`, `openFor`), `RoomFrame {t: 'room', open, openFor}`, `RoomInfo {code, name, players, size}`; register new enum members in `src/no-stray-literals.test.ts`
- [X] T003 [P] Write `relay/names.test.ts`, then `relay/names.ts`: two fixed family-friendly word lists (≥40 adjectives, ≥40 animals, capitalised); `newName(taken, random = randomInt)` returns "Adjective Animal", retries while `taken(name)`, throws after 100 tries (stub random in tests)
- [X] T004 Extend `relay/rooms.test.ts`, then `relay/rooms.ts`: room = `{slots, name, size, open, openedAt}` (list order = creation order); `create(game, peer, size, now)` (name via `newName`, unique within `game`); `join` refuses `'full'` at `size` and `'started'` when not `open`; `lock(game, code, from)`, `reopen(game, code, from, now)` and `close(game, code, from)` act only if `from` is the lowest occupied slot (return whether they acted); `reopen` sets `openedAt = now`; `lock`/`reopen` tell everyone `{t: 'room', open, openFor}`; `close` returns the room's peers so the server can close them with 4410 and deletes the room; `list(game, now)` returns `RoomInfo[]` for open rooms with `players < size`, newest first; `hello` data includes `name`, `size`, `open`, `openFor`
- [X] T005 Extend `relay/relay.e2e.test.ts`, then `relay/server.ts`: `?size=8` → `hello.size 8`; `?size=1` and `?size=13` → 4400; a 9th client in a size-8 room → 4409; `room-lock` from the host → everyone gets `room` `{open: false}` and a new joiner gets 4423; from a guest → ignored; `room-open` → `{open: true, openFor: 0}`; `room-close` from the host → all clients closed with 4410, code then 4404; host hand-over: after slot 0 leaves, slot 1's `room-lock` and `room-close` work and a late frame from the old slot 0's connection has no effect; update rate (SC-008): 12 clients in one size-12 room each send 20 messages a second for 3 s and every client receives all of every peer's messages, in order; `GET /relay/test-game/rooms` → 200 JSON `{rooms: [...]}` with `Cache-Control: no-store`, listing only open, non-full rooms newest first and nothing from another game; more than `listRate` requests at once from one `CF-Connecting-IP` → 429; per-address list buckets dropped on the log interval; a client sending `{t: 'room'}` → 4400 (relay type); logs still contain no names or codes
- [X] T006 [P] Extend `src/games/turbo-tumble/net.test.ts`, then `net.ts`: `SLOTS` → `MAX_SLOTS = 12` (slots 0–11 in `isSlot`, `s` messages up to 12 entries); `closeMessage` maps 4410 → `NetText.Closed` "The host closed the room", 4423 → `NetText.Started` "That race has already started"; `connect(room, handlers, …, size?)` passes size on create and forwards `room` frames to a new `handlers.room`; `fetchRooms(base)` → `RoomInfo[]` (empty on any error or bad JSON, validated per entry); `allowedFrom` unchanged in meaning with 12 slots
- [X] T007 In `src/games/turbo-tumble/game.ts`: `RACERS` grows to 12 looks (names + colours); build `MAX_SLOTS` karts; `fieldSize()` = room size online, `OFFLINE_KARTS` (4) offline; karts beyond the field are hidden and skipped by drive, follow, collisions, `ranked()`, HUD, results and `s` messages; `slotOf`/`kartOf` use the field size; `reset()` grid stays 2 per row, 6 track points per row (12 karts = 6 rows); 1P/2P still race 4 karts

**Checkpoint**: `yarn test` passes; 1P/2P unchanged; relay supports sizes, names, lock/open/close and the list.

---

## Phase 3: User Story 1 - Host a room with a size and a countdown (P1) 🎯 MVP

**Goal**: host picks 4–12, gets a generated name, sees n/size, a 60 s countdown, Start and Cancel;
race starts at Start or 0 with computer karts filling the field; Cancel closes the room; a dropped
host is replaced with the countdown unchanged.

**Independent test**: quickstart steps 1, 3, 4, 5, 6.

- [X] T008 [P] [US1] Write `e2e/lobby.spec.ts` part 1 (two contexts, `page.clock` installed): A → Online → the size picker offers exactly 4–12 with 4 selected → Host a room, size 8 → sees a two-word name, "1/8", countdown "60", Start, Cancel; fast-forward 60 s → race starts with 8 karts on the grid; after the results A is back in the room with the countdown at 60; A presses Start early → race starts at once; with B joined, A presses Cancel → B sees "The host closed the room" within 2 s; host hand-over: B joined, A's page closes → B gets Start/Cancel and the countdown keeps its value (±1 s); no console errors in any context. Confirm it fails
- [X] T009 [US1] In `src/games/turbo-tumble/enums.ts` update `OnlineAction` (`Host: 'host-room'`, `Join: 'join-room'`, `Copy: 'copy-link'`, `Leave: 'leave-room'`, `Cancel: 'cancel-room'`, `Close: 'close-lobby'`; Start stays the existing Start race button, room rows are their own buttons); constants: `ROOM_SIZES` (4…12), `COUNTDOWN_MS = 60_000`, `LIST_POLL_MS` in `net.ts`, `OFFLINE_KARTS = 4` in `game.ts`
- [X] T010 [US1] In `src/games/turbo-tumble/game.ts` replace the create/join panel with the Online popup's host part: size `<select>` (4–12, default 4) and "Host a room" → `openRoom(NEW_ROOM, size)`; the waiting-room panel: name, "n/size players", countdown (whole seconds from `deadline = Date.now() − openFor + COUNTDOWN_MS`, ticking once a second), host: Start + Cancel, guest: Leave; `Net` gains `name`, `size`, `open`, `deadline` (set from `hello` and `room` frames)
- [X] T011 [US1] In `src/games/turbo-tumble/game.ts` race flow: host Start or countdown reaching 0 (host only) → send `room-lock`, then `start`; when the results show, the host sends `room-open`; Cancel → send `room-close` and return to the popup; a client closed with 4410 shows `NetText.Closed` and returns to the popup; host hand-over uses the existing lowest-slot rule (no extra code beyond showing Start/Cancel)
- [X] T012 [US1] Style the popup, size picker, waiting room and countdown in `src/games/turbo-tumble/game.css` (scoped `.tt`, `.opt` buttons, readable at phone width; the room list has a maximum height and scrolls); T008 passes

---

## Phase 4: User Story 2 - Browse and join a waiting room (P1)

**Goal**: Online shows a live list of open rooms (name, n/size), picking one joins; empty and
stale-pick cases handled.

**Independent test**: quickstart step 2.

- [X] T013 [P] [US2] Write `e2e/lobby.spec.ts` part 2: B opens Online with no rooms → "No rooms waiting — host one!"; A hosts size 8 → B's list shows A's name "1/8" within 2 s without reopening; B picks it → both see "2/8" and countdowns within 1 s; B presses Leave → back to the list, A sees "1/8"; a room that A locks disappears from B's list within 2 s; picking a room that started meanwhile shows "That race has already started" and refreshes the list; no console errors. Confirm it fails
- [X] T014 [US2] In `src/games/turbo-tumble/game.ts`: picking Online opens the popup (`OnlineState.Browsing`) and polls `fetchRooms` every `LIST_POLL_MS` (1 500) while browsing, stopping when the popup closes or a room is entered; rows are buttons with the name (text, not HTML) and "n/size", newest first; empty → `NetText.NoRooms`; pick → `openRoom(code)`; errors from `closeMessage` show in the popup and refresh the list; Leave → back to browsing; T013 passes

---

## Phase 5: User Story 3 - Links and codes still work (P2)

**Goal**: waiting room shows its code and Copy link; a link joins a waiting room; a racing room's
link says the race started.

**Independent test**: quickstart step 7.

- [X] T015 [P] [US3] Update `e2e/online.spec.ts` and `e2e/online-down.spec.ts` for the popup: join by link lands in the waiting room; link to a racing room → "That race has already started"; unknown code → "No room with that code"; relay unreachable → 003's message within 5 s and 1P still races. Confirm the new parts fail
- [X] T016 [US3] In `src/games/turbo-tumble/game.ts`: the waiting room shows the code and Copy link (existing `joinLink`); opening a join link opens the popup and joins that code directly; T015 passes

---

## Phase 6: Polish

- [X] T017 [P] `README.md`: Online play section (lobby, sizes 4–12, countdown); relay settings `RELAY_ROOM_SIZE` (12) and `RELAY_LIST_RATE`
- [X] T018 [P] Update `specs/003-online-relay/contracts/relay-protocol.md` with a pointer to 004's additions
- [ ] T019 Run `yarn test` (100% functions) and `yarn e2e:local`; check SC-008 by hand: a 12-kart race stays smooth on a phone
- [X] T020 `/code-review` on the diff; fix each finding or note why it was skipped
- [ ] T021 Commit with the review waivers; push; CI green (including Firefox)
- [ ] T022 `yarn deploy`; live check per quickstart "Live"

---

## Dependencies & Execution Order

- Setup (T001) → Foundational (T002–T007) → US1 (T008–T012) → US2 (T013–T014) → US3 (T015–T016) → Polish
- T004 needs T002 + T003; T005 needs T004; T006 needs T002; T007 is independent of the relay tasks
- US2 and US3 reuse US1's popup and waiting room, so they follow it

## Parallel Example

```text
T002 protocol, T003 names, T006 net.ts, T007 12-kart field   # Phase 2, different files
T008 lobby e2e part 1 while T009 enums                        # US1
T017 README, T018 003 contract pointer                        # Polish
```

## Implementation Strategy

1. MVP = Phases 1–3: hosting with sizes, names, countdown, Start/Cancel, hand-over.
2. Add US2 (browse + join) — the main request; ship after it.
3. US3 keeps links working; then polish, review, commit, deploy.
