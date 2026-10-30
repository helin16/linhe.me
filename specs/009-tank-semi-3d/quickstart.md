# Quickstart: checking the 3D look, camera and overview map

## Run

```sh
yarn install
yarn test                 # unit tests, 100% function coverage
yarn build && npx vite preview   # then open /games/tank-clash/
yarn e2e                  # browser tests (Chromium, Firefox, WebKit iPad) against the build
```

`?seed=1` fixes the battlefield and computer tanks (as in 007).

## Scenarios

1. **Arcade is gone** (008 US4): the garage has no Style row. With an old saved `style: "arcade"` in
   local storage, the game loads in the normal look with the other settings kept.
2. **3D look** (009 US1–2): start a battle on each map. Hills have a lit top strip and a shaded front
   face; Timber Gap bridges are planks; Frost Ridge snow and ice and Lake Valley water look distinct. The
   garage preview shows each type and build as a solid tank. Fire at the ground: the hole is a crater.
   Destroy a tank: a dark steel wreck stays.
3. **Follow camera** (008 US1): at the first turn `data-camera=follow` and `data-view` shows about half
   the field wide, centred on the active tank within 1 s. Drive: the view moves with the tank.
4. **Shot camera** (008 US2): fire at full power: `data-camera=shot`, the view widens as needed and the
   blast is on screen; then the view goes to the next tank.
5. **Overview map** (008 US3): drag its frame to the far side: `data-camera=held` and the view moves.
   Drive: back to `follow`. Press `]` and `F` for the same with the keyboard. Hide the map, reload: it
   stays hidden.
6. **Smooth with 10 tanks** (007 SC-002, 009 SC-003): the existing frame-rate test passes.
7. **Same result** (009 SC-004): the seeded sim tests pass unchanged.
8. **Look and recognition checks** (009 SC-001, SC-002): manual, with 5 people, as the spec describes; before
   screenshots are in `specs/009-tank-semi-3d/look/` (saved in T003).
