# Data Model: Tank Clash

All game state lives in memory in `sim.ts`; only settings are saved on the device. Units are world
units (field 1600 × 900, y down); hearts are stored in tenths.

## Enums (const objects, constitution VIII)

| Enum | Values |
|---|---|
| `TankType` | `Scout`, `Allrounder`, `Heavy`, `Artillery` |
| `MapId` | `GreenHills`, `TimberGap`, `LakeValley`, `FrostRidge`, `Random` (picker only) |
| `Material` | `Air`, `Earth`, `Snow`, `Ice`, `Wood`, `Water` |
| `Side` | `Left`, `Right` |
| `Grip` | `High`, `Medium`, `Low` |
| `Drop` | `Repair`, `Power`, `GripGear`, `Shield` |
| `Difficulty` | `Easy`, `Normal`, `Hard` |
| `Phase` | `Aim` (driving/aiming), `Flight`, `Settle`, `Over` |
| `MsgType` | see [contracts/messages.md](contracts/messages.md) |

## TankSpec (table in `tanks.ts`)

| Field | Type | Notes |
|---|---|---|
| `type` | `TankType` | |
| `minAngle`, `maxAngle` | degrees | measured from flat towards the enemy; within 0–85 |
| `damage` | tenths | Scout 8, Allrounder 10, Heavy 15, Artillery 18 |
| `hearts` | tenths | 30 / 40 / 50 / 30 |
| `grip` | `Grip` | High / Medium / Low / Low; no damage > 10 with grip better than Low |

## Look (garage, per player)

`name` (≤10 chars, blank → "Player N"), `color` (`#rrggbb`), `type` (`TankType`), and online only
`side` (`Side`). Cleaned on load and on receipt (`fixLook`); on one device player 2's colour is
changed if it equals player 1's.

## Settings (device storage)

`p1: Look`, `p2: Look`, `map: MapId` (default Random), `tanks: 2|4|6|8|10` (default 2),
`difficulty` (default Normal), `muted`.

## Terrain

| Field | Type | Notes |
|---|---|---|
| `cells` | `Uint8Array` (400 × 225) | `Material` per 4-unit cell |
| `map` | `MapId` | the map actually used (Random resolved) |

Operations: `generate(seed, map, tankSlots) → {terrain, starts}`, `carve(x, y, r) → changed cells`,
`supportUnder(x, width) → {y, material} | null`, `isWater(x, y)`, `surfaceAt(x)`.

## Tank (in battle)

| Field | Type | Notes |
|---|---|---|
| `id` | int | 0…n−1 |
| `side` | `Side` | fixed; Left faces right, Right faces left |
| `owner` | `{player: 1|2} \| {slot} \| computer` | online a dropped slot's tank is `computer` until its key rejoins |
| `look` | `Look` | |
| `x`, `y` | units | `y` = resting surface |
| `angle` | degrees | clamped to its spec |
| `power` | 0–100 | |
| `fuel` | units | reset to `FUEL` at its turn start |
| `hearts` | tenths | `≤ 0` → destroyed |
| `alive` | bool | false = destroyed; if not `gone`, it's a wreck (FR-025) |
| `gone` | bool | fell off the screen or into water: removed from the field (wrecks too) |
| `power shell`, `shield` | bool | at most one each |
| `gripUntilRound` | int \| null | grip gear: High grip until the end of that round |

## Crate

`id`, `x`, `y`, `falling: bool`, `contents: Drop` (hidden from players until picked up). At most 3.

## Battle

| Field | Type | Notes |
|---|---|---|
| `seed` | int | |
| `terrain` | Terrain | |
| `tanks` | Tank[] | |
| `round` | int | from 1 |
| `order` | tank id[] | this round's remaining turns: alternate sides while both have tanks to play, then the rest |
| `active` | tank id | the one highlighted tank |
| `phase` | `Phase` | |
| `turnLeftMs` | ms | from `TURN_MS` (30 000) |
| `wind` | units/step² | new each turn |
| `shell` | `{x, y, vx, vy, trail[], damage, from}` \| null | |
| `crates` | Crate[] | |
| `winner` | `Side` \| `draw` \| null | |

## State transitions

```text
Aim ──fire──▶ Flight ──explode/lost──▶ Settle ──(falls, slides, crate lands)──▶ next turn: Aim
 │                                              │
 └──countdown 0 (no shot)──────────────────────▶│
                                                └──a side empty──▶ Over
Round end (order empty): roll a crate (if < 3), then build next round's order.
```

## Room (online)

Relay room (size 2–10) plus the host's `mode`: `map`, `tanks` (even, ≥ players, ≤ 10, raised to
fit), `difficulty`; each player's `look` incl. `side` (sides' player counts within one; a side holds
at most `tanks/2`).
