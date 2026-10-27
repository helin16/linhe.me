# linhe.me

Lin He's personal site: a home page and small games you can play in the browser. It's a React +
TypeScript single-page app built with Vite. Project rules live in
[.specify/memory/constitution.md](.specify/memory/constitution.md).

## Run it

Needs Node 24 or later.

```sh
npm ci            # install exact locked dependencies
npm run dev       # dev server with hot reload
npm run build     # type-check, then build the site into dist/
npm run preview   # serve dist/ at http://localhost:4173
npm test          # self-checks (node --test)
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

## Hosting

The site is moving to a Vultr VPS (Caddy serving `dist/`), set up as a separate feature.
Until then the live site on Bluehost stays on the last pre-rebuild version: **do not run `git pull`
on Bluehost any more**, or it will serve the unbuilt app and break.

## Working on it

After every change, run `/code-review` on the diff before committing (see `CLAUDE.md`).
Non-trivial features go through Spec Kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks`
→ `/speckit-implement`.
