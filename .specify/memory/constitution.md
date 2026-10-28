<!--
Sync Impact Report
- Version change: 2.2.0 → 2.3.0 (MINOR: new principle VIII)
  - Added principle: VIII. No Hard-Coded Values; Enums for Fixed Sets
  - Hosting & Deployment Constraints: the no-hard-coded-addresses rule now points to VIII
  - Follow-up: feature 002 (specs/002-no-hardcoded-values) brings the code in line
- Previous amendment: 2.1.0 → 2.2.0 (MINOR: Yarn replaces npm; new hosting rule on configuration)
  - I: dependencies are locked by the committed `yarn.lock` (Yarn 4, pinned via `packageManager`)
  - VI: wording only ("each new dependency")
  - Development Workflow & Quality Gates: gates renamed to `yarn build`, `yarn test`, `yarn e2e`
  - Hosting & Deployment Constraints: added "server addresses and site URLs are never hard-coded"
    and "deploys run via `yarn deploy`"
- Previous amendment: 2.0.1 → 2.1.0 (MINOR: new principle VII, quality gates expanded)
  - Added principle: VII. Every Function Unit Tested, Every Journey End-to-End Tested
  - Development Workflow & Quality Gates: `npm test` and `npm run e2e` gates added; the hand
    checks shrink to what automation can't cover (real iPad); the relay self-check rule is
    folded into VII
  - Follow-up: feature 001 (React/TypeScript port) predates VII and needs its tests added
- Previous amendment: 2.0.0 → 2.0.1 (PATCH: principle I scoped to project source)
- Earlier amendment: 1.1.0 → 2.0.0 (MAJOR: principle I redefined, hosting replaced)
- Modified principles:
  - I. Static Files, No Build Step → I. TypeScript Everywhere, Built with Vite
  - II. One Self-Contained Folder per Game: paths moved to src/games/<slug>/, shared code rules added
  - V. Isolated, Optional Multiplayer Relays: relays are Node + TypeScript services on the VPS
  - VI. Simplicity First: dependencies now come from npm with a lockfile
- Unchanged principles: III. Playable Without a Server; IV. Keyboard and Touch on Every Device
- Modified sections: Hosting & Deployment Constraints (Bluehost/cPanel/.htaccess → Vultr VPS +
  Caddy serving dist/ only); Development Workflow & Quality Gates (typecheck/build gate, relay
  self-check in TypeScript); /code-review gate kept
- Added sections: none
- Removed sections: none
- Deferred TODOs: none
-->

# linhe.me Constitution

## Core Principles

### I. TypeScript Everywhere, Built with Vite

- All project source MUST be TypeScript or TSX with `strict` enabled: the React front end, the
  games and the relays. No Python, no plain `.js`/`.mjs` source files, no other languages.
  Tooling that Spec Kit and Claude Code generate and manage (`.specify/`, `.claude/`) is exempt
  and is never part of the build.
- The only non-TypeScript source files allowed are plain `.css` stylesheets, Vite's single
  `index.html` shell, and config/data files (JSON, YAML, Caddyfile).
- The front end is React, built with Vite. Only the build output (`dist/`) is ever served.
- Third-party code MUST come from the npm registry, installed with Yarn 4 (version pinned in
  `package.json` `packageManager`), with exact versions locked by the committed `yarn.lock`.
  No runtime script tags from CDNs.

Rationale: one language and one toolchain for the site, the games and the relays; types are shared
between game clients and relays.

### II. One Self-Contained Folder per Game

- Each game MUST live in `src/games/<slug>/` and be lazy-loaded at its own route
  (`/games/<slug>/`), so it ships as its own chunk.
- A game MUST NOT import from another game's folder. Code shared between games (site shell,
  relay client, UI bits) lives in `src/shared/` and MUST be used by at least two games or pages.
- Adding a game = its folder + one entry in the games list. Removing a game = deleting the folder
  and its entry, with nothing else left broken.

Rationale: games can be built, changed and retired independently, without regressions elsewhere.

### III. Playable Without a Server

- Single-player and same-device multiplayer MUST work from the built site with no relay.
- Online play is an optional extra: when the relay is unreachable or full, the game MUST show a
  plain message and keep offline modes fully usable. It MUST NOT hang or block the menu.

Rationale: a relay outage or restart must never break the site or offline play.

### IV. Keyboard and Touch on Every Device

- Every game MUST be fully playable with a keyboard on desktop and with touch on iPad and phones
  (Safari included), with no hover-only or mouse-only controls.
- Layouts MUST fit phone width without horizontal scrolling and respect safe-area insets.
- Site pages MUST support light and dark mode via shared CSS colour tokens, set `lang`, and give
  decorative elements `aria-hidden` and meaningful ones text or labels.

Rationale: the main players are family and friends on iPads as much as on computers.

### V. Isolated, Optional Multiplayer Relays

- Relays MUST be Node + TypeScript services, game-agnostic message forwarders over WebSockets,
  addressed per game and per room (e.g. `/relay/<game>/<room>`). A message MUST only reach clients
  in the same game and room.
- Each game's relay traffic and failures MUST NOT affect another game or the static site: a crash
  or restart leaves other games, rooms and pages running.
- Any internet-facing relay MUST use WSS, require a room code, cap message size and room size,
  and keep no player data beyond what live rooms need.
- A game MUST find its relay through one configurable address (same origin by default), not a
  hard-coded host.

Rationale: more multiplayer games are planned; they share infrastructure but not fate.

### VI. Simplicity First

- Prefer the platform: browser APIs and Node built-ins before libraries. Each new dependency needs
  a stated reason in the plan.
- Fewest files that work. No abstractions, config or scaffolding for needs that don't exist yet.
- Delete unused code, styles, routes and links in the same change that orphans them.

Rationale: a small personal site stays maintainable only if it stays small.

### VII. Every Function Unit Tested, Every Journey End-to-End Tested

- Every function and React component exported from a module under `src/` (and from relay
  source) MUST have unit tests covering its normal behaviour, edge cases and failure paths.
  Unit test function coverage of those modules MUST be 100%, as reported by the unit test run.
- Code that only runs inside a real browser (WebGL rendering, Web Audio, pointer/touch input,
  the animation loop) MUST be exercised by end-to-end tests instead; it is not mocked to reach
  unit coverage.
- Every user story acceptance scenario and every public route MUST have an automated
  end-to-end test that runs against the production build in real browser engines: Chromium,
  WebKit (Safari, with touch emulation for iPad) and Firefox.
- Every relay MUST have end-to-end tests that start it, connect real clients and assert room
  and game isolation.
- A bug fix MUST add a test that fails without the fix.
- Tests are written with the code they cover, in the same change; a change that lowers
  coverage or skips a failing test does not pass review.

Rationale: games and relays are hard to check by eye on every device; automated unit and
end-to-end tests keep "plays exactly as before" true as more games are added.

### VIII. No Hard-Coded Values; Enums for Fixed Sets

- Values that differ between environments (server addresses, hostnames, site URLs, ports, keys,
  tokens, file system paths on a host) MUST come from configuration (`.env` / environment), never
  from source, docs examples or scripts. Committed examples use placeholders.
- Any value used in more than one place MUST be defined once as a named constant and imported
  everywhere it is used.
- Any fixed set of choices (tracks, kart styles, routes, message types, item kinds, game slugs)
  MUST be one enum, declared as a const object plus its derived union type
  (`export const X = { A: 'A' } as const; export type X = typeof X[keyof typeof X];`). The
  TypeScript `enum` keyword is not used (it breaks `erasableSyntaxOnly` and `node --test`). Code
  compares against the enum, never against string or number literals of its members.
- One-off tuning values inside a game (speeds, colours, sizes, track points) MAY stay in that game's
  own folder, as named constants or data tables, not repeated inline.
- When the allowed values of an enum or a configuration value are not known from the spec or the
  code, ask the owner instead of guessing. Adding an enum for values already known needs no sign-off.

Rationale: one source of truth per value stops copies drifting apart (a track renamed in one file
but not another) and keeps environment details out of a public repo.

## Hosting & Deployment Constraints

- Production is one Vultr VPS. Caddy serves `dist/` for linhe.me with automatic HTTPS and reverse
  proxies `/relay/...` to the relay services. Bluehost and cPanel are not used.
- The web root MUST contain only build output. The repo, `.git`, tooling folders, specs, docs and
  relay source are never placed in or served from it.
- Relays run as their own `systemd` services, separate from Caddy, and restart on failure.
- Deploys MUST run through `yarn deploy` (`scripts/deploy.ts`): committed tree only, locked
  install, tests and build first, then a check that the live site serves the new build and its
  assets (and that a relay endpoint answers, once relays exist).
- Server addresses, hostnames and site URLs MUST NOT be hard-coded in the repo (principle VIII).
  They come from a git-ignored `.env`; the committed `.env.example` documents the keys with
  placeholder values.
- Secrets, credentials and private keys MUST NEVER be committed; the repo is public. `.env`
  files are git-ignored.

## Development Workflow & Quality Gates

- Non-trivial features and every new game go through Spec Kit: `/speckit-specify` →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Small fixes may skip it.
- Every change, of any size and with or without Spec Kit, MUST be followed by `/code-review` on
  the resulting diff before it is committed or deployed. Each finding MUST be fixed, or waived
  with a one-line reason in the commit message. Changes made to fix findings get reviewed again.
- Before commit, all of these MUST pass with no errors (principle VII):
  1. `yarn build` (type-check plus Vite build);
  2. `yarn test` (unit tests, with the 100% function coverage check);
  3. `yarn e2e` (end-to-end tests against the production build in Chromium, WebKit and
     Firefox, with no console errors).
- The end-to-end suite MUST include, for every game: loading with no console errors, playing
  with keyboard and with touch, single-player with no relay running, and (when online play is
  touched) two clients in one room that don't leak into another room or game.
- Before a release that touches a game, also play it once by hand on a real iPad, since
  emulation can't prove touch feel and frame rate.
- `README.md` MUST be updated whenever run, build, test, deploy or relay steps change.

## Governance

- This constitution overrides other project practices. Plans MUST include a Constitution Check
  and justify any exception in their complexity tracking.
- Amendments: edit this file via `/speckit-constitution`, state the reason in the commit message,
  and update `README.md` if workflow changes.
- Versioning: MAJOR for removing or redefining a principle, MINOR for adding a principle or
  section or materially expanding one, PATCH for wording fixes.
- Compliance: no change ships without its `/code-review` pass and passing unit and end-to-end
  tests; each review and
  `/speckit-analyze` run checks changes against these principles. Runtime guidance lives in
  `README.md`.

**Version**: 2.3.0 | **Ratified**: 2026-10-28 | **Last Amended**: 2026-10-28
