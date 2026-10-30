# Quickstart: checking Turbo Tumble's new look

## Run

```sh
yarn test                        # unit tests (look.ts included), 100% function coverage
yarn build && npx vite preview   # then open /games/turbo-tumble/
yarn e2e:local                   # browser tests (Chromium, WebKit iPad); the full `yarn e2e` adds Firefox
```

## Scenarios

1. **Karts** (US1): in the garage pick Classic, Buggy and Rocket, change colour, helmet and skin: each looks different.
   In a race, drivers turn their steering wheels and lean into corners; wheels turn.
2. **Tracks** (US2): race each track: textured road and ground, rounded kerbs and barriers, a soft shadow under every
   kart, the start arch, tyre stacks and grandstand at the start line. Neon is at night with glowing lines.
3. **Scenery** (US3): look towards the horizon: layered scenery, paler far away; clouds (stars on Neon); the track's
   moving effect (snow, dust, birds, pulsing lights) behind the karts.
4. **Drifting** (FR-002a): drift on each track: puffs behind the wheels in the track's kind; today's spark colours.
5. **Speed** (US4): the new frame-rate test passes for a race and for split screen; on a slow device the game drops to
   low detail (`data-detail=low`) and the effects and props go away.
6. **Unchanged race** (SC-002): the existing Turbo Tumble tests pass unchanged.
7. **Real devices** (SC-006): an eight-player online race on a real iPad and a real phone shows no visible stutter.
8. **Manual checks** (SC-003, SC-004): kart recognition and before/after look checks with 5 people.
