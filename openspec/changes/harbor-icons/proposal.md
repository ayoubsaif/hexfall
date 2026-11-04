## Why

On the flat board a harbor marker is a colored badge with text painted on it: "3:1", or "2:1" plus the translated resource name. On a phone the name is tiny and squeezed, so the resource is hard to read and players fall back on remembering badge colors. An icon identifies the resource at a glance, reads the same in every language and stays legible at small sizes.

## What Changes

- Special harbor markers show a **resource icon** above the "2:1" rate instead of the translated resource name. Icons: grain = wheat, lumber = trees, brick = brick wall, ore = mountain/rock, wool = sheep.
- Generic harbor markers show an **anchor icon** above "3:1".
- The badge keeps its per-type background color, so color and shape both tell the six types apart (this helps color-blind players).
- Icons are drawn in code as vector paths on the existing harbor label canvas. No new image assets, no network fetch, and it works with no theme loaded.
- The label texture no longer contains words, so it no longer needs redrawing on a language change. The texture cache is keyed by harbor type only.
- The 3D (diorama) style uses the same label texture, so its harbor labels get the icons too. The dock models are unchanged.

Non-goals: themed harbor badge images (`harbor.*` images in a theme manifest; possible later), changes to harbor placement or link strips, and changes to HUD maritime-trade panels.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `board-view`: the "Harbor markers" requirement changes from "identify the resource" (met by text) to identifying the resource with an icon, adds an icon for generic harbors, and states that harbor labels contain no translated words. The `board-view` spec is still in the unarchived `board-topology` change, so this delta applies on top of that one and must be archived after it.

## Impact

- **Code**: `apps/client/src/scene/HarborMarker.tsx` (label drawing, texture cache), `apps/client/src/scene/labels.ts` (`harborLabel` returns an icon id instead of a resource name), a new icon-path module (for example `apps/client/src/scene/harborIcons.ts`), and `apps/client/test/scene/labels.test.ts`.
- **i18n**: `harborLabel` no longer uses `t`. The resource-name keys stay in use by the HUD.
- **Dependencies**: none new. Icon path data is either copied from lucide (ISC license, already a dependency via `lucide-react`) or hand-drawn. A sheep icon is hand-drawn because lucide has none.
- **Specs**: `board-view` delta, archived after `board-topology`.
