---

description: "Task list for feature 003: online multiplayer via a WebSocket relay"
---

# Tasks: Online multiplayer for Turbo Tumble

**Input**: Design documents from `/specs/003-online-relay/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/relay-protocol.md, quickstart.md

**Tests**: required by constitution V (relay isolation tests) and VII (unit tests with 100% function
coverage; automated end-to-end tests in Chromium, WebKit with touch, and Firefox for this feature's
acceptance scenarios). Written first; each must fail before its code exists.

**Organization**: one phase per user story; US1 builds the relay core, the game client and the browser
tests' scaffolding, US2 isolation and input validation, US3 failure handling, US4 limits and deploy.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Add dependencies with exact versions: `yarn add --exact ws@8.22.0` and `yarn add --exact -D @types/ws@8.18.2 @playwright/test@1.64.1`; install browsers with `yarn playwright install chromium webkit firefox` (updates `package.json`, `yarn.lock`)
- [X] T002 [P] In `package.json` set scripts: `"test": "node --test --experimental-test-coverage --test-coverage-include='relay/**' --test-coverage-include='src/games/turbo-tumble/net.ts' --test-coverage-exclude='**/*.test.ts' --test-coverage-functions=100 'src/**/*.test.ts' 'relay/**/*.test.ts'"`, `"relay": "node relay/server.ts"`, `"build:relay": "vite build --config vite.relay.config.ts"`, `"e2e": "playwright test"`; add `"relay"`, `"e2e"` and `"playwright.config.ts"` to `tsconfig.json` `include`
- [X] T003 [P] Create `vite.relay.config.ts`: `build.ssr: 'relay/server.ts'`, `outDir: 'dist-relay'`, output file `relay.mjs` (ESM), `ssr.noExternal: true` (bundle `ws`), `target: 'node24'`, externalise only the optional `bufferutil` and `utf-8-validate`; add `dist-relay/`, `test-results/` and `playwright-report/` to `.gitignore`
- [X] T004 [P] In `vite.config.ts` add `server.proxy` and `preview.proxy`: `'/relay': { target: 'http://127.0.0.1:' + (process.env.RELAY_PORT ?? DEFAULTS.port), ws: true }` with `DEFAULTS` imported from `relay/config.ts` (one source)
- [X] T005 [P] In `.env.example` add placeholders `DEPLOY_RELAY_DIR=<relay-dir>` and the optional relay settings commented with their defaults (`# RELAY_PORT=8787` …, names from data-model.md); `# VITE_RELAY_URL=wss://<domain>/relay/` (default: same site)
- [X] T006 [P] Create `playwright.config.ts`: `testDir: 'e2e'`; `webServer` = two entries: `yarn relay` (with `RELAY_PORT` from env or `DEFAULTS.port`, readiness by TCP port) and `yarn preview --port <preview port constant> --strictPort` (after `yarn build`), `reuseExistingServer: !process.env.CI`; `use.baseURL` from the same constant; projects `chromium` (Desktop Chrome), `firefox` (Desktop Firefox), `webkit-ipad` (`devices['iPad (gen 7)']`, touch); `fullyParallel: false` for the online specs

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T007 [P] Write `relay/protocol.test.ts`: `relayUrl(base, game, 'new')` and `relayUrl(base, game, code)` build `…/relay/<game>/new` and `…/relay/<game>/<CODE>` from an `https:` base as `wss:` (and `http:` as `ws:`); `parseRelayPath('/relay/turbo-tumble/k7 qp')` returns `{game: 'turbo-tumble', code: 'K7QP'}`, `'/relay/turbo-tumble/new'` returns `{game, create: true}`, and bad paths (`/relay/Bad_Game/x`, `/relay/`, `/other`, game longer than 32) return `null`; `isGameName` accepts `^[a-z0-9-]{1,32}$` only; `CloseCode` values are 4400, 4404, 4409, 4413, 4429, 4503; `RelayMsg` (`Hello`/`Join`/`Leave` = `hello`/`join`/`leave`). Run `yarn test`, confirm it fails
- [X] T008 Create `relay/protocol.ts` (owned by the relay; Turbo Tumble imports it): `CloseCode` and `RelayMsg` const-object enums, `RELAY_PATH = '/relay/'`, `NEW_ROOM = 'new'`, `CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'`, `CODE_LENGTH = 4`, `normaliseCode()`, `isGameName()`, `parseRelayPath()`, `relayUrl()`, frame types (`Hello {t, slot, peers, code}`, `Join {t, slot}`, `Leave {t, slot}`); `src/games/turbo-tumble/enums.ts` `MsgType.Hello/Join/Leave` take their values from `RelayMsg` (one source). Register `RelayMsg` (home `relay/protocol.ts`) in `src/no-stray-literals.test.ts` and make that test scan `relay/` too (excluding tests); T007 passes
- [X] T009 [P] Write `relay/config.test.ts`, then create `relay/config.ts`: `loadConfig(env)` returns `{port, roomSize, maxMessage, rate, perAddress, maxRooms, pingMs}` from `RELAY_PORT`, `RELAY_ROOM_SIZE`, `RELAY_MAX_MESSAGE`, `RELAY_RATE`, `RELAY_PER_ADDRESS`, `RELAY_MAX_ROOMS`, `RELAY_PING_MS` with defaults `8787, 4, 8192, 40, 8, 500, 30000` exported as `DEFAULTS`; invalid or non-positive values fall back to the default (tested)
- [X] T010 [P] Write `relay/codes.test.ts`, then create `relay/codes.ts`: `newCode(taken: (c) => boolean, random = crypto.randomInt)` returns `CODE_LENGTH` chars from `CODE_ALPHABET`, retries while `taken`, throws after 100 tries (tested with a stub random)
- [X] T011 [P] Write `relay/limits.test.ts`, then create `relay/limits.ts`: `tokenBucket(rate, now)` allows `rate` messages, then refuses until time passes (fake clock); `addressCounter(max)` `add(addr)` refuses the `max + 1`-th, `remove(addr)` frees and forgets the address at 0 (nothing kept)

**Checkpoint**: protocol, config, codes and limits tested at 100% functions.

---

## Phase 3: User Story 1 - Race friends online with a room code (Priority: P1) 🎯 MVP

**Goal**: create a room, share code or link, up to 4 players race together (FR-001–FR-003, FR-011, FR-013, SC-001, SC-002, SC-004).

**Independent Test**: `yarn test` (relay e2e) and `yarn e2e` (`e2e/online.spec.ts`).

### Tests for User Story 1

- [X] T012 [P] [US1] Write `relay/rooms.test.ts` (pure, no sockets): `createRoom(game)` returns a code and slot 0; `join(game, code)` gives the lowest free slot and the existing peers; joining a full room (`roomSize`) returns `'full'`, an unknown code `'no-room'`; `leave(slot)` frees the slot and deletes the room when empty (then `join` returns `'no-room'`); `broadcast(from, payload)` delivers to every other client in the room with `from` set to the sender's slot (overwriting any `from`); a freed slot is reused by the next joiner. Confirm it fails
- [X] T013 [P] [US1] Write `relay/relay.e2e.test.ts` part 1: start the relay (`startRelay({...DEFAULTS, port: 0})` → `{port, close}`) and connect real `WebSocket` clients: A creates (`/relay/test-game/new`) → `hello {slot: 0, peers: [], code}`; B joins with the code in lower case with a space → `hello {slot: 1, peers: [0], code}` and A gets `join {slot: 1}`; `{t: 'x', from: 99}` from B reaches A as `{t: 'x', from: 1}` and not B; B closes → A gets `leave {slot: 1}`; four clients fill a room and a fifth is closed with 4409; an unknown code closes with 4404; when all leave, the old code closes with 4404; update rate (SC-004): three clients each send 20 messages a second for 3 s and every client receives all 120 messages from each peer, in order. Confirm it fails
- [X] T014 [P] [US1] Write `src/games/turbo-tumble/net.test.ts` part 1: `closeMessage(code, hadHello)` maps per [contracts/relay-protocol.md](contracts/relay-protocol.md) (4404 → "No room with that code", 4409 → "That room is full", 4400/4503/any before hello → "Online play isn't available right now", any after hello → "Disconnected from the room"); `joinLink(origin, code)` returns `<origin>/games/turbo-tumble/?room=<CODE>` via `gameRoute` and `ROOM_QUERY`; `roomFromUrl(url)` reads and normalises the `room` query (or `null`). Confirm it fails
- [X] T015 [P] [US1] Write `e2e/online.spec.ts` (Playwright, all three projects, two browser contexts A and B): A opens the game, picks Online → Create room, sees a 4-character code, "Copy link" and "Online as P1 · 1/4 players"; B opens the join link (built from the shown code), sees the code filled in and taps Join → both show 2/4, B shows "The host picks the track and starts"; A starts a race → both leave the garage and show "Lap 1/3"; B's page closes → A shows 1/4 within 5 s; then host hand-off: a new B joins, A's page closes → B shows "You are the host" and can start a race; no console errors in either context. Confirm it fails

### Implementation for User Story 1

- [X] T016 [US1] Create `relay/rooms.ts`: `createRooms(config)` holding `Map<game, Map<code, Room>>` per data-model.md (`slots` 0–3, "at most `ROOM_SIZE` (4)"), with `create`, `join`, `leave`, `broadcast`, `count()`; rooms deleted the moment they empty; T012 passes
- [X] T017 [US1] Create `relay/server.ts`: `startRelay(config)` on `node:http` + `ws` (`WebSocketServer({noServer: true, maxPayload: config.maxMessage})`), listening on `127.0.0.1:config.port`; the upgrade handler uses `parseRelayPath` (bad path → HTTP 404, no upgrade), creates or joins via `rooms.ts`, sends `hello`, tells peers `join`, forwards each parsed JSON object with `broadcast`, sends `leave` on close; refusals close with the `CloseCode`s; when run directly it starts from `loadConfig(process.env)`; T013 passes
- [X] T018 [US1] Create `src/games/turbo-tumble/net.ts`: `connect(game, codeOrNew, handlers)` opening `relayUrl(import.meta.env.VITE_RELAY_URL ?? location.origin + RELAY_PATH, …)`, JSON parse/send, `onHello/onMessage/onClose(message)`; `closeMessage`, `joinLink`, `roomFromUrl`, `ROOM_QUERY = 'room'`; T014 passes
- [X] T019 [US1] In `src/games/turbo-tumble/enums.ts` add `OnlineState` (`Idle: 'idle'`, `Connecting: 'connecting'`, `InRoom: 'in-room'`, `Error: 'error'`) and `OnlineAction` (`Create: 'create-room'`, `Join: 'join-room'`, `Copy: 'copy-link'`, `Leave: 'leave-room'`); register both (home `games/turbo-tumble/enums.ts`) in `src/no-stray-literals.test.ts`
- [X] T020 [US1] In `src/games/turbo-tumble/game.ts` swap the transport: remove `EventSource`, `fetch('send')`, `goOnline`/`goOffline` and the old error text; use `net.ts` (`send` sends the payload without `from`; the relay stamps it); `Net` gains `code`; on `hello` set `net` and run the old `hello` steps; `join`/`leave` and game messages keep their handlers; leaving the page closes the socket (existing cleanup)
- [X] T021 [US1] In `src/games/turbo-tumble/game.ts` add the online panel to `MARKUP` inside `#garage-menu` (shown when Online is picked), with `data-online` attributes from `OnlineAction`: "Create room"; a code input (`maxlength` = `CODE_LENGTH`, `autocapitalize="characters"`, spaces allowed) with "Join"; and when in a room the code, "Copy link" (`navigator.clipboard.writeText(joinLink(...))`, falling back to selecting the text) and "Leave room". `netInfo` keeps "Online as P… · n/4 players" and the host lines and shows errors from `closeMessage`. On mount, if `roomFromUrl(location.href)` is set, pick Online, fill the code and show Join (one tap)
- [X] T022 [US1] Style the online panel in `src/games/turbo-tumble/game.css` (scoped under `.tt`, reuse the `.opt` button look, code shown large and monospace); T015 passes in all three projects

**Checkpoint**: two players can race online locally, proven by `yarn e2e`.

---

## Phase 4: User Story 2 - Rooms and games stay separate (Priority: P1)

**Goal**: FR-004, FR-005, FR-009, SC-003, and untrusted peer data can't break a game.

**Independent Test**: the isolation and validation tests below.

- [X] T023 [US2] Add to `relay/relay.e2e.test.ts` part 2: two rooms in the same game with two clients each exchange 50 messages and no client ever receives a frame from the other room (exact counts); a client of `other-game` that joins with a `turbo-tumble` room's code gets 4404 and reaches no `turbo-tumble` client; `/relay/Bad_Game/new` and `/relay/turbo-tumble/` get HTTP 404 (no upgrade); a non-JSON frame and a JSON array close with 4400; 200 created rooms have unique codes. Fix anything it finds in `relay/server.ts` / `relay/rooms.ts`
- [X] T024 [US2] Write `src/games/turbo-tumble/net.test.ts` part 2, then implement `parseGameMessage(raw)` in `net.ts` returning a typed message or `null`: `me.p` passed through `fixLook` (export it from `settings.ts`); `s.k` entries are `[slot 0–3, …10 finite numbers]`; `start.map` passes `isMember(Track, …)`; `zap.by`/`zap.to` are slots 0–3; `goo` has finite `x`/`z` and a string `id` of at most 32 characters; `pop.id` is a string; unknown `t`, non-objects and bad fields give `null`. `game.ts` passes only non-null results to `onNet`

---

## Phase 5: User Story 3 - The game handles a missing or failing relay (Priority: P2)

**Goal**: FR-008, SC-005.

**Independent Test**: `e2e/online-down.spec.ts` and the timeout unit test.

- [X] T025 [P] [US3] Write `e2e/online-down.spec.ts` (all projects): with the relay not reachable (route `**/relay/**` aborted in Playwright), picking Online shows "Online play isn't available right now" within 5 s and a 1 Player race starts; a join link to an unknown code shows "No room with that code" (relay up). Confirm it fails
- [X] T026 [US3] In `src/games/turbo-tumble/net.ts` add a 5 s connect timeout (no `hello` → close and report "Online play isn't available right now"), unit-tested in `net.test.ts` with a fake timer and a socket stub; in `game.ts` every `onClose` returns the panel to idle with the message, resets `net` and keeps 1 Player / 2 Players working; a drop mid-race shows "Disconnected from the room" and returns to the garage; T025 passes

---

## Phase 6: User Story 4 - The relay is safe to run in public (Priority: P2)

**Goal**: FR-006, FR-007, FR-010, FR-012, SC-006, SC-007.

**Independent Test**: the limit tests below, quickstart steps 3–4.

### Tests for User Story 4

- [X] T027 [US4] Add to `relay/relay.e2e.test.ts` part 3 (relay started with small limits): a frame over `maxMessage` closes the sender with 4413 (others unaffected); more than `rate` messages in a second closes with 4429; the `perAddress + 1`-th connection from one address (test client sets `CF-Connecting-IP`) is refused with 4503, and freeing one allows another; the `maxRooms + 1`-th create is refused with 4503; a client that stops answering pings is dropped after two missed pings (short `pingMs`) and its peers get `leave`. Confirm the new cases fail

### Implementation for User Story 4

- [X] T028 [US4] In `relay/server.ts` wire `limits.ts`: token bucket per client (4429), address counter from `CF-Connecting-IP` falling back to the socket address (4503), total room cap (4503), `maxPayload` close mapped to 4413, ping every `pingMs` with a two-miss drop; logging per research R9 only (start-up, errors without payloads, once a minute `connections=<n> rooms=<n>`); T027 passes, coverage stays at 100% functions
- [X] T029 [US4] Extend `scripts/deploy.ts`: require `DEPLOY_RELAY_DIR`; run `yarn e2e` before uploading; after the site upload, `yarn build:relay`, upload `dist-relay/relay.mjs` to `<server>:<DEPLOY_RELAY_DIR>/`, write the systemd unit generated in the script from config (`ExecStart=node <DEPLOY_RELAY_DIR>/relay.mjs` (systemd looks `node` up itself; no binary path in the repo), `DynamicUser=yes`, `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp=yes`, `MemoryMax=256M`, `Restart=always`, `RestartSec=2`, `Environment=` for any `RELAY_*` set in `.env`) as `linhe-relay.service`, then `systemctl daemon-reload && systemctl enable --now linhe-relay && systemctl restart linhe-relay`; the live check also opens `wss://<site>/relay/deploy-check/new` and requires a `hello` with a code within 5 s, then closes it
- [X] T030 [US4] One-time server setup over SSH: `apt-get install -y nodejs` (24.x); add to Caddy's site block `handle /relay/* { reverse_proxy 127.0.0.1:<RELAY_PORT> }` before the static handlers (back up the Caddyfile first, `caddy validate`, reload)
- [X] T031 [US4] Update `README.md`: online play (create/join/link); `yarn relay` and `yarn e2e` for local work; relay settings (`RELAY_*`, `VITE_RELAY_URL`, and that a relay on another host needs the CSP `connect-src` updated); deploy now also ships the relay; one-time server setup by role (Node 24, Caddy `/relay/*` route)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T032 Run `yarn build`, `yarn build:relay`, `yarn test` (coverage threshold met) and `yarn e2e` (all three projects); `git grep` shows no `EventSource` or `fetch('send'` left in `src/`
- [X] T033 Run `/code-review` on the full diff; fix each finding or record a one-line waiver; re-review fixes
- [X] T034 Commit with the review waivers
- [ ] T035 `yarn deploy` (site + relay; its relay check must pass), then on the live site: a race between two devices on different networks with no console errors (including no CSP errors for `wss:`), crash recovery (`systemctl kill linhe-relay` → running again within 10 s), and the service log holds no codes, names or messages

---

## Dependencies & Execution Order

- Setup (T001–T006) → Foundational (T007–T011) → stories.
- US1: tests T012–T015 (fail) → T016 → T017; T018 → T019 → T020 → T021 → T022.
- US2 (T023–T024) after T017 and T020.
- US3 (T025–T026) after T021.
- US4: T027 after T017 → T028; T029 after T028; T030 any time (server); T031 after T029.
- Polish after all stories; T035 needs T029 and T030.

### Parallel Opportunities

- Setup: T002–T006 together after T001.
- Foundational: T007, T009, T010, T011 together (T008 after T007).
- US1: T012–T015 together; relay (T016–T017) alongside client (T018–T019).
- T025 alongside T023/T024; T030 alongside any code task.

## Parallel Example: User Story 1

```bash
Task: "Write relay/rooms.test.ts"
Task: "Write relay/relay.e2e.test.ts part 1"
Task: "Write src/games/turbo-tumble/net.test.ts part 1"
Task: "Write e2e/online.spec.ts"
```

## Implementation Strategy

1. Setup + Foundational.
2. US1 (MVP): relay core + game client; `yarn e2e` proves a two-browser race.
3. US2 isolation and input validation, US3 failure handling, US4 limits and deploy.
4. Polish: review, commit, deploy, live check.

## Notes

- The relay never imports game code; the game imports only `relay/protocol.ts` from the relay.
- No player data in logs; the per-address counter forgets an address when it reaches 0.
- The whole-site Playwright suite (features 001/002 pages) is still a separate feature; this feature's own scenarios are automated here.
