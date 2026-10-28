# Quickstart: validating Snake Duel

## Automated

```sh
yarn test        # sim.ts (moving, eating, boost, take-outs, rounds), bots.ts, messages, shared online code
yarn e2e:local   # Chromium + WebKit: 1P, 2P, online 3 browsers, relay down, home/games cards
```

## By hand

1. Home page → Snake Duel card ("1–2 players · Online up to 8 · iPad ready") → the game.
2. Garage: change name, colours, pattern and eyes → the preview changes; pick match type and
   difficulty; reload → all still there.
3. 1 Player (Easy, then Hard: Hard snakes cut across your path): steer with the mouse; eat orbs → length up; hold to boost → faster, shrinks; hit a
   computer snake's body → out, final length, best length kept after reload.
4. 2 Players on one keyboard: A/D + W and ←/→ + ↑; split screen; one player runs into the other →
   round to the other; first to 3 wins the match. Quick match: a 5:00 timer; going out rejoins after 3 s;
   at 0 the longer snake wins.
5. iPad: sticks and boost buttons per half; no scrolling in either orientation.
6. Online with 3 devices: host a room of 4 → waiting room with name, 1/4, player list, 60 s
   countdown, Start/Cancel and the match type / difficulty pickers; others join from the list (Leave
   for them) and see the host's picks; Start; everyone sees the
   same orbs, bots and winner; close one device mid-round → that snake is out, the match goes on.
7. Relay unreachable: Online says so within 5 s; 1P/2P still work.
8. Turbo Tumble's Online popup still looks and works the same (shared code moved).
