# Quickstart: validating Tank Clash

## Automated

```sh
yarn test        # terrain (generation, carving, support), sim (turns, damage, falls, slides, crates, winner),
                 # bots, messages, settings, relay rejoin, lobby additions — 100% functions
yarn e2e:local   # Chromium + WebKit: 1P, 2P, garage, maps, air drops, online, rejoin, relay down, home card
```

Tests use `?seed=<number>` (offline only) to fix the battlefield, wind, start spots and crates.

## By hand

1. Home page → Tank Clash card ("1–2 players · Online up to 10 · iPad ready") → the game.
2. Garage: pick each tank type → preview shape and stats (angle range, damage, hearts, grip)
   change; set name and colour; reload → still there. 2 Players: same colour for both → player 2's
   changes.
3. 1 Player, defaults: two tanks on opposite halves; life panel lists both; the active tank glows
   with an arrow; a 30 s countdown; ←/→ drives (stops at the middle line), ↑/↓ tilts within the
   type's limits (always towards the enemy), Q/E power, Space fires; the shell leaves a fading
   trail and blows a hole; the hit tank's bar and panel drop by the damage (e.g. 4 → 2.5 from a
   Heavy). Destroy a tank → its blackened wreck stays; a shell landing on the wreck explodes but the
   wreck doesn't move or break; dig out the ground under it → it falls off the screen and
   disappears. Let the countdown run out → the turn passes. Sounds: an engine rumble while driving
   (stops when the tank stops), a thump on firing, a boom on each blast, a clunk when a crate
   lands, a fanfare on winning (a softer tune on losing); mute → silent, still muted after reload.
4. 6 tanks: Left and Right each get 3 at random spots; turns alternate sides; after everyone has
   fired, a crate floats down; drive onto it → its effect and an icon in the panel.
5. Maps: Timber Gap — shoot the bridge under a tank → it falls and is destroyed; Lake Valley — a
   tank stops at the water's edge; Frost Ridge — a Heavy slides a bit after driving and when firing,
   a Scout doesn't; dig through to the bottom under a tank → it falls off the screen.
6. 2 Players on one device: player 1 on Left, player 2 on Right; only the active player's keys act.
7. iPad: drive/angle buttons, power slider and Fire; whole field visible, no scrolling, both
   orientations.
8. Online with 3 devices: host a room of 4 → waiting room shows each player's side (random) and a
   switch button; host picks map, tanks and difficulty → everyone sees them; Start; every screen
   shows the same shots, holes, hearts and winner. Close one guest mid-battle → a computer plays its
   tank; reopen the game on that device → "Rejoin battle" → the tank is theirs again from its next
   turn.
9. Relay unreachable: Online says so within 5 s; 1P/2P still work.
10. Turbo Tumble and Snake Duel online still work as before (relay and lobby changes).
