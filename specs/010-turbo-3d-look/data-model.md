# Data model: Turbo Tumble's 3D look (spec 010)

Nothing here is sent online or saved: settings (`PlayerLook`: name, colour, helmet, skin, style; track; two players)
and online messages are unchanged. All of this is built per screen.

## Kart model (look.ts)

| Part | Meaning |
|---|---|
| `body` | The kart's rounded body in the kart colour, its shape by style, joined with the driver's torso and arms and any wing or fin (parts sharing a colour are one mesh) |
| `marks` | Names of the style marks: Classic bumper and spoiler; Buggy roll bar (and chunky tyres); Rocket nose cone, tail fin, exhausts |
| `wheels` | Two axles, rear then front, each with a pair of wheels with hubs; turned by `spinWheels(model, distance)` |
| `driver` | Torso (kart colour), head with face and neck (skin) and an open helmet (helmet colour), two arms |
| `steering` | A small steering wheel in the driver's hands; turned by `setSteer(model, steer)` with the head's lean |
| `spark` | Today's drift spark (its colours stay as `game.ts` sets them) |

Inputs: `style: KartStyle`, `color`, `helmet`, `skin`. Overall size matches today's boxes; collisions are unchanged.
About a dozen meshes per kart. Its shadows (body and driver's head) are soft shapes on the ground, in the kart's heading
group so spins don't tip them.

## Track look (look.ts)

| Field | Meaning |
|---|---|
| `road` | `tarmac` (Meadow, Snow), `sand` (Desert), `neon` (Neon) |
| `ground` | `grass`, `sand`, `snow`, `grid` |
| `skyTop` | The sky's top colour (it fades to the track's horizon colour, which the track's existing colours give) |
| `stars` | A night sky with stars (Neon), else clouds |
| `light` | `sun` or `night` (coloured lights) |
| `layers` | 2–3 scenery rings: kind (hills, dunes, mountains, towers), distance, colour |
| `effect` | The moving effect: `snow`, `dust`, `birds`, `pulse` |
| `puff` | Drift puff kind: `dust`, `sand`, `snow`, `glint` |
| `props` | The start-line props' two colours |

Kerb, barrier, road, ground and horizon colours stay in the track table the game already has (`MAPS` in game.ts).

## Remote steering (look.ts)

`steerFrom(prevHeading, heading, dt)` → −1…1: how hard a kart driven on another screen is turning, from its heading
change (State messages carry no steering).

## Detail level (src/shared/detail.ts)

`full` until a race starts, then `probing` → `full` or `low` (55 fps over 2 s of frames that drew). Low: no shadows,
pixel ratio 0.75, no start-line props, moving effect or drift puffs, only the nearest scenery ring, no clouds or sky
dome. `Detail`, `LOW_DETAIL_FPS`, `DETAIL_PROBE_S` and `LOW_DETAIL_RATIO` are shared with Tank Clash.
