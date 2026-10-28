# Contract: values that leave the code

These enum values are seen outside the source (stored, sent, shown, or addressed) and MUST NOT
change in this feature. Renaming a member's key is free; changing its value is a breaking change.

| Where it goes | Enum | Values |
|---|---|---|
| Browser storage (`tt-cfg`) | `Track`, `KartStyle` | `Meadow Desert Snow Neon`, `Classic Buggy Rocket` |
| Online wire format (`t` field) | `MsgType` | `hello join leave me start s goo pop zap` |
| Online wire format (`start.map`, `me.p.style`) | `Track`, `KartStyle` | as above |
| Public addresses | `Route`, `GameSlug` | `/`, `/games/`, `/games/turbo-tumble/` |
| DOM attributes (`data-a`, `data-end`) | `Action`, `EndAction` | `up down left right drift item`, `again garage` |
| Screen text (menu buttons) | `PlayerMode`, `EditTab`, `Track`, `KartStyle` | `1 Player`, `2 Players`, `Online`, `Player 1`, `Player 2`, track and kart names |

The router contract ([../../001-react-typescript-port/contracts/routes.md](../../001-react-typescript-port/contracts/routes.md))
and the game module contract ([../../001-react-typescript-port/contracts/game-module.md](../../001-react-typescript-port/contracts/game-module.md))
are unchanged.
