# Quickstart: validating the online lobby

## Prerequisites

`yarn install`; Node 24+. Local relay and site: `yarn relay` in one terminal, `yarn dev` in another.

## Automated

```sh
yarn test        # unit + relay e2e: names, sizes, open/lock/close, list route, rate limit
yarn e2e:local   # Chromium + WebKit: host, browse, join, countdown (clock fast-forwarded), cancel, hand-over
```

GitHub CI runs the same e2e in Firefox too.

## By hand (two browsers)

1. A: Online → Host a room, size 8 → sees a generated name, 1/8, countdown from 60, Start, Cancel.
2. B: Online → the list shows A's room "1/8" within 2 s → pick it → both see 2/8 and the same
   countdown (±1 s); B sees Leave.
3. Wait for 0 → the race starts with 6 computer karts; 8 karts on the grid.
4. After the results → both back in the room, countdown at 60, room listed again.
5. A presses Cancel → B sees "The host closed the room" within 2 s; the list no longer shows it.
6. Host again, B joins, close A's tab → B becomes host (Start/Cancel), countdown continues.
7. While a race runs, open its join link in a third browser → "That race has already started".
8. 1 Player and 2 Players still race 4 karts.

## Live (after `yarn deploy`)

Steps 1–5 on https://linhe.me/games/turbo-tumble/ from two devices; `journalctl -u linhe-relay`
shows counts only (no names or codes).
