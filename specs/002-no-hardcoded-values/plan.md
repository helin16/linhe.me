# Implementation Plan: One source of truth for fixed values

**Branch**: `master` (no feature branch) | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-no-hardcoded-values/spec.md`

## Summary

Replace every written-out member of the ten fixed sets (routes, game slugs, tracks, kart styles,
race states, network message types, items, control actions, player modes, edit tabs) with
const-object enums, each defined once next to the code that owns it, plus a tiny shared helper for
listing members and validating untrusted values. A unit test scans the source for stray copies so
the rule holds from now on. Docs and examples describe the server by role with placeholders only.
No behaviour, stored data, wire format or screen text changes.

## Technical Context

**Language/Version**: TypeScript 7.0 (`strict`, `erasableSyntaxOnly`), TSX

**Primary Dependencies**: unchanged (react 19.3, three 0.128.0; vite 8, Yarn 4.18.1). No new
dependencies.

**Storage**: browser `localStorage['tt-cfg']`, format unchanged

**Testing**: `yarn build` (type-check), `yarn test` (`node --test`): new `src/shared/enum.test.ts`,
`src/shared/routes.test.ts` and `src/no-stray-literals.test.ts`; existing settings tests; spec 001 manual parity checks

**Target Platform**: unchanged (Safari 16.4+, Chrome/Edge/Firefox 2023+)

**Project Type**: single-page web app

**Performance Goals**: no change (const objects add no runtime cost of note)

**Constraints**: zero behaviour change; enum values fixed by [contracts/fixed-sets.md](contracts/fixed-sets.md)

**Scale/Scope**: about 10 files in `src/`, plus README, `.env.example`, `scripts/deploy.ts`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. TypeScript, Vite | TS only, no new deps | Pass |
| II. One folder per game | Game enums stay in `src/games/turbo-tumble/`; shared code (`enum.ts`, `routes.ts`) is used by several modules | Pass |
| III. Playable without a server | Unchanged | Pass |
| IV. Keyboard and touch | Controls unchanged; `data-a` values interpolated from `Action` | Pass |
| V. Relays | Wire format values unchanged (contract) | Pass |
| VI. Simplicity | Const objects + one 2-function helper; no lint dependency | Pass |
| VII. Tests | New helpers and the stray-literal check get unit tests; no coverage report or e2e suite yet | Waived by the owner (see Complexity Tracking) |
| VIII. No hard-coded values | This feature implements it | Pass |
| Hosting | Docs and examples lose concrete server paths (FR-006) | Pass |
| Workflow | `/code-review` before commit; README updated | Pass |

**Post-design re-check**: unchanged: all Pass except VII, waived by the owner for this feature.

## Project Structure

### Documentation (this feature)

```text
specs/002-no-hardcoded-values/
├── plan.md
├── research.md          # R1–R7
├── data-model.md        # the ten enums
├── quickstart.md
├── contracts/fixed-sets.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── enum.ts               # NEW: values(), isMember()
│   ├── enum.test.ts          # NEW
│   ├── routes.ts             # NEW: Route, gameRoute()
│   ├── routes.test.ts        # NEW
│   ├── router.tsx            # unchanged
│   └── Layout.tsx            # links from Route
├── no-stray-literals.test.ts # NEW: scans src/ for written-out enum values
├── App.tsx                   # matches Route / gameRoute
├── pages/Home.tsx, Games.tsx, NotFound.tsx   # links from Route / gameRoute
└── games/
    ├── index.ts              # GameSlug; entries use it
    └── turbo-tumble/
        ├── settings.ts       # Track, KartStyle as const objects; isIn → isMember
        ├── settings.test.ts  # uses enums
        ├── enums.ts          # NEW: RaceState, MsgType, Item, Action, PlayerMode, EditTab
        ├── game.ts           # uses the enums; DOM #menu → #garage, .item → .item-slot
        └── game.css          # selectors follow the DOM renames
README.md, .env.example, scripts/deploy.ts      # server described by role, placeholders only
```

**Structure Decision**: same layout as feature 001; two small shared modules added.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| VII: no 100% coverage report and no automated e2e suite for this feature; US1 parity is checked by hand (T012) | the test-suite feature isn't built yet; the owner waived the gate for feature 002 on 2026-10-28 | building the suite first would delay a behaviour-neutral clean-up; the new pure helpers still get unit tests and the stray-literal check runs on every `yarn test` |
