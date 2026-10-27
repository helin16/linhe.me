---

description: "Task list for the React + TypeScript rebuild of linhe.me"
---

# Tasks: Rebuild linhe.me as a typed single-page site

**Input**: Design documents from `/specs/001-react-typescript-port/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: one self-check only, required by constitution v2.0.1 for non-trivial pure logic: the saved
settings loader (`settings.test.ts`, `node --test`). Everything else is verified by `npm run build`
and the manual steps in quickstart.md.

**Organization**: tasks are grouped by user story so each story can be built and checked on its own.

**Source of truth for "same as today"**: the pre-rebuild files at git `HEAD` (`git show HEAD:<path>`):
`index.html`, `games/index.html`, `style.css`, `games/turbo-tumble/index.html`. Copy text, markup,
styles and logic from there; do not reinvent them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: which user story this task belongs to (US1–US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: a Vite + React + TypeScript project that builds an empty app.

- [X] T001 Create `package.json` at repo root: `"private": true`, `"type": "module"`, `"engines": {"node": ">=24"}`; scripts `"dev": "vite"`, `"build": "tsc --noEmit && vite build"`, `"preview": "vite preview"`, `"test": "node --test 'src/**/*.test.ts'"`; then `npm install --save-exact react@19.3.1 react-dom@19.3.1 three@0.128.0` and `npm install --save-exact -D vite@8.3.5 @vitejs/plugin-react@6.1.2 typescript@7.0.2 @types/react@19.3.0 @types/react-dom@19.3.0 @types/three@0.128.0 @types/node@26.6.5` (writes `package-lock.json`)
- [X] T002 [P] Create `tsconfig.json`: `strict`, `noEmit`, `target`/`lib` ES2022 + DOM + DOM.Iterable, `module` ESNext, `moduleResolution` bundler, `jsx` react-jsx, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `skipLibCheck`, `types` ["vite/client", "node"], `include` ["src", "vite.config.ts"]
- [X] T003 [P] Create `vite.config.ts` with `defineConfig({ base: '/', plugins: [react()] })` (keep Vite's default build target, research R3)
- [X] T004 [P] Create `.gitignore` with `node_modules/`, `dist/`, `.env`, `.env.*`, `.DS_Store`, `.claude/settings.local.json` (FR-014)
- [X] T005 Replace root `index.html` with the Vite shell: `<!doctype html>`, `lang="en"`, charset, `<meta name="viewport" content="width=device-width,initial-scale=1">`, `<meta name="description" content="Small games by Lin He that you can play in your browser.">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="mobile-web-app-capable" content="yes">`, `<title>Lin He</title>`, `<div id="root"></div>`, `<script type="module" src="/src/main.tsx"></script>`
- [X] T006 Create `src/main.tsx` rendering `<StrictMode><App /></StrictMode>` into `#root` with `createRoot`, importing `./site.css`; create a stub `src/App.tsx` returning `null` and move `style.css` to `src/site.css` with `git mv` (content unchanged); run `npm run build` and confirm it passes

**Checkpoint**: `npm run build` succeeds and `npm run dev` serves a blank page with no console errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: routing and the games list, used by every story.

- [X] T007 Create `src/shared/router.tsx` per contracts/routes.md: `usePath()` (via `useSyncExternalStore` on `popstate` + a custom event), `navigate(path)` (`history.pushState` + notify), and `<Link href>` that intercepts plain left-clicks only (pass through Ctrl/Cmd/Shift/Alt, middle button, `target`, external URLs); a `normalise(path)` that maps `/index.html` → `/` and adds a trailing slash (`/games` → `/games/`), applied on load and in `usePath` with `history.replaceState` when it changes the URL
- [X] T008 [P] Create `src/games/index.ts` exporting `type GameEntry = { slug; name; summary; description; homeTag; tag; art; load: () => Promise<{ default: ComponentType }> }` and `games: GameEntry[]` with Turbo Tumble: slug `turbo-tumble`, name `Turbo Tumble`, art `🏎️`, summary `3D kart racing with drifts, items and four tracks.`, homeTag `1–2 players · iPad ready`, description and tag copied exactly from `games/index.html` at HEAD (`Race three rivals over four themed tracks. Drift to charge a boost, and grab item boxes for turbos, goo and zaps. Customise your driver and kart, and race a friend split-screen.` / `Keyboard or touch · 1–2 players`), `load: () => import('./turbo-tumble/index.tsx')`
- [X] T009 Implement `src/App.tsx`: read `usePath()`; if it matches `/games/<slug>/` for an entry in `games`, render that game's page via a module-level `lazy(entry.load)` per entry inside `<Suspense fallback={null}>`; otherwise render a temporary fallback `<p>Not found</p>` (replaced in US2); create a stub `src/games/turbo-tumble/index.tsx` that default-exports a component returning `null` (replaced by T015)

**Checkpoint**: `npm run build` passes; `/games/turbo-tumble/` routes to the stub game page.

---

## Phase 3: User Story 1 - Play Turbo Tumble exactly as before (Priority: P1) 🎯 MVP

**Goal**: the game at `/games/turbo-tumble/` looks, sounds and plays exactly as today (FR-001–FR-004, FR-010, FR-017, FR-018).

**Independent Test**: quickstart.md steps 5 and 6 (parity on all four tracks, 1P/2P, keyboard and touch, saved settings, leaving and returning).

### Tests for User Story 1

- [X] T010 [P] [US1] Write `src/games/turbo-tumble/settings.test.ts` (`node:test` + `node:assert/strict`, imports `./settings.ts`): defaults for `null`, for `'not json'` and for `'null'`; merge of a full saved object keeps its values; legacy save `{"name":"Old","color":"#123456","helmet":"#ffffff","skin":"#ffe0bd","style":"Rocket"}` becomes player 1 with those values, player 2 keeps defaults (`Player 2`, `#22cc88`, `#222222`, `#c68642`, `Buggy`) and top-level `name/color/helmet/skin/style` are gone; saved `map` not in `Meadow | Desert | Snow | Neon` falls back to `'Meadow'`; `saveSettings` does not throw when `localStorage` is missing or throws. Run `npm test` and confirm it fails (no settings.ts yet)

### Implementation for User Story 1

- [X] T011 [US1] Create `src/games/turbo-tumble/settings.ts` per data-model.md: types `PlayerLook {name; color; helmet; skin; style: 'Classic' | 'Buggy' | 'Rocket'}` (name "max 10 characters"), `Settings {players: [PlayerLook, PlayerLook]; two: boolean; map: 'Meadow' | 'Desert' | 'Snow' | 'Neon'; muted: boolean}`; `defaults()` with today's values (P1 `Player 1`, `#ff4444`, `#ffffff`, `#ffe0bd`, `Classic`; `two: false`, `map: 'Meadow'`, `muted: false`); `loadSettings(raw: string | null)` that never throws, applies the legacy migration and merge exactly as the HEAD script (lines ~115–130), plus the unknown-map fallback; `saveSettings(s)` writing `localStorage['tt-cfg']` and ignoring errors; `npm test` passes
- [X] T012 [P] [US1] Create `src/games/turbo-tumble/game.css` from the `<style>` block of `games/turbo-tumble/index.html` at HEAD, scoped per research R6: `html,body{…}` → `.tt{position:fixed;inset:0;…}` with the same declarations (background, font, colour, `touch-action:none`, user-select, touch-callout, `overflow:hidden`); `input` → `.tt input`; `button` / `button:disabled` → `.tt button` / `.tt button:disabled`; every `body.two` / `body.touch` → `.tt.two` / `.tt.touch`; every other selector prefixed with `.tt `; no selector may target `html`, `body` or bare elements outside `.tt`
- [X] T013 [US1] Create `src/games/turbo-tumble/game.ts` by porting the `<script>` of `games/turbo-tumble/index.html` at HEAD line-for-line into `export function mount(root: HTMLElement): () => void` (contracts/game-module.md): `import * as THREE from 'three'`; add class `tt` to `root` and set `root.innerHTML` to the HEAD `<body>` markup (`#hud` … `#end`); `$ = (id: string) => root.querySelector('#' + id)` typed per element; replace `document.body.prepend` / `document.body.classList` with `root`; use `loadSettings(localStorage.getItem('tt-cfg'))` / `saveSettings` from `./settings.ts` (wrap the `localStorage` read in try/catch); add explicit types for every function, object and array (no `any`, no `@ts-ignore`); keep all numbers, colours, track data, AI, items, audio and online code unchanged
- [X] T014 [US1] In `src/games/turbo-tumble/game.ts` implement cleanup: one `AbortController` whose `signal` is passed to every `addEventListener` (window, document and elements); store the previous `<meta name="viewport">` content and set `width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover` on mount; the returned function calls `abort()`, `renderer.setAnimationLoop(null)`, `renderer.dispose()`, `renderer.forceContextLoss()`, closes the `AudioContext` if created, closes any open `EventSource`, restores the viewport meta, and empties `root` and removes its classes
- [X] T015 [US1] Replace the stub `src/games/turbo-tumble/index.tsx`: default-export `TurboTumble` that imports `./game.css`, renders `<div ref={ref} />`, and in `useEffect` calls `mount(ref.current)` and returns its cleanup; sets `document.title = 'Turbo Tumble'` while mounted (restoring the previous title on cleanup)
- [X] T016 [US1] Delete the old game page: `git rm games/turbo-tumble/index.html` (the live Bluehost site stays the side-by-side baseline); run `npm run build` and `npm test`, then quickstart.md steps 5 and 6 in `npm run dev` and `npm run preview`

**Checkpoint**: the game is playable at `/games/turbo-tumble/` with full parity; MVP done.

---

## Phase 4: User Story 2 - Browse the site and find the games (Priority: P2)

**Goal**: home, games and not-found pages with today's content, client-side navigation and working direct addresses (FR-005–FR-009, FR-016).

**Independent Test**: quickstart.md step 4.

### Implementation for User Story 2

- [X] T017 [US2] Create `src/shared/Layout.tsx`: `Layout({ title, current, children })` rendering the header from `index.html` at HEAD (`<a class="logo">linhe<span>.me</span></a>`, nav Home / Games with `aria-current="page"` on the current one, all via `<Link>`), `<main class="wrap">{children}</main>`, and the footer `© {year} Lin He · <a href="https://github.com/helin16">GitHub</a>` with the year from `new Date().getFullYear()`; sets `document.title = title` in an effect
- [X] T018 [P] [US2] Create `src/pages/Home.tsx` from `index.html` at HEAD: `Layout` title `Lin He`, the `.hero` (h1 `Lin He`, intro `Welcome to Lin's show ground: a few small games you can play right in your browser.`), `<section id="games">` with h2 `Games`, one card per `games` entry (`<Link class="card" href="/games/<slug>/">`, `.art.kart` with `art` and `aria-hidden`, `summary`, `homeTag`), and `<p><Link href="/games/">All games →</Link></p>`
- [X] T019 [P] [US2] Create `src/pages/Games.tsx` from `games/index.html` at HEAD: `Layout` title `Games · Lin He`, hero (h1 `Games`, `Small games that run in your browser. No downloads or sign-ups needed.`), cards from `games` using `description` and `tag`, then the `aria-hidden` "More coming soon" / "Next game" / "In the works." card
- [X] T020 [P] [US2] Create `src/pages/NotFound.tsx`: `Layout` title `Not found · Lin He`, hero h1 `Page not found`, `<p><Link href="/">Go to the home page</Link></p>`
- [X] T021 [US2] Update `src/App.tsx`: `/` → `Home`, `/games/` → `Games`, game routes as before, anything else → `NotFound` (remove the temporary fallback); `className` on `Link` must map to the existing `.card`/`.logo` CSS in `src/site.css`
- [X] T022 [US2] Delete `games/index.html` with `git rm`; run `npm run build`, then quickstart.md step 4 in `npm run preview` (direct load + reload of `/`, `/games/`, `/games/turbo-tumble/`, `/games`, `/nope`; no three.js chunk on `/` and `/games/`; light/dark; 375px width)

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Online mode says clearly it isn't available yet (Priority: P3)

**Goal**: choosing Online with no relay shows the existing message and keeps 1P/2P usable (FR-011, SC-006).

**Independent Test**: quickstart.md step 6, last bullet.

### Implementation for User Story 3

- [X] T023 [US3] Verify in `npm run dev` and `npm run preview` that choosing Online in `src/games/turbo-tumble/game.ts` shows "Online play isn't available here (it needs the game server), or the room is full." within 5 seconds; if the stream instead keeps retrying (readyState `CONNECTING` because the server answers with an error status), make `es.onerror` in `goOnline()` treat a stream that has not received `hello` within 5 seconds as failed (close it and show the same message), keeping the 1 Player / 2 Players options working

**Checkpoint**: US3 works without affecting US1/US2.

---

## Phase 6: User Story 4 - The project is easy to work on and safe to publish (Priority: P3)

**Goal**: clean repo, clear README, build output only (FR-012–FR-015).

**Independent Test**: quickstart.md steps 1–3.

### Implementation for User Story 4

- [X] T024 [P] [US4] Delete the Bluehost-era files: `git rm .htaccess games/turbo-tumble/server.py` and `rm check_htaccess.py` (untracked); confirm the empty `games/` folder is gone
- [X] T025 [P] [US4] Rewrite `README.md`: what the site is; prerequisites (Node 24+); `npm ci`, `npm run dev`, `npm run build`, `npm run preview`, `npm test`; how to add a game (folder in `src/games/<slug>/` + entry in `src/games/index.ts`, contracts/game-module.md); online play is not available until the relay feature; hosting moves to the Vultr VPS (separate feature) and **do not `git pull` on Bluehost** any more (research R10); the `/code-review` rule from `CLAUDE.md`
- [X] T026 [US4] Run quickstart.md steps 1–3 (`npm ci`, build, test, `find dist -type f` shows only `dist/index.html` and `dist/assets/*`, `git status` ignores `node_modules/`, `dist/`, `.env`, `.DS_Store`)

**Checkpoint**: all stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T027 Delete anything orphaned by the move (constitution VI): check `src/site.css` for rules no page uses and remove them; check `grep -rn "games/index.html\|style.css\|htaccess\|server.py" --exclude-dir=node_modules --exclude-dir=specs .` returns nothing outside history
- [ ] T028 Run the full quickstart.md (steps 1–6) once more on desktop (Chrome, Firefox, Safari) and an iPad on iPadOS 16.4+, with the browser console open; fix any error
- [X] T029 Run `/code-review` on the full diff (constitution gate); fix each finding or record a one-line waiver for the commit message; re-review fixes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup; blocks all stories.
- **US1 (Phase 3)**: after Foundational. MVP.
- **US2 (Phase 4)**: after Foundational; independent of US1 (the game route already exists from T009).
- **US3 (Phase 5)**: after US1 (it lives in the game module).
- **US4 (Phase 6)**: after Setup; T024 can run any time, T026 after US1 and US2.
- **Polish (Phase 7)**: after all stories; T029 last.

### Within Each Story

- US1: T010 (test, fails) → T011 (settings, test passes) → T012 ∥ T013 → T014 → T015 → T016.
- US2: T017 → T018 ∥ T019 ∥ T020 → T021 → T022.

### Parallel Opportunities

- Setup: T002, T003, T004 together after T001.
- Foundational: T008 alongside T007.
- US1: T010 and T012 together; T012 alongside T013.
- US2: T018, T019, T020 together after T017.
- US4: T024 and T025 alongside any story.

---

## Parallel Example: User Story 2

```bash
# After T017 (Layout) is done:
Task: "Create src/pages/Home.tsx from index.html at HEAD"
Task: "Create src/pages/Games.tsx from games/index.html at HEAD"
Task: "Create src/pages/NotFound.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 US1: the game at `/games/turbo-tumble/` with full parity.
3. **Stop and validate** with quickstart.md steps 5–6. Nothing is deployed in this feature.

### Incremental Delivery

1. Setup + Foundational → empty app builds.
2. + US1 → game works (MVP).
3. + US2 → site pages and navigation.
4. + US3 → online message confirmed.
5. + US4 → repo cleanup and README.
6. Polish → full quickstart, `/code-review`, then one commit (no deploy).

---

## Notes

- Keep the port faithful: no gameplay, tuning or visual changes; type the existing code, don't redesign it.
- `[P]` = different files, no unfinished dependencies.
- Do not run `git pull` on Bluehost after this lands.
