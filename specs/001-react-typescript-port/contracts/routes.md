# Contract: Site routes

Public addresses visitors and bookmarks rely on (FR-005, FR-008). All are served by the single app;
the host falls back to `index.html` for any path that isn't a built file.

| Path | Page | Title | Layout | Loads 3D engine |
|---|---|---|---|---|
| `/` | Home: intro + games section + "All games →" | `Lin He` | site header/footer | no |
| `/games/` | Games list + "More coming soon" card | `Games · Lin He` | site header/footer | no |
| `/games/turbo-tumble/` | Turbo Tumble, full screen | `Turbo Tumble` | none (game owns the screen) | yes |
| anything else | Not found + link home | `Not found · Lin He` | site header/footer | no |

Rules:
- A path without its trailing slash (`/games`, `/games/turbo-tumble`) is replaced with the slashed
  form in the address bar (`history.replaceState`) and shows the same page.
- `/index.html` is treated as `/`.
- Internal links (`<Link>`) change pages with `history.pushState` and no full reload; modifier-clicks
  (Ctrl/Cmd/Shift/middle button) and external links behave as normal links.
- Back/forward re-render the page for the current path.
- Each game's route comes from its `GameEntry.slug` in `src/games/index.ts`; adding a game adds its
  route with no router change.
