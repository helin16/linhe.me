# Contract: Game module

How a game plugs into the site (constitution II, FR-010, FR-016).

## Page component

Each game folder `src/games/<slug>/` default-exports a React component from `index.tsx`. It renders
one root `<div>` and, in a `useEffect`, calls the game's `mount(root)` and returns its cleanup.

```ts
// src/games/<slug>/game.ts
export function mount(root: HTMLElement): () => void
```

`mount` guarantees:
- It renders all of the game's DOM inside `root` and queries elements only within `root`.
- All window/document listeners it adds are removed by the returned cleanup.
- Cleanup stops the animation loop, disposes the renderer and its WebGL context, closes audio and
  any network connection, restores any `<meta name="viewport">` change, and leaves the page as it
  was before `mount`.
- Calling `mount` again after cleanup starts a fresh game (React StrictMode does this in dev).

Styles live in the game folder and are scoped under the game's root class (`.tt` for Turbo Tumble);
no game stylesheet may select `html`, `body`, or bare elements outside its root.

## Saved settings

Turbo Tumble reads and writes `localStorage['tt-cfg']` as JSON, shape in
[data-model.md](../data-model.md#gamesettings-turbo-tumble-garage). The key and shape MUST NOT change
in this feature, so existing saves keep working (FR-004).

```ts
// src/games/turbo-tumble/settings.ts
export function loadSettings(raw: string | null): Settings   // never throws
export function saveSettings(s: Settings): void               // ignores storage errors
```

## Online option (until the relay feature)

Choosing "Online" opens `EventSource('events')` relative to the game page, exactly as today. With
no relay the stream fails and the menu shows: "Online play isn't available here (it needs the game
server), or the room is full." 1- and 2-player modes stay usable.
