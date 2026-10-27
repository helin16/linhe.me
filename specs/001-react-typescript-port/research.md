# Research: Rebuild linhe.me as a typed single-page site

All Technical Context unknowns are resolved below. Versions were checked on npm on 2026-10-28.

## R1. Toolchain versions

- **Decision**: React 19.3, react-dom 19.3, Vite 8.3, @vitejs/plugin-react 6.1, TypeScript 7.0,
  Node 24 LTS or later (local machine has Node 26.7). Exact versions are locked by `package-lock.json`.
- **Rationale**: current stable releases; Node 24+ runs `.ts` test files directly (type stripping),
  so the self-check needs no extra test runner or loader.
- **Alternatives considered**: Next.js / Remix (server rendering and file routing the site doesn't
  need, and a server runtime the constitution doesn't want for static pages); Vitest (another
  dependency when `node --test` covers one small test file).

## R2. 3D library version (FR-017)

- **Decision**: `three@0.128.0` with `@types/three@0.128.0`, both from npm, pinned exactly.
- **Rationale**: same engine version as today's cdnjs `r128`, so lighting, colour management and
  shading are unchanged (the user chose identical looks in clarification Q1). Newer versions switch
  on physically-correct lights and sRGB output by default, which would change every track.
- **Alternatives considered**: latest three with re-tuned lights (rejected in Q1); keeping the CDN
  script tag (constitution I forbids runtime CDN scripts).

## R3. Browser target (FR-018)

- **Decision**: keep Vite 8's default `build.target` (`baseline-widely-available`).
- **Rationale**: that default is Safari 16.4, Chrome/Edge 111 and Firefox 114, which matches the
  clarified support floor (Q2) without any config.
- **Alternatives considered**: an explicit target list or legacy plugin (no older browsers to serve).

## R4. Routing

- **Decision**: a ~30-line in-house router in `src/shared/router.tsx`: reads `location.pathname`,
  listens to `popstate`, and a `<Link>` component that calls `history.pushState`. Routes are a plain
  map in `src/App.tsx`; paths are normalised to a trailing slash (`/games` → `/games/`).
- **Rationale**: the site has three routes plus not-found; React Router would be the only reason
  to add a dependency (constitution VI). React's `lazy` + `Suspense` already gives per-game chunks.
- **Alternatives considered**: React Router 7 (rejected as more than needed now; easy to adopt
  later if routes grow nested data loading); hash routing (changes today's addresses, breaks FR-005).

## R5. How the game runs inside React (FR-001–FR-004, FR-010)

- **Decision**: port the game script to TypeScript as one module exposing
  `mount(root: HTMLElement): () => void` (see [contracts/game-module.md](contracts/game-module.md)).
  The game keeps its own imperative DOM for menu and HUD: `mount` renders today's markup into
  `root` and runs the existing logic. A thin `TurboTumble.tsx` calls `mount` in `useEffect` and
  returns its cleanup.
- **Rationale**: the HUD updates every frame; driving it through React state would re-render 60
  times a second and means rewriting the menu logic, which risks changing how the game plays (P1).
  Keeping the proven imperative code gives parity with the least change. (This narrows the earlier
  idea of "React handles menus and HUD": React owns the page, the game owns its canvas and overlay.)
- **Cleanup**: every `addEventListener` gets one shared `AbortController` signal;
  `renderer.setAnimationLoop(null)`, `renderer.dispose()` + `forceContextLoss()`, `AudioContext.close()`,
  and any pending online connection is closed. React StrictMode's dev double-mount exercises this.
- **Alternatives considered**: react-three-fiber (rejected by the user); iframe of the old page
  (keeps plain JS, violates constitution I).

## R6. Game styles must not leak (FR-007, FR-010)

- **Decision**: move the game's `<style>` to `game.css`, scoped under a `.tt` root class:
  `html,body{…}` → `.tt{position:fixed;inset:0;…}`, `body.two`/`body.touch` → `.tt.two`/`.tt.touch`,
  bare `button`/`input` → `.tt button`/`.tt input`. The game toggles classes on its root, not `body`.
- **Rationale**: Vite keeps a lazily loaded chunk's CSS on the page after navigating away; today's
  global `overflow:hidden` and button styles would otherwise break scrolling and buttons on site pages.
- **Viewport**: the game sets `user-scalable=no, maximum-scale=1, viewport-fit=cover` on the
  viewport meta while mounted and restores the site's value on cleanup, so site pages stay zoomable.

## R7. Saved settings carry over (FR-004, SC-002)

- **Decision**: keep the `localStorage` key `tt-cfg` and its JSON shape exactly; move load/migrate/
  save into a pure `settings.ts` with a `node --test` self-check for defaults, corrupt data, blocked
  storage and the legacy single-player format.
- **Rationale**: same origin + same key = existing saves load untouched. This is the one piece of
  non-trivial pure logic, so it gets the constitution's runnable check.

## R8. Online option without a relay (FR-011, SC-006)

- **Decision**: keep today's online code path unchanged (`EventSource('events')` relative to the game
  page). With no relay, the request gets the app's HTML (or a 404) instead of an event stream, the
  browser closes the stream at once, and the existing message shows.
- **Rationale**: zero new code; the later relay feature replaces this path with WebSockets.
- **Verification**: quickstart step 6 confirms the message appears within 5 seconds in `npm run preview`.

## R9. Direct addresses and the build (FR-005, FR-013)

- **Decision**: Vite's dev server and `vite preview` already fall back to `index.html` for unknown
  paths, so `/games/` and `/games/turbo-tumble/` load directly. `base: '/'` keeps asset URLs absolute
  so nested routes resolve them. Caddy's equivalent (`try_files {path} /index.html`) belongs to the
  VPS feature.
- **Build contents**: `dist/` holds only `index.html`, hashed JS/CSS chunks and assets.

## R10. Live Bluehost site during the transition

- **Decision**: after this lands on `master`, nobody runs `git pull` on Bluehost; the live site keeps
  the last pre-rebuild checkout until the VPS feature moves DNS.
- **Rationale**: Bluehost serves the git checkout as-is; pulling would publish the unbuilt app shell
  and break the live site. Recorded in the README and quickstart.
