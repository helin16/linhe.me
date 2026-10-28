# Data Model: One source of truth for fixed values

Each fixed set is a const-object enum (research R1). Values are exactly today's text (R3).

| Enum | Members → value | Defined in | Used by |
|---|---|---|---|
| `Route` | `Home` → `/`, `Games` → `/games/`; `gameRoute(slug)` → `/games/<slug>/` | `src/shared/routes.ts` | App, Layout, Home, Games, NotFound |
| `GameSlug` | `TurboTumble` → `turbo-tumble` | `src/games/index.ts` | games list, `gameRoute` |
| `Track` | `Meadow`, `Desert`, `Snow`, `Neon` (value = name) | `src/games/turbo-tumble/settings.ts` | saved settings, track data, menu, `start` message |
| `KartStyle` | `Classic`, `Buggy`, `Rocket` (value = name) | `settings.ts` | saved settings, kart stats/meshes, racers, menu |
| `RaceState` | `Menu` → `menu`, `Count` → `count`, `Race` → `race`, `Done` → `done` | `enums.ts` | race loop, HUD, input, render |
| `MsgType` | `Hello` → `hello`, `Join` → `join`, `Leave` → `leave`, `Me` → `me`, `Start` → `start`, `State` → `s`, `Goo` → `goo`, `Pop` → `pop`, `Zap` → `zap` | `enums.ts` | online send/receive (wire format, see [contracts/fixed-sets.md](contracts/fixed-sets.md)) |
| `Item` | `Turbo` → `turbo`, `Goo` → `goo`, `Zap` → `zap` | `enums.ts` | item boxes, HUD icons, `useItem` |
| `Action` | `Up` → `up`, `Down` → `down`, `Left` → `left`, `Right` → `right`, `Drift` → `drift`, `Item` → `item` | `enums.ts` | keyboard maps, touch buttons (`data-a`) |
| `PlayerMode` | `One` → `1 Player`, `Two` → `2 Players`, `Online` → `Online` | `enums.ts` | players menu row |
| `EditTab` | `P1` → `Player 1`, `P2` → `Player 2` | `enums.ts` | customise menu row (tab order = player order) |
| `EndAction` | `Again` → `again`, `Garage` → `garage` | `enums.ts` | race-finished screen buttons (`data-end`); found in review, the eleventh set |

Rules:
- Untrusted input (saved settings, network messages) is checked with `isMember(Enum, value)`
  before use; invalid values fall back as today (saved track → Meadow, style → default, unknown
  message ignored).
- `Record<Enum, …>` maps (track data, kart stats, item icons, key bindings) must list every member,
  so the type-check catches a missing one.
- Menu order is the enum's declaration order (`values(Enum)`), matching today's order.

`enums.ts` is `src/games/turbo-tumble/enums.ts` (no imports, so tests can load it without three.js).
DOM names that shared text with enum values are renamed so code never spells an enum value for
another purpose: `#menu` → `#garage-menu`, `.item` → `.item-slot` (internal; no visible change).

Not enums (unchanged): the browser's `AudioContext.state` values, default player names
(`settings.ts`, research R5), and one-off tuning numbers, colours and track points.
