# Data Model: Rebuild linhe.me as a typed single-page site

## GameSettings (Turbo Tumble garage)

Stored in the visitor's browser under `localStorage` key `tt-cfg` as JSON. Shape is unchanged from
today (FR-004); see [contracts/game-module.md](contracts/game-module.md#saved-settings).

| Field | Type | Rules |
|---|---|---|
| `players` | `[PlayerLook, PlayerLook]` | always two entries (player 1, player 2) |
| `two` | boolean | `true` = two-player split-screen |
| `map` | `'Meadow' \| 'Desert' \| 'Snow' \| 'Neon'` | chosen track; a saved name that isn't one of these falls back to `'Meadow'` |
| `muted` | boolean | sound muted |

**PlayerLook**

| Field | Type | Rules |
|---|---|---|
| `name` | string | max 10 characters (input `maxlength`) |
| `color` | `#rrggbb` | kart colour |
| `helmet` | `#rrggbb` | helmet colour |
| `skin` | `#rrggbb` | one of the 7 skin tones |
| `style` | `'Classic' \| 'Buggy' \| 'Rocket'` | kart style |

**Defaults**: P1 `Player 1`, `#ff4444`, `#ffffff`, `#ffe0bd`, `Classic`; P2 `Player 2`, `#22cc88`,
`#222222`, `#c68642`, `Buggy`; `two: false`, `map: 'Meadow'`, `muted: false`.

**Load rules** (in order):
1. Storage missing, blocked (throws) or not valid JSON → defaults.
2. Legacy single-player save (top-level `name`): its `name/color/helmet/skin/style` become player 1,
   player 2 keeps its default, and the top-level fields are dropped.
3. Saved fields are merged over defaults (same as today's `Object.assign`).

**Save**: whole object written back as JSON after every garage change; storage errors are ignored.

## GameEntry (games list, FR-016)

One array in `src/games/index.ts`, read by the home page, the games page and the router.

| Field | Type | Used for |
|---|---|---|
| `slug` | string | route `/games/<slug>/` and folder `src/games/<slug>/` |
| `name` | string | card title, page title |
| `summary` | string | home page card text |
| `description` | string | games page card text |
| `homeTag` / `tag` | string | tag chip on home / games page cards |
| `art` | string | card emoji (`aria-hidden`) |
| `load` | `() => Promise<{ default: ComponentType }>` | lazy-loads the game's page component |

Turbo Tumble's entry copies today's card text exactly.
