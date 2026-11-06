## Why

Player panels spend three stacked bands (header, stat grid, badge row) on small 9–12 px text, and phones fall back to cryptic abbreviations ("PV", "Cab"). The stats are the most-glanced info in the game, so they should be larger, icon-led and take less height.

## What Changes

- Replace the header/body split with one compact paper card: larger avatar on the left, name (14–15 px) on top, four icon + number chips below at 16–18 px bold tabular.
- Replace the text labels VP, Cards, Dev and Knights with painted gold icons. Labels stay as screen-reader text and tooltips (English and Spanish).
- Generate three new icons (`vp`, `hand`, `knight`) in the existing embossed-gold icon style, tuned to the avatar look (thick dark outline, flat cel-shading). Reuse the existing `devcard.webp` for development cards.
- Longest Road and Largest Army badges become small gold medals pinned to the avatar corner (reusing `road.webp` and the new `knight.webp`), removing the badge row.
- Own hidden VP shows as a gold "+n" beside the VP chip.
- Phones and short screens: avatar shrinks and chips lay out 2×2; no abbreviated labels.
- Keep `dd[data-stat]` hooks, `data-testid="player-panel"`, `data-active`, `data-own`, offline badge and countdown text.

## Capabilities

### New Capabilities
- `compact-player-panels`: layout, icon chips, medals, responsive behavior and accessibility of the player panels, plus the three new icons.

### Modified Capabilities
<!-- None: player panels are not covered by a current main spec. -->

## Impact

- `apps/client/src/hud/PlayerPanels.tsx`, `GameIcon.tsx` (new names), `Avatar.tsx` (new size), `style.css` (panel/chip styles; `.hud-card-head` may become unused by panels).
- New: `apps/client/public/ui/icons/{vp,hand,knight}.webp`.
- i18n: `play.panels.stat.*` tooltip text; `*Short` keys removed in `en` and `es`.
- Tests: `game-ui-panels`, `avatars`, `floating-hud`, `play-spanish` may need updates.
- Image generation: Higgsfield (about 18 credits available, one 4×4 sheet ≈ 1.5), Gemini `nano-banana-2` as fallback.
- Out of scope: other HUD cards, resource card art, game logic.
