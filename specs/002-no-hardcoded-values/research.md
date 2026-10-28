# Research: One source of truth for fixed values

## R1. Enum shape

- **Decision**: every fixed set is `export const X = { Member: 'value', ... } as const;` plus
  `export type X = typeof X[keyof typeof X];`, the shape constitution v2.3.0 VIII prescribes. One
  shared helper module `src/shared/enum.ts` provides `values(X)` (the members as an array, in
  declaration order) and `isMember(X, v)` (a type guard for untrusted data such as saved settings
  or network messages).
- **Rationale**: works under `erasableSyntaxOnly` and `node --test` type stripping; the union type
  makes `Record<X, …>` maps and `switch` statements exhaustive, so adding a member makes the
  type-check point at every place to update (FR-004, SC-003). The helper replaces the current
  `isIn(list, v)` in `settings.ts` and is used by settings, game and router code.
- **Alternatives considered**: `enum` keyword (forbidden by VIII); plain tuples `['A', 'B'] as const`
  (what `MAP_NAMES` is today: no member names, so code still writes `'Buggy'` literals).

## R2. Where each set lives

- **Decision**: a set lives with the code that owns it (constitution II: one folder per game).
  - Site-wide: `src/shared/routes.ts` (`Route`, plus `gameRoute(slug)`), `src/games/index.ts`
    (`GameSlug`).
  - Turbo Tumble: `src/games/turbo-tumble/settings.ts` (`Track`, `KartStyle`, used by saved data),
    `src/games/turbo-tumble/enums.ts` (`RaceState`, `MsgType`, `Item`, `Action`, `PlayerMode`,
    `EditTab`; no imports, so unit tests load it without three.js).
- **Rationale**: shared code only for what several pages use; game-specific sets stay in the game
  folder so removing the game removes them.
- **Alternatives considered**: one global `constants.ts` (couples games together, breaks II).

## R3. Values that must not change

- **Decision**: enum values equal today's text: track and kart names (saved in `tt-cfg` and shown
  in the menu), network message types `hello join leave me start s goo pop zap` (wire format),
  item kinds `turbo goo zap`, control actions `up down left right drift item` (also used as the touch
  buttons' `data-a` attributes, now interpolated from the enum), menu labels `1 Player`, `2 Players`,
  `Online`, `Player 1`, `Player 2`.
- **Rationale**: FR-002/FR-003; zero behaviour change (US1).

## R4. Player mode and edit tab logic

- **Decision**: the menu rows keep the same order and labels, built from `values(PlayerMode)` and
  `values(EditTab)`. Logic that used row indexes (`i === 1`, `i === 2`, `es ? 2 : +cfg.two`) compares
  against `PlayerMode` members instead; the edit tab keeps a numeric index into `cfg.players`,
  derived from `values(EditTab).indexOf(tab)`.
- **Rationale**: removes index-as-meaning literals without changing saved settings (`two`
  stays a boolean, FR-002).

## R5. Default player names

- **Decision**: the default names `Player 1` / `Player 2` in `settings.ts` stay as data defaults;
  they are not the edit-tab set, even though the text matches.
- **Rationale**: a player's default name and a menu tab label are different concepts; tying them
  would make renaming a tab rename players' defaults. The stray-literal check (R6) lists them as an
  allowed exception.

## R6. Keeping it that way

- **Decision**: add `src/no-stray-literals.test.ts`, a unit test that reads every `.ts`/`.tsx` file
  under `src/` and fails if any enum member value (quoted) appears outside its definition, with a
  three-entry allow-list (default player names in `settings.ts`; `'/'` as URL path syntax in `router.tsx`); test files are skipped. It imports
  the enums, so new members are covered automatically. The DOM id `menu` and class `item`, which
  share text with `RaceState.Menu` and `Action.Item`, are renamed (`garage`, `item-slot`) so the
  check needs no further exceptions.
- **Rationale**: turns SC-001 into a check that runs with `yarn test` on every commit, so the rule
  can't quietly erode (constitution VII: tests with the code they cover).
- **Alternatives considered**: a lint rule (adds ESLint, a dependency for one rule); a manual
  `grep` in the quickstart (easy to skip).

## R7. Server details in docs

- **Decision**: the README describes the server by role ("the web root in `DEPLOY_TARGET`",
  "Caddy's site config", "a daily job on the server"); `.env.example` and the comment in
  `scripts/deploy.ts` use placeholders only, e.g. `DEPLOY_TARGET=<user>@<server>:<web-root>/`.
- **Rationale**: FR-006; the real values stay in the owner's private `.env`.
