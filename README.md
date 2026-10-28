# linhe.me

Lin He's personal site: a home page and small games you can play in the browser. It's a React +
TypeScript single-page app built with Vite. Project rules live in
[.specify/memory/constitution.md](.specify/memory/constitution.md).

## Run it

Needs Node 24 or later and Yarn 4. The exact Yarn version is pinned in `package.json`, and
corepack fetches it: Node 25+ no longer bundles corepack, so install it once with
`npm i -g corepack && corepack enable`. After that, plain `yarn` uses the pinned version.

```sh
yarn install --immutable   # install exactly what yarn.lock says
yarn dev                   # dev server with hot reload
yarn build                 # type-check, then build the site into dist/
yarn preview               # serve dist/ at http://localhost:4173
yarn relay                 # the online relay on localhost (dev and preview pass /relay to it)
yarn test                  # unit + relay end-to-end tests, 100% function coverage for relay code
yarn e2e:local             # browser tests here: Chromium and WebKit/iPad (Playwright)
yarn e2e                   # all three engines incl. Firefox (what CI runs; Firefox won't start on every Mac)
```

Before the first `yarn e2e`, install the browsers once: `yarn playwright install chromium webkit firefox`.

`dist/` is the whole publishable site; nothing else in the repo is served.

## Layout

- `src/pages/`: home, games list, not-found
- `src/shared/`: site header/footer and the small router
- `src/games/index.ts`: the one games list, read by both pages and the router
- `src/games/<slug>/`: one self-contained folder per game
- `relay/`: the online relay (server code, never served); `relay/protocol.ts` is the wire format games import
- `e2e/`: browser end-to-end tests

## Add a game

1. Create `src/games/<slug>/index.tsx` that default-exports the game's page component. For an
   imperative game, render a `<div>` and call your `mount(root)` in `useEffect`, returning its
   cleanup (see `specs/001-react-typescript-port/contracts/game-module.md`).
2. Add one entry to `src/games/index.ts`. The game appears on the home and games pages at
   `/games/<slug>/`, loaded only when opened.

## Online play

In Turbo Tumble, choose Online, then Create room: the game shows a 4-character room code and a
Copy link button. Friends open the link (or choose Online and type the code) and tap Join; up to 4
players race, and the first player is the host who picks the track and starts.

The relay ([`relay/`](relay/), specs in `specs/003-online-relay`) is game-agnostic: rooms live in
memory per game and code, messages only reach the same room, and nothing about players is kept or
logged once a room empties. Its limits come from `RELAY_*` settings (defaults in
[`relay/config.ts`](relay/config.ts), keys in `.env.example`). The game finds it at the same site's
`/relay/` unless `VITE_RELAY_URL` says otherwise; a relay on another host also needs the site's
Content-Security-Policy `connect-src` to allow it.

## Hosting and deploy

The site runs on a VPS (Ubuntu) behind Cloudflare (proxied, SSL mode Full (strict)). Caddy serves
the web root (the folder in `DEPLOY_TARGET`, a copy of `dist/`) with a Let's Encrypt certificate;
its site config lives in Caddy's config on the server.

The server address, the site URL and the relay folder are not in the repo. Copy `.env.example`
to `.env` (git-ignored) and fill in `DEPLOY_TARGET`, `SITE_URL` and `DEPLOY_RELAY_DIR`, then:

```sh
yarn deploy   # committed, pushed tree only: tests, browser tests, CI must have passed, then relay and site, each checked
yarn deploy --skip-ci   # same, without waiting for GitHub CI (owner's call when CI is red or unreadable)
```

[`scripts/deploy.ts`](scripts/deploy.ts) refuses to run with uncommitted or unpushed changes, runs the
tests and the local browser tests, and waits for the [`ci`](.github/workflows/ci.yml) workflow (all
three browsers, on Linux) to pass for that commit. It then ships the relay first: the bundle
(`dist-relay/relay.mjs`) and its service file go to `DEPLOY_RELAY_DIR`, the hardened `linhe-relay`
systemd service (restarts on failure) is linked and restarted, and the live relay must answer with a
room code. Only then does the site go up: everything else first and `index.html` last (an
interrupted deploy leaves the old page live), followed by a check that the live page names the new
build's entry files and every file in the build's `assets/` is served. It never deletes anything on
the server: old `assets/` files stay so visitors with an older page open can still load its chunks
(prune old files in the web root's `assets/` by hand if it ever grows large).

One-time server setup for the relay: install Node 24 or later (Ubuntu 26.10's `nodejs` package is 24) and add a
`handle /relay/* { reverse_proxy 127.0.0.1:<RELAY_PORT> }` route to Caddy's site config.

The server accepts SSH with keys only. Ports 80/443 only accept Cloudflare's IP ranges (IPv4 and
IPv6), so the site can't be reached around Cloudflare; a daily job on the server adds any new ranges
Cloudflare publishes to the firewall. Caddy renews the certificate itself through Cloudflare (Cloudflare
passes `/.well-known/acme-challenge/` to port 80 without redirecting it). If renewal ever fails,
Cloudflare shows error 526: check `journalctl -u caddy` on the server.

## Working on it

After every change, run `/code-review` on the diff before committing (see `CLAUDE.md`).
Non-trivial features go through Spec Kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks`
→ `/speckit-implement`.
