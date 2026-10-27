# Implementation Plan: Rebuild linhe.me as a typed single-page site

**Branch**: `master` (no feature branch) | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-react-typescript-port/spec.md`

## Summary

Rebuild the static site as a React + TypeScript single-page app built with Vite. The home, games and
not-found pages become React pages behind a tiny in-house router; Turbo Tumble is ported line-for-line
to strict TypeScript as a `mount(root)` module on three.js r128 from npm, lazy-loaded on its own
route, with its styles scoped so they can't leak. Saved garage settings keep their storage key and
shape. Online stays on today's code path and shows its "not available" message. The Bluehost-era
`.htaccess`, its check script and the Python server are deleted; a `.gitignore` is added.

## Technical Context

**Language/Version**: TypeScript 7.0 (`strict`), TSX; CSS for styles

**Primary Dependencies**: react 19.3, react-dom 19.3, three 0.128.0; dev: vite 8.3,
@vitejs/plugin-react 6.1, typescript 7.0, @types/react, @types/react-dom, @types/three 0.128.0,
@types/node

**Storage**: browser `localStorage` key `tt-cfg` (unchanged)

**Testing**: `npm run build` (type-check + build); `node --test` on `settings.test.ts`; manual
parity checks in [quickstart.md](quickstart.md)

**Target Platform**: browsers: Safari 16.4+ (iPadOS/iOS/macOS), Chrome/Edge/Firefox from 2023
(Vite 8 default target); Node 24+ for tooling

**Project Type**: single-page web app (static build, no server code in this feature)

**Performance Goals**: game smooth for a full 2P race on iPadOS 16.4+ iPads (SC-003); home page
interactive < 2 s and free of the three.js chunk (SC-004)

**Constraints**: identical rendering (r128, FR-017); same public addresses (FR-005); same
`tt-cfg` format (FR-004); no CDN scripts; `dist/` holds only site files

**Scale/Scope**: 3 pages + not-found, 1 game (~800 lines to port), room for more games

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. TypeScript everywhere, Vite | All code `.ts`/`.tsx` strict; CSS files + one `index.html`; npm deps locked; three from npm, no CDN | Pass |
| II. One folder per game | `src/games/turbo-tumble/`, lazy route chunk, no cross-game imports; shared site shell/router in `src/shared/` used by 3 pages | Pass |
| III. Playable without a server | Offline modes untouched; online fails with the existing message | Pass |
| IV. Keyboard and touch | Controls ported unchanged; game CSS scoped; site light/dark + phone width kept; viewport no-zoom only while the game is mounted | Pass |
| V. Isolated relays | No relay in this feature; online code path unchanged until the relay feature | Pass (N/A) |
| VI. Simplicity | No router library, no test runner, one game module + settings module; each dependency justified in [research.md](research.md) | Pass |
| Hosting | Nothing deployed; `dist/` is build output only; README warns not to `git pull` on Bluehost | Pass |
| Workflow gates | `npm run build` and `npm test` in quickstart; `/code-review` before commit; README updated | Pass |

**Post-design re-check (after Phase 1)**: still all Pass. One note for reviewers: the game keeps its
own imperative DOM for menu/HUD inside React (research R5); this is a parity decision, not a
violation, so Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-react-typescript-port/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R10
├── data-model.md        # Phase 1: GameSettings, GameEntry
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── routes.md        # public addresses and router rules
│   └── game-module.md   # mount(root) contract, saved settings, online behaviour
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
index.html                     # Vite shell (replaces the old static home page)
package.json, package-lock.json
tsconfig.json
vite.config.ts
.gitignore                     # node_modules/, dist/, .env, .env.*, .DS_Store, .claude/settings.local.json
src/
├── main.tsx                   # createRoot + <App/>
├── App.tsx                    # route map: /, /games/, /games/<slug>/, not-found
├── site.css                   # was style.css (tokens, layout, cards)
├── shared/
│   ├── router.tsx             # usePath(), <Link>, navigate(); trailing-slash normalising
│   └── Layout.tsx             # header, footer, sets document.title
├── pages/
│   ├── Home.tsx
│   ├── Games.tsx
│   └── NotFound.tsx
└── games/
    ├── index.ts               # GameEntry[] (the one games list)
    └── turbo-tumble/
        ├── index.tsx          # page component: root div + useEffect(mount)
        ├── game.ts            # ported game: mount(root) => cleanup
        ├── game.css           # ported styles, scoped under .tt
        ├── settings.ts        # loadSettings/saveSettings (pure)
        └── settings.test.ts   # node --test self-check

# deleted: style.css, games/index.html, games/turbo-tumble/index.html,
#          games/turbo-tumble/server.py, .htaccess, check_htaccess.py
```

**Structure Decision**: one Vite app at the repo root. Pages live in `src/pages/`; each game is a
self-contained folder under `src/games/`; only code used by several pages goes in `src/shared/`.
Old static files are removed in the same change (constitution VI).

## Complexity Tracking

No violations to justify.
