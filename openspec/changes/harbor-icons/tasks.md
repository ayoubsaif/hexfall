## 1. Icon data and label model

- [x] 1.1 Add `apps/client/src/scene/harborIcons.ts` with `HarborIcon` ids and 24×24 SVG path strings: anchor, wheat, trees and brick-wall copied from lucide with an ISC attribution comment, mountain for ore, and a hand-drawn sheep. Verify with a unit test that each of the six ids has at least one non-empty path and that no two icons share identical path data.
- [x] 1.2 Change `harborLabel` in `apps/client/src/scene/labels.ts` to `harborLabel(type)` returning `{ rate, icon }` (generic → anchor/"3:1", specials → their icon/"2:1"), dropping the `t` parameter. Update `apps/client/test/scene/labels.test.ts`: generic reads 3:1 + anchor, specials read 2:1 with five distinct icons, and the old "names the resource in the active language" case is replaced by one that asserts the label has no text field. Verify with `pnpm vp test` (client) passing.

## 2. Drawing

- [x] 2.1 In `apps/client/src/scene/HarborMarker.tsx`, draw the icon with `Path2D` (scaled from the 24-unit viewBox into the upper part of the canvas) and the rate below it, both with a cream halo stroke under the `INK` stroke (design decisions 4 and 5). Key the texture cache by harbor type only and remove the `useTranslation` dependency. Verify with `pnpm vp check` and the client test suite passing.
- [x] 2.2 Remove any now-unused imports or i18n wiring for harbor text, keeping the resource-name keys the HUD still uses. Verify that the type check passes and that `rg "harborLabel\(.*t\)" apps/client/src` finds nothing.

## 3. Visual verification

- [ ] 3.1 Run the client and check the flat board at a 390×844 viewport: all nine markers show an icon plus rate, the six types are distinguishable, and the icons are readable on the dark lumber and ore badges. Take a screenshot as evidence and adjust sizes and stroke widths if needed.
- [x] 3.2 Switch to the 3D board style and to Spanish, and confirm that the harbor labels show the same icons and rates with no text, readable beside the docks.
