# Quickstart: validating Critter Hop

## Prerequisites

`yarn install` (no new packages). For online checks, a local relay: `yarn relay` in a second
terminal (see README for the relay address in `.env`).

## Automated gates (constitution VII)

```sh
yarn build   # type-check + Vite build; critter-hop is its own chunk
yarn test    # unit tests, 100% functions incl. src/games/critter-hop/{boards,rules,bots,cursor,messages,settings,seed,types}.ts
yarn e2e     # e2e/critter.spec.ts in Chromium, WebKit (iPad touch) and Firefox
```

## By hand

| # | Do | Expect |
|---|---|---|
| 1 | Open `/games/critter-hop/`, 1 Player, 2 players, pick Fire | Star board; 10 Fire creatures (one bigger leader) and 10 of a computer type in opposite points |
| 2 | Click a front creature | Its reachable holes glow; click a dark hole: nothing happens |
| 3 | Move; wait | Creature hops along its path with fire embers; computer replies within ~1 s |
| 4 | 4 Players, seats Person/Computer/Person/Computer | Cross board, four arms; board turns to the next person each turn |
| 5 | 6 Players, Hard | All six points filled; computer turns ≤2 s on an iPad |
| 6 | Set up a Water creature with a Fire one 2 holes away and room beyond (play it out with `?seed=1`) | The long-hop landing glows in the stronger colour |
| 7 | Keyboard only: arrows, Enter, Escape, Q/E, +/− | Full game playable; status line reads the selection |
| 8 | iPad: tap, drag, pinch | Select/move, turn, zoom; nothing scrolls sideways |
| 9 | Two browsers with the relay: host 4-player room, pick Water; join, pick Water | Second browser sees Water taken; picks Grass; Start → same board on both, two computer seats |
| 10 | Move on one browser | Appears on the other within 1 s |
| 11 | Close a player's tab mid-game | Others see the message; a computer plays that seat; reopening and pressing Rejoin takes it back |
| 12 | Stop the relay, press Online | Plain "isn't available" message; 1 Player still works |

Message details: [contracts/messages.md](contracts/messages.md). Rules and state:
[data-model.md](data-model.md).
