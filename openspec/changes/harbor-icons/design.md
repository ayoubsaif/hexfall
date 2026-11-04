## Context

`scene/HarborMarker.tsx` draws each harbor's label into a 256 px canvas texture (`makeLabelTexture`) and lays it on the badge (flat style) or beside the dock (3D style). `scene/labels.ts` `harborLabel(type, t)` supplies the rate and the translated resource name. The texture cache is keyed by type and label text, so a language switch redraws it. The badge fill comes from `theme/fallbacks/flat/harbors.tsx` (`HARBOR_COLORS`), and a theme could supply an image instead, but none does. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Icon plus rate, readable on a phone-sized flat board, in both board styles.
- Zero runtime fetches. Icons are drawn synchronously into the existing canvas.
- Keep `labels.ts` a pure, unit-testable model of what is drawn.

**Non-Goals:**
- Theme-supplied harbor icons or badge images.
- Accessible names for board markers (the canvas has none today; unchanged).

## Decisions

### 1. Vector paths on the canvas via `Path2D`
Each icon is a list of SVG path strings in a 24×24 viewBox, stroked with `Path2D` onto the label canvas. That is the same format lucide uses.
- *Alternative: render `lucide-react` components to an image.* That needs an async SVG to Image decode before the texture exists, which adds a loading state to a marker that is synchronous today. Rejected.
- *Alternative: card art (`public/cards/*.webp`) on the badge.* The art is detailed and blurs at about 40 px on a phone, and it needs an async image load. Rejected.

### 2. Icon source
Copy the path data of lucide's `wheat`, `trees`, `brick-wall`, `mountain` and `anchor` into a new `scene/harborIcons.ts`, with an ISC attribution comment (lucide is already a dependency). Lucide has no sheep, so wool gets a hand-drawn path in the same style: a 2 px stroke, round caps and joins, and a 24-unit grid. A puffy cloud body with a head and two legs keeps it distinct from a plain cloud.

### 3. Label model
`harborLabel(type)` returns `{ rate: "3:1" | "2:1", icon: HarborIcon }`, where `HarborIcon` is `"anchor" | "wheat" | "trees" | "brickWall" | "mountain" | "sheep"`. It no longer takes `t`. The texture cache key becomes the harbor type alone, because the label no longer depends on language.

### 4. Layout on the 256 px canvas
The icon is centered in the upper part (about 0.50·s box, center at about 0.36·s), and the rate is bold, about 0.26·s, centered at about 0.78·s. The stroke color is `INK`, with a stroke width scaled so the 2-unit lucide stroke stays about 2.5 px at phone zoom. The background stays transparent: in the flat style the badge color shows through, and in the 3D style it floats beside the dock as now. Exact numbers are tuned during visual checks.

### 5. Contrast on dark badges
`INK` on the lumber (#2f6b34) and ore (#6f747c) badges is low contrast. Add a light halo: stroke each icon path and the rate text first in a cream color (#f4efe1) at a wider width, then in `INK` on top. This works on every badge color and on the 3D-style sea without per-type colors.
- *Alternative: per-badge ink color (white on dark badges).* That adds a color table and breaks the uniform look in the 3D style, where there is no badge. Rejected.

## Risks / Trade-offs

- [The sheep is hand-drawn and may read as a cloud] → Check it at phone size during the visual check, and adjust the head and legs until it reads as a sheep.
- [Players used to the word may not recognize the icons at first] → Icons match the badge colors and the maritime panel's card art colors, and the HUD trade panel still names the resource.
- [Copied lucide paths drift from upstream] → They are static, and only attribution matters.

## Migration Plan

Client-only visual change. No data, protocol or engine impact. Rollback is reverting the commit. The `board-view` delta must be archived after `board-topology`.
