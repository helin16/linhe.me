# Data model: 3D look, focus camera and overview map (008 + 009)

Nothing here is sent online or changes the battle (`Battle`, `Tank`, `Terrain` and the messages of 007
are unchanged). Only `Settings` is saved.

## View (camera.ts)

| Field | Type | Meaning |
|---|---|---|
| `cx`, `cy` | number | Centre of the view, in field units (sim axes: y down) |
| `halfW` | number | Half the width of field shown |

Every camera function also takes the screen's `aspect` (width ÷ height). The view shows
`halfH = halfW / aspect` above and below `cy`.

Rules:
- `CLOSE_HALF_W = WORLD_W / 4` (008 FR-001, a first guess).
- The whole field: `wholeHalfW(aspect) = max(WORLD_W / 2, (WORLD_H / 2) · aspect)`, so both the field's width
  and height fit, like today's `fit()` (on a wide landscape phone the height decides).
- `halfW` stays between `CLOSE_HALF_W` and `wholeHalfW(aspect)`.
- Sideways: `cx` stays within `[halfW, WORLD_W − halfW]`; if the view is wider than the field, `cx = WORLD_W / 2`.
- Up and down: `cy` stays within `[halfH, WORLD_H − halfH]` (never below the field's bottom, never above its top);
  if the view is taller than the field, `cy = WORLD_H / 2`.
- A shot view holds both the firing tank and the shell in x **and** y with padding:
  `halfW ≥ |Δx| / 2 + SHOT_PAD` and `halfW ≥ (|Δy| / 2 + SHOT_PAD) · aspect`, capped at `wholeHalfW(aspect)`.

## CameraMode (enum)

`Follow` (turn start, driving, aiming, falling) → `Shot` (from firing until the blast settles) →
`Follow` on the next turn. `Held` when a player drags or taps the overview map or uses `[`/`]`; it goes
back to `Follow` when the active tank drives or fires (then `Shot`), when a turn starts, or on `F`.
`Whole` when the battle is over (whole field). (Not to be confused with the overview *map*.)

```text
turn starts ──► Follow ──fire──► Shot ──settled──► (next turn) Follow
                  ▲  │                    │
        drive/F   │  └─drag/tap/[ ]──► Held ◄─┘ (drag during a shot)
                  └────────────────────┘
battle over ──► Whole
```

## Camera (per screen, game.ts)

| Field | Type | Meaning |
|---|---|---|
| `mode` | CameraMode | as above |
| `view` | View | what is shown now |
| `target` | View | where it is gliding to |
| `held` | View or null | the place a player moved the view to |

## Settings (settings.ts, saved on the device)

- Removed: `style`. An old saved `style` is ignored; other fields load as before.
- Added: `overview: boolean`, default `true` (008 FR-014).

## Ground chunks (ground.ts)

| Field | Type | Meaning |
|---|---|---|
| `index` | number | Chunk number, `0 … ceil(GRID_W / CHUNK_CELLS) − 1`, `CHUNK_CELLS = 32` |
| per material | `{ positions, normals, uvs, indices }` | Typed arrays for that chunk's front face, walls and top strip |

A blast dirties the chunks whose columns it touched; only those are rebuilt.

## Models (models.ts)

- **Tank model**: per `TankType` and `Variant`: hull, turret, cannon pivot (barrels from `gunOf`), tracks,
  wheels. Inputs: colour, wreck flag, bonus gear (wheels, edge, ring, missile).
- **Crate**, **parachute**, **shell**, **missile**, **props** (ruin, sandbags, fence, logs) per map.
