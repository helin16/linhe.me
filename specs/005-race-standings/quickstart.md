# Quickstart: validating standings and the roster

## Automated

```sh
yarn test        # standings.ts: row picking (full/compact), roster rows, computer-kart count
yarn e2e:local   # Chromium + WebKit (iPad): panel in 1P/online races; roster updates for join/leave/colour
```

## By hand

1. 1 Player race: the panel lists 4 karts; overtake one → order changes within a second; your row
   is highlighted; after finishing your row shows a time.
2. 2 Players: one panel, both players' rows highlighted.
3. Online, two devices: host sees "P1 <name> (host, you)", guest appears as "P2 <name>" with their
   colour; the guest changes kart colour → host's swatch changes within 2 s; "+N computer karts".
4. Home page: the Turbo Tumble card reads "1–2 players · Online up to 12 · iPad ready".
5. Phone in landscape, 12-player room: the panel shows the top 3 plus your row and doesn't cover
   the steering pad or buttons.
