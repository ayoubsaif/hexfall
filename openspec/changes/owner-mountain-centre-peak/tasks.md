## 1. Source and mask constants

- [ ] 1.1 Copy the owner's `Mountain Lowpoly.fbx` from the uploaded zip into the git-ignored `assets/mountain/`. Verify: the file exists and `git status` doesn't list it.
- [ ] 1.2 Add `tools/blender/mountain-mask.json` with the rim fade radii (0.6 → 0.85), clearing radii (chip 0.28, robber 0.19 at (−0.45, +0.3), 0.12 blend), front cap angle (55°, 0.02 margin), dome (0.24, radius 0.9), peak height 0.55 and summit yaw. Verify: valid JSON, all fields named in design.md §1 are present.

## 2. Blender kit

- [ ] 2.1 Rewrite the peak section of `tools/blender/mountain-kit.py`: import the FBX, keep only `Mountain`, apply transform, centre, scale to the hex, apply the mask (rim fade, clearing, front cap) on top of the dome, crop to the hex with a skirt, decimate to about 2k triangles (material delimit), and remap materials to rock, snow and low scree. Build `peak_variant_0` and the X-mirrored `peak_variant_1`. Update the usage line to take the new FBX. Verify: headless run prints `TRIS` ≤ about 2,000 per variant and `GLB peak` ≤ 300 KB, with no `Error`/`Traceback`.
- [ ] 2.2 Remove the ore section and the `ore.glb` export from the script; export `mountain-heights.json` (33 × 33 height grid per variant) beside the script for tests. Verify: the run writes only `peak.glb` and the height file.
- [ ] 2.3 Update the preview render: one hex with the mountain, the chip, the robber at its spot and a settlement on every corner, from the default camera angle. Save the `.blend` to `tools/blender/source/mountain-kit.blend`. Verify: preview PNG exists.
- [ ] 2.4 Owner approves the look. Verify: owner approves the preview render; tune `peak height` and yaw in `mountain-mask.json` from their feedback and rebuild.

## 3. Client code

- [ ] 3.1 Rewrite `scene/mountainPeaks.ts` so `hexMountain` returns exactly one `prop.peak` at the hex centre (`ground 0`, `yaw 0`, `scale 1`, variant 0 or 1 by hex hash), and remove `PEAK_KINDS`, the stone, ore, pine and pebble placement and their constants. Verify: `npx tsc --noEmit -p apps/client` passes.
- [ ] 3.2 Remove `prop.ore`: `src/theme/keys.ts` (`ASSET_KEYS`, `ASSET_KIND`), `fallbacks/coast.tsx` (ore entry, `OrePiece`), `fallbacks/index.ts`, and any other use (`rg "prop.ore|OrePiece|ORE_"`). Verify: the search finds nothing in `apps/client/src`.
- [ ] 3.3 Replace the `prop.peak` fallback with a low hex-shaped mound with two back cones and the centre clearing (2 variants). Verify: with `peak.glb` removed from the theme, Medium shows the fallback and the chip and robber are visible (browser check in 4.3).

## 4. Theme, tests and checks

- [ ] 4.1 `theme.json`: drop the `prop.ore` mapping and its source text; replace the peak source text with "the mountain (models/peak.glb): an owner-supplied CC0 low-poly mountain, fitted to the hex in Blender by a script (tools/blender/mountain-kit.py)". Delete `models/ore.glb`. Verify: `node tools/check-assets.mjs` passes.
- [ ] 4.2 Update tests: key counts in `test/theme/manifest.test.ts` and `keys.test.ts` (one key fewer); rewrite `test/scene/mountainPeaks.test.ts` for one centred mountain per mountain hex, determinism, no other props, and the line-of-sight check against `mountain-heights.json` (chip, robber, all six corners, two nearest corners of the hex behind). Verify: `npx vp test run` in `apps/client` passes.
- [ ] 4.3 Browser check on High and Medium: the mountain fills each mountain hex, nothing else stands on it; chip and robber visible; settlements, cities and roads on mountain hexes visible and clickable; Low still shows painted mountains. Verify: screenshots of the default view sent to the owner.
