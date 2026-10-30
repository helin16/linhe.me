# UI contract: battle view, overview map and keys (008 + 009)

What players and the end-to-end tests rely on. Online messages are unchanged (007's `contracts/messages.md`).

## Elements

| Element | Purpose |
|---|---|
| `#view` | The 3D battle (WebGL). Fills the screen as today. |
| `#labels` | Transparent 2D layer over `#view`: names, health bars, active-tank arrow, repair hearts. `aria-hidden` (the life panel carries the same information as text). |
| `#overview` | The overview map, top-right, 60% opacity, `role="img"`, `aria-label="Overview map"`. Hidden when the player hid it. Never overlaps `#panel`, the turn timer or the controls. |
| `#overviewToggle` | Button next to the map: label "Hide map" / "Show map", `aria-pressed`. Works by touch, mouse and keyboard. |
| `#preview` | Garage tank preview, now drawn in 3D (still a 2D canvas the scene is copied into). |
| Garage Style row (`#styleRow`, `#cStyle`) | **Removed.** |

## Camera state for tests

On the game root (`.tc`):

- `data-camera` = `follow` | `shot` | `held` | `whole` (`whole` = the battle is over, whole field shown)
- `data-view` = `cx,cy,halfW` in field units, rounded to whole units
- `data-ready` = set once the first battle frame has been drawn (used to time how fast a battle opens)
- `data-tanks` = `id:x,y,sx,sy,alive` for each tank, `;`-separated: field position (x, y) and where it is
  on screen in CSS pixels (sx, sy, from the scene's projection); `alive` is `1` or `0` (a wreck)
- `data-shells` = `x,y,sx,sy` for each shell or missile in flight, `;`-separated (empty when none)
- `data-blast` = `x,y,sx,sy` of the latest blast (empty before the first)
- `data-detail` = `probing` while the frame rate is measured after a battle starts, then `full` or `low` (009 FR-013)
- `data-materials` = `material:x,y,sx,sy` for one surface point of each material on the map (the middle of
  its widest stretch of surface), `;`-separated; updated when the ground changes

All values are rounded to whole units/pixels and checked each frame; an attribute is written only when its value changed. They are read-only test aids; the
game never reads them back. Pixel checks read a Playwright screenshot of the page at `sx, sy` (WebGL
canvases don't keep their last frame for `toDataURL`).

## Input

| Input | Effect |
|---|---|
| Drag the frame on `#overview` (mouse, touch, pen) | Main view follows the drag, same zoom; `data-camera=held` |
| Tap/click a spot on `#overview` | Main view centres there; `data-camera=held` |
| `[` / `]` | Move the view left / right along the field; `data-camera=held` |
| `F` | Back to following the active tank |
| 007's keys (arrows, Q/E, −/+, Space) | Unchanged; driving or firing ends `held` |

## Saved settings

`overview: boolean` (default true). Old saved `style` is ignored.
