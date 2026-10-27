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
yarn test                  # unit tests (node --test)
```

`dist/` is the whole publishable site; nothing else in the repo is served.

## Layout

- `src/pages/`: home, games list, not-found
- `src/shared/`: site header/footer and the small router
- `src/games/index.ts`: the one games list, read by both pages and the router
- `src/games/<slug>/`: one self-contained folder per game

## Add a game

1. Create `src/games/<slug>/index.tsx` that default-exports the game's page component. For an
   imperative game, render a `<div>` and call your `mount(root)` in `useEffect`, returning its
   cleanup (see `specs/001-react-typescript-port/contracts/game-module.md`).
2. Add one entry to `src/games/index.ts`. The game appears on the home and games pages at
   `/games/<slug>/`, loaded only when opened.

## Turbo Tumble online mode

Not available yet: choosing Online shows a message, and 1 player and 2-player split-screen work as
normal. Online play returns with the new Node/TypeScript relay.

## Hosting and deploy

The site runs on a VPS (Ubuntu) behind Cloudflare (proxied, SSL mode Full (strict)). Caddy serves
`/srv/linhe.me` (a copy of `dist/`) with a Let's Encrypt certificate; its config is
`/etc/caddy/Caddyfile` on the server.

The server address and the site URL are not in the repo. Copy `.env.example` to `.env`
(git-ignored) and fill in `DEPLOY_TARGET` and `SITE_URL`, then:

```sh
yarn deploy   # committed tree only: install, test, build, upload, then check the live site
```

[`scripts/deploy.ts`](scripts/deploy.ts) refuses to run with uncommitted changes, uploads
everything else first and `index.html` last (an interrupted deploy leaves the old page live), then
checks that the live page names the new build's entry files and that every file in the build's
`assets/` is served. It never deletes anything on the server: old `assets/` files stay so visitors
with an older page open can still load its chunks (prune `/srv/linhe.me/assets` by hand if it ever
grows large). There is no relay yet, so there is no relay endpoint to check.

The server accepts SSH with keys only. Ports 80/443 only accept Cloudflare's IP ranges (IPv4 and
IPv6), so the site can't be reached around Cloudflare; `/etc/cron.daily/ufw-cloudflare` adds any
new ranges Cloudflare publishes. Caddy renews the certificate itself through Cloudflare (Cloudflare
passes `/.well-known/acme-challenge/` to port 80 without redirecting it). If renewal ever fails,
Cloudflare shows error 526: check `journalctl -u caddy` on the server.

## Working on it

After every change, run `/code-review` on the diff before committing (see `CLAUDE.md`).
Non-trivial features go through Spec Kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks`
→ `/speckit-implement`.
