# Quickstart: validate the rebuild

**Prerequisites**: Node 24 or later, npm. A second checkout of the current site (or the live
Bluehost site, which stays on the old version) for side-by-side comparison.

## 1. Install and type-check

```sh
npm ci
npm run build      # type-check + production build into dist/
npm test           # settings self-check (node --test)
```

Expected: no type errors; build succeeds; all tests pass.

## 2. Build contains only site files (FR-013)

```sh
find dist -type f
```

Expected: `dist/index.html` plus files under `dist/assets/` only (hashed `.js`/`.css`, no `.ts`,
`.md`, `.py`, specs or tooling).

## 3. Git ignores generated and private files (FR-014, FR-015)

```sh
touch .env && mkdir -p tmp && touch .DS_Store tmp/.DS_Store
git status --short
rm -rf .env tmp .DS_Store
ls .htaccess check_htaccess.py games/turbo-tumble/server.py
```

Expected: `git status` lists none of `node_modules/`, `dist/`, `.env`, `.DS_Store`; the `ls` reports
all three Bluehost-era files missing.

## 4. Routes and direct addresses (US2, SC-005)

```sh
npm run preview    # serves dist/ at http://localhost:4173
```

For each of `/`, `/games/`, `/games/turbo-tumble/`, `/games`, `/nope`: open it directly, reload it,
and click through via the header. Check against [contracts/routes.md](contracts/routes.md): right
page, right title, no full reload when clicking, back/forward work, `/games` becomes `/games/`,
`/nope` shows not-found. In DevTools Network, `/` and `/games/` must not download the three.js chunk.
Light and dark mode both render; at 375px width there is no sideways scroll.
In Chrome DevTools, run Lighthouse (Performance, mobile) on `/` in `npm run preview`: Time to
Interactive under 2 s.

## 5. Game parity (US1, SC-001, SC-003)

Side by side with the old version, on desktop (keyboard) and an iPad on iPadOS 16.4+ (touch):
- each track (Meadow, Desert, Snow, Neon) in 1 player: same look, rivals, drift boost, items
  (turbo/goo/zap), laps, position, timer, minimap, wrong-way warning, results;
- one 2-player split-screen race: P1 WASD/Space/E, P2 arrows/Right Shift/Enter, stereo sides;
- R restarts, G opens garage, M mutes; touch toolbar does the same;
- garage: name (max 10), kart and helmet colour, skin, kart style, stats;
- mid-race, resize the window (desktop) and rotate the iPad, in 1P and 2P: views fill the screen
  with no stretching, and the split stays in the middle;
- on macOS: load the game and finish one race in Chrome, Firefox and Safari (Edge uses Chrome's
  engine); no console errors.

## 6. Saved settings, cleanup and online message (FR-004, FR-010, US3)

- In the old version on the same origin, set a custom garage; open the new version: settings match.
  (Locally: in DevTools set `localStorage['tt-cfg']` to a saved value from the old version, including
  a legacy one like `{"name":"Old","color":"#123456","helmet":"#ffffff","skin":"#ffe0bd","style":"Rocket"}`.)
- Set `localStorage['tt-cfg']` to `not json`: the game starts with defaults.
- Mid-race, click back to `/games/`: sound stops, page scrolls normally, buttons look like the site's.
  Return to the game: one clean game, no doubled sound or controls; no console errors.
- Choose Online: the "isn't available" message shows within 5 seconds; switch to 1 player and race.

## 7. Do not deploy

Do not run `git pull` on Bluehost after this lands; the live site stays on the old version until the
VPS feature switches DNS.
