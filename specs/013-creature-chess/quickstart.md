# Quickstart: validating Critter Chess

## Automated gates (constitution VII)

```sh
yarn build   # type-check + build; critter-chess is its own chunk
yarn test    # unit tests, 100% functions incl. src/games/critter-chess/{boards,rules,bots,messages,settings,types,seed}.ts and src/shared/cursor.ts
yarn e2e     # e2e/chess.spec.ts (and critter.spec.ts still green after cursor.ts moved)
```

Move-generation check (SC-002): the rules tests include perft counts from the standard start
(depth 1: 20, depth 2: 400, depth 3: 8 902) and a position with castling, en passant and promotion.

## By hand

| # | Do | Expect |
|---|---|---|
| 1 | `/games/critter-chess/`, 1 Player, 2 players, pick Water | Standard position; your army is Water creatures, six different shapes |
| 2 | Click a pawn | Its one- and two-step squares light up; captures look different |
| 3 | Play Scholar's mate against yourself in 2 Players | "Check" shows; mate ends the game, winner shown |
| 4 | 1 Player, 4 players | Cross board, four armies; computers move within 2 s |
| 5 | 1 Player, 6 players, Hard | Hexagon, six full armies; computers within 2 s on an iPad; smooth turning |
| 6 | Leave a king exposed in a 4-player game | A later player can take it; that player is out, pieces gone |
| 7 | Keyboard only: arrows, Enter, Esc, H, Q/E, +/− | Full game playable |
| 8 | iPad: tap, drag, pinch | Select/move, turn, zoom; no sideways scrolling |
| 9 | Two browsers, 4-player room, same type | Second can't take it; Start → same board, two computers; moves appear within 1 s |
| 10 | Close a tab mid-game, reopen, Rejoin | Computer took over; seat comes back with the current position |
| 11 | Wait 60 s online | A move is made for you |
| 12 | Relay stopped, Online | Plain message; offline still works |

Details: [contracts/messages.md](contracts/messages.md), [data-model.md](data-model.md).
