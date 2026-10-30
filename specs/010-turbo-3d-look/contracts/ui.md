# UI contract: Turbo Tumble's look (spec 010)

What players and the end-to-end tests rely on. Controls, the garage panel, HUD, minimap and online messages are
unchanged (specs 001, 004, 005).

## Test aids on the game root

Read-only, written only when they change, and only under automated browsers (`navigator.webdriver`), as Tank Clash:

- `data-detail` = `probing`, then `full` or `low` (FR-009)
- `data-geometries` = how many geometries the renderer holds; `data-used` = how many the scene still uses. The first may
  not exceed the second: anything left behind would show as more (FR-012)
- `data-antialias` = `on` or `off` (FR-008)
- `data-kart` = `x,y` screen point of the middle of the first view's kart body
- `data-shadow` = `x,y` screen point where the shadow of each human's helmet top falls, one per view separated by `;`
  (split screen gives two) (FR-005, FR-005a)
- `data-ground` = `x,y` screen point on open ground past the left barrier, a little ahead of the first view's kart (FR-003)
- `data-steer` = the first human's steering wheel, −1 (right) … 1 (left), two decimals; `data-steer-remote` = the first
  kart driven on another screen (FR-001a)
- `data-wheels` = the first human's wheel turn, in whole turns (FR-002)
- `data-spark` = the first human's drift spark colour as `#rrggbb`, empty when hidden (FR-002a)
- `data-puffs` = how many drift puffs are live (FR-002a)
- `data-kerbs` = `rounded` once kerbs and barriers are built from the rounded profiles (FR-004)
- `data-props` = how many start-line props are visible (FR-004a)
- `data-effect` = the moving effect shown (`snowfall`, `dust`, `birds`, `pulse`), empty in low detail (FR-006a)
- `data-layers` = each scenery ring as `distance:haze`, nearest first; haze is the share of the sky's colour the fog
  mixes in at that distance, 0–1 (FR-006)

Test hooks on `window`, also only under automated browsers:

- `__ttLowDetail()` switches to low detail now, so tests can check what it drops (FR-009)
- `__ttHoldDetail()` keeps full detail for the visit (the test browsers draw in software, and the frame-rate check would
  drop to low detail in the middle of a test)

Pixel checks read a Playwright page screenshot (the WebGL canvas keeps no frame to read back).

## What the tests look for

| Check | How |
|---|---|
| Kart types and colours differ (FR-001, FR-007) | On the grid during the countdown (the camera stands still), the kart looks the same twice and different after each change of type, colour, helmet or skin |
| Drivers steer, wheels turn (FR-001a, FR-002) | `data-steer` follows right then left, `data-steer-remote` too online; `data-wheels` grows while driving |
| Drift puffs and spark (FR-002a) | `data-puffs` > 0 while drifting, 0 before and in low detail; `data-spark` takes more than one colour as the charge grows |
| Textured road and ground (FR-003) | Brightness varies (less the smooth change across the area) near the kart and at `data-ground` |
| A shadow under the kart (FR-005, FR-005a) | The pixel at `data-shadow` is darker than a little to its side, on every track (Neon: a gentler threshold) |
| Rounded kerbs, props (FR-004, FR-004a) | `data-kerbs` = `rounded`; `data-props` = 3, then 0 in low detail |
| Neon at night (FR-005a) | A good share of the top row of the screen is dark |
| Scenery and effect (FR-006, FR-006a) | `data-layers` farther and hazier ring by ring; `data-effect` names the track's effect, empty in low detail; the kart's body pixel stays its colour frame after frame with the effect on |
| Smooth edges (FR-008) | `data-antialias` is `off` where the browser's WebGL reports a software renderer, `on` elsewhere |
| Speed (SC-001, FR-009) | `data-detail` goes `probing` → `full`/`low`; then at least 50 fps in Chromium for a race, split screen and an eight-kart room |
| Low detail in split screen (FR-009) | After `__ttLowDetail()`, both halves' shadow points are no longer darker and `data-props` = 0 |
| No growth (FR-012) | `data-geometries` ≤ `data-used` after races, returns to the garage and track switches |
| Open time (SC-005) | Garage drawn, and countdown after Start, each within 1 s of the old look's times (median of 5) |
