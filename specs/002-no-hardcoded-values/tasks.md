---

description: "Task list for feature 002: one source of truth for fixed values"
---

# Tasks: One source of truth for fixed values

**Input**: Design documents from `/specs/002-no-hardcoded-values/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/fixed-sets.md, quickstart.md

**Tests**: requested by FR-008 and constitution VII/VIII: unit tests for the enum helper and the
routes helper, and a stray-literal check over `src/`. Existing settings tests stay green.

**Organization**: US2 (the owner changes a value in one place) carries the code changes; US1
(visitors notice nothing) verifies them, so it runs after US2 even though both are P1; US3 is docs.

**Fixed values**: every enum value MUST equal today's text exactly
([contracts/fixed-sets.md](contracts/fixed-sets.md)); only member keys are new.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

No setup: no new dependencies or config.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T001 Write `src/shared/enum.test.ts` (`node:test`, `node:assert/strict`, imports `./enum.ts`): `values({A: 'a', B: 'b'} as const)` deep-equals `['a', 'b']` in declaration order; `isMember(E, 'a')` is true, `isMember(E, 'A')` (a key, not a value), `'c'`, `undefined`, `null`, `1`, `'toString'` and `'__proto__'` are false. Run `yarn test` and confirm it fails (no `enum.ts` yet)
- [X] T002 Create `src/shared/enum.ts`: `export const values = <E extends Record<string, string>>(e: E) => Object.values(e) as E[keyof E][]` and `export const isMember = <E extends Record<string, string>>(e: E, v: unknown): v is E[keyof E] => typeof v === 'string' && (Object.values(e) as string[]).includes(v)`, with a one-line comment pointing to constitution VIII for the const-object enum shape; `yarn test` passes

**Checkpoint**: helper tested; stories can start.

---

## Phase 3: User Story 2 - The owner changes a value in one place (Priority: P1) 🎯 MVP

**Goal**: each of the ten fixed sets in [data-model.md](data-model.md) has exactly one definition, and no code writes its member values out (FR-001, FR-004, FR-005).

**Independent Test**: `yarn test` (stray-literal check) and quickstart step 2 (add a `Track` member → type-check points at the track data map).

### Tests for User Story 2

- [X] T003 [US2] Write `src/no-stray-literals.test.ts`: import `Route` (`./shared/routes.ts`), `GameSlug` (`./games/index.ts`), `Track`, `KartStyle` (`./games/turbo-tumble/settings.ts`) and `RaceState`, `MsgType`, `Item`, `Action`, `PlayerMode`, `EditTab` (`./games/turbo-tumble/enums.ts`, which has no three.js import so `node --test` can load it); read every `.ts`/`.tsx` under `src/` except `*.test.ts`; for each enum value `v`, find whole quoted occurrences `'v'`, `"v"` or `` `v` ``; fail listing `file:line value` for any occurrence outside the enum's own definition object. Allow-list exactly: `'Player 1'` and `'Player 2'` in `src/games/turbo-tumble/settings.ts` `defaults()` (research R5), and `'/'` in `src/shared/router.tsx` (URL path syntax, not the home route; see T007). Confirm the test fails before the implementation tasks
- [X] T004 [US2] Write `src/shared/routes.test.ts`: `Route.Home === '/'`, `Route.Games === '/games/'`, `gameRoute(GameSlug.TurboTumble) === '/games/turbo-tumble/'`, and `gameRoute(g.slug)` ends in `/` for every entry in `games`. Run `yarn test` and confirm it fails (no `routes.ts` yet)

### Implementation for User Story 2

- [X] T005 [US2] In `src/games/index.ts` add `export const GameSlug = { TurboTumble: 'turbo-tumble' } as const` and its type; type `GameEntry.slug` as `GameSlug`; the Turbo Tumble entry uses `GameSlug.TurboTumble`
- [X] T006 [US2] Create `src/shared/routes.ts` (after T005): `export const Route = { Home: '/', Games: '/games/' } as const; export type Route = typeof Route[keyof typeof Route]; export const gameRoute = (slug: GameSlug) => \`${Route.Games}${slug}/\`` (import type `GameSlug` from `../games/index.ts`); T004 passes
- [X] T007 [US2] Use routes everywhere: `src/App.tsx` (`Route.Home`, `Route.Games`, `gameRoute(g.slug)` for the map keys), `src/shared/Layout.tsx` (logo and nav hrefs), `src/pages/Home.tsx` (card hrefs via `gameRoute`, "All games" via `Route.Games`), `src/pages/Games.tsx` (card hrefs), `src/pages/NotFound.tsx` (home link). `src/shared/router.tsx` keeps its `/` and `/index.html` path handling (URL syntax, not routes)
- [X] T008 [US2] In `src/games/turbo-tumble/settings.ts` replace the tuples with `export const Track = { Meadow: 'Meadow', Desert: 'Desert', Snow: 'Snow', Neon: 'Neon' } as const` and `export const KartStyle = { Classic: 'Classic', Buggy: 'Buggy', Rocket: 'Rocket' } as const` plus their types (the type `MapName` becomes `Track`); `defaults()` uses `KartStyle.Classic`, `KartStyle.Buggy`, `Track.Meadow`; validation uses `isMember` from `../../shared/enum.ts`; delete `isIn`. Update `src/games/turbo-tumble/settings.test.ts` to build expectations from the enums where it names tracks/styles (saved-JSON fixtures stay literal strings, they are stored data)
- [X] T009 [US2] Create `src/games/turbo-tumble/enums.ts` (no imports) defining and exporting `RaceState` (`Menu: 'menu', Count: 'count', Race: 'race', Done: 'done'`), `MsgType` (`Hello: 'hello', Join: 'join', Leave: 'leave', Me: 'me', Start: 'start', State: 's', Goo: 'goo', Pop: 'pop', Zap: 'zap'`), `Item` (`Turbo: 'turbo', Goo: 'goo', Zap: 'zap'`), `Action` (`Up: 'up', Down: 'down', Left: 'left', Right: 'right', Drift: 'drift', Item: 'item'`), `PlayerMode` (`One: '1 Player', Two: '2 Players', Online: 'Online'`), `EditTab` (`P1: 'Player 1', P2: 'Player 2'`), each with its derived type
- [X] T010 [US2] Replace every literal use in `src/games/turbo-tumble/game.ts`, importing from `./enums.ts`: `State` type → `RaceState` (all `state ===`/`!==`/`=` uses); `Msg` union `t:` fields and every `send({t: …})` / `m.t ===` → `MsgType.*`; `Item` type, `ICON` (`Record<Item, string>` keyed by `[Item.Turbo]` etc.), `ITEMS = values(Item)`, `useItem` comparisons; `Action` type and `CONTROLS` keys (`[Action.Up]: 'KeyW'`…), the touch `data-a` attributes in `MARKUP` interpolated from `Action`, and the touch handler's `a === 'item'` checks; `STYLES` and `MAPS` keyed by `[KartStyle.*]` / `[Track.*]`, `RACERS[].style` and `buildKart`'s `'Buggy'`/`'Rocket'` checks via `KartStyle`; every `MapName` import and annotation → `Track`; `isIn(MAP_NAMES|KART_STYLES, …)` → `isMember(Track|KartStyle, …)`; menu rows from `values(KartStyle)`, `values(Track)`, `values(PlayerMode)`, `values(EditTab)`; players-row logic compares the picked label to `PlayerMode.Two` / `PlayerMode.Online` instead of `i === 1` / `i === 2`, and `netInfo` highlights `es ? PlayerMode.Online : cfg.two ? PlayerMode.Two : PlayerMode.One`; leave `ac.state !== 'running'` (browser value). Rename the DOM names that share text with enum values, so the stray-literal check needs no exceptions: `#menu` → `#garage` and `.item` → `.item-slot` in `MARKUP`, every `$()` lookup and `querySelector` call, and the selectors in `src/games/turbo-tumble/game.css` (no visible change). `yarn build` and `yarn test` pass
- [X] T011 [US2] Run quickstart step 2: add `Moon: 'Moon'` to `Track`, run `yarn build`, confirm the only error is the missing `MAPS` entry, then revert

**Checkpoint**: one definition per set; stray-literal and routes tests green.

---

## Phase 4: User Story 1 - Visitors notice nothing (Priority: P1)

**Goal**: zero behaviour change (FR-002, FR-003, FR-007, SC-002).

**Independent Test**: quickstart step 3.

- [X] T012 [US1] In `yarn preview`, run spec 001 quickstart steps 4–6: direct load and reload of `/`, `/games/`, `/games/turbo-tumble/`, `/games`, `/index.html`, `/nope`; a race on each track (Meadow, Desert, Snow, Neon) in 1P and one in 2P, picking up and using each item; R, G, M keys; touch buttons with touch emulation; garage edits (name, colours, skin, kart style Classic/Buggy/Rocket, Player 1/Player 2 tabs); a legacy save `{"name":"Old","color":"#123456","helmet":"#ffffff","skin":"#ffe0bd","style":"Rocket"}`; the online "not available" message; leaving and returning mid-race; the garage panel and item slot look as before after the DOM renames. No console errors; fix any difference in `src/` and re-run `yarn test`

**Checkpoint**: parity confirmed.

---

## Phase 5: User Story 3 - No server details in the repo's docs and examples (Priority: P2)

**Goal**: FR-006, SC-004.

**Independent Test**: quickstart step 4.

- [X] T013 [P] [US3] `README.md` hosting section: describe the server by role, no concrete paths: "the web root (the path in `DEPLOY_TARGET`)", "Caddy's site config on the server", "a daily job on the server keeps Cloudflare's ranges in the firewall", "prune old files in the web root's `assets/`"; keep commands that use only placeholders or config keys
- [X] T014 [P] [US3] `.env.example`: `DEPLOY_TARGET=<user>@<server>:<web-root>/` and `SITE_URL=https://<domain>/`; `scripts/deploy.ts` header comment uses the same placeholders
- [X] T015 [US3] Run quickstart step 4 (`grep -nE '/srv/|/etc/|@[0-9]+\.[0-9]+|root@[a-z0-9]' README.md .env.example scripts/*.ts` prints nothing)

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T016 Run `yarn build` and `yarn test` once more; confirm `git grep -nE "MAP_NAMES|KART_STYLES|isIn\(|MapName" -- src` is empty
- [X] T017 Run `/code-review` on the full diff (constitution gate); fix each finding or record a one-line waiver; re-review fixes
- [X] T018 Commit, with the review waivers and the plan's recorded constitution VII decision in the commit message
- [X] T019 `yarn deploy` (its live check must pass)

---

## Dependencies & Execution Order

- Foundational (T001–T002) blocks everything.
- US2: T003, T004 (tests, fail) → T005 → T006 → T007; T008 → T009 → T010 → T011.
- US1 (T012) needs US2 done.
- US3 (T013–T015) is independent of US1/US2 and can run any time after Phase 2.
- Polish: T016 → T017 → T018 → T019.

### Parallel Opportunities

- T003 and T004 (different test files).
- T013 and T014 (different files), alongside any US2 task.
- The two US2 chains (routes T005–T007, game T008–T010) touch different files and can interleave.

## Parallel Example: User Story 3

```bash
Task: "Describe the server by role in README.md"
Task: "Placeholders in .env.example and the scripts/deploy.ts header"
```

## Implementation Strategy

1. Phase 2 helper → US2 enums (MVP: the rule holds and is enforced by a test).
2. US1 parity pass.
3. US3 docs.
4. Polish: review, commit, deploy.

## Notes

- Enum values never change; only keys are new ([contracts/fixed-sets.md](contracts/fixed-sets.md)).
- Saved-settings JSON in tests stays literal: it is stored data, not code.
