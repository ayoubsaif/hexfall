## 1. Remove the 3D board style

- [x] 1.1 Delete `BoardStyleSwitch` from `apps/client/src/hud/Hud.tsx` and its mount in the corner controls
- [x] 1.2 Make `FALLBACKS` a single map in `theme/fallbacks/index.ts`; delete `DIORAMA_FALLBACKS` and the `theme/fallbacks/diorama/` folder
- [x] 1.3 Drop the style argument from `Asset.tsx` (`useAsset`, `resolveForStyle` → plain `effectiveResolution`), `relief.ts` (`landRelief(entries)`) and `useLandRelief.ts`
- [x] 1.4 Delete `theme/style.ts` and its exports from `theme/index.ts`; remove `TOKEN_LABEL_Y` from `flat.tsx`; fix every remaining import (`ThemeProvider.tsx`, `load.ts`, scene files)
- [x] 1.5 Remove `session.hud.boardStyle` and `session.hud.style.*` from the en and es catalogs
- [x] 1.6 Update or delete tests that cover the style (`test/theme/style.test.ts`, `resolve.test.ts`, `fallbacks.test.ts`, `slot.test.tsx`, `load.test.ts`, `manifest.test.ts`, `test/hud/Hud.test.tsx`, `Credits.test.tsx`); add a test that the HUD shows no Flat/3D switch

## 2. Thin token chips

- [x] 2.1 Add `CHIP_HEIGHT` (0.035) and `CHIP_EDGE` color to `flat.tsx`; draw the `token` key as a chip: cylinder resting on y = 0, top cap with the token image or `TOKEN_COLOR`, darker side, outline ring on the top face
- [x] 2.2 Use the same chip for the themed `token` image and the procedural fallback, so both have identical size and placement
- [x] 2.3 Put the number/pips `LabelQuad` on the chip's top face (`CHIP_HEIGHT + FLAT_LAYER.label`)
- [x] 2.4 Unit tests: chip height is > 0 and ≤ 0.05, base at y = 0, top-face label above the chip, fallback and themed chips share geometry

## 3. Chips face the camera

- [x] 3.1 Add a pure `cameraYaw(camera, target, previous)` helper in `scene/` (atan2 of the horizontal offset; keeps `previous` when the offset is under 1e-4) with unit tests for south, east, north, west and straight-down cameras
- [x] 3.2 In `BoardView`, register each token's turning group and apply the shared yaw in one `useFrame`; keep `Glow` outside the turning group
- [x] 3.3 Turning test with real three.js groups (no renderer in the test setup; the per-frame step is the pure `turnChips`): for south, east and north cameras every chip's `rotation.y` equals the yaw, its label top points away from the camera, and its world position is unchanged

## 4. Harbor markers without icons

- [x] 4.1 Change `harborTexture` in `HarborMarker.tsx` to draw only the rate, smaller and at the bottom of the badge, with the light halo
- [x] 4.2 Remove the 3D dock branch from `HarborMarker.tsx` (and `outward()` if unused)
- [x] 4.3 Drop `icon` from `HarborLabel` in `scene/labels.ts`; delete `scene/harborIcons.ts` and `test/scene/harborIcons.test.ts`; update `labels.test.ts` and `layout.test.ts`

## 5. Verify

- [x] 5.1 Run client typecheck, lint, format check and the full test suite; run `pnpm run check` for assets
- [ ] 5.2 Look at the board in the browser: chips have a visible edge, numbers stay upright while orbiting a full circle (top-down theme) and within ±25° (isometric), harbor badges show only image and rate, no Flat/3D switch in the HUD
