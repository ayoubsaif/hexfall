## 1. Peak and ore kit

- [x] 1.1 Write `tools/blender/mountain-kit.py`: import the owner's `microbox.fbx`, cut 4 summits, fade, sharpen, decimate, colour by height and slope; export `models/peak.glb`. Verify: about 1.3k tris per variant, ≤ 300 KB, preview render.
- [x] 1.2 Ore clusters with gold veins after the ore card in the same script; export `models/ore.glb`. Verify: preview render.
- [ ] 1.3 Owner approves the peak and ore look. Verify: owner approves a render.

## 2. Asset keys and fallbacks

- [x] 2.1 Add `prop.peak` and `prop.ore` to `theme/keys.ts`, `COAST_KEYS`, the procedural fallbacks and `coastScatter.ts` radii; map them in `diorama/theme.json` and extend its `source` text. Verify: keys/manifest tests and `tools/check-assets.mjs` pass.

## 3. Placement and ground

- [x] 3.1 Write `scene/mountainPeaks.ts` (`hexMountain`, `mountainPeaks`). Verify: unit tests for counts, clear zones, peak height and determinism on the beginner board and two variable boards.
- [x] 3.2 Add `mountainFloor()` to the `IslandGround.tsx` shader for the mountain slot on Medium/High. Verify: type check passes.
- [x] 3.3 Render mountain props with the other props in `BoardView.tsx`. Verify: full client test suite passes.
- [x] 3.4 Browser check on High: scree, peaks, ore and rubble drawn; peaks scaled up (×1.0–1.2) after the first look showed them small at the default camera.
- [x] 3.6 Owner feedback: one big grey mountain in the middle (behind the chip) with grey rocks. Changes: grey peak colours, two tall mountain variants (4–5) and three grey stone clusters (ore.glb variants 3–5), with placement, fallbacks and tests updated. The mountain is taller than a city but never hides corner pieces. Verify: tests, render and a browser look on High.
- [x] 3.7 Owner feedback: remove the volcanic-looking gold veins and make it greyer, like the Pyrenees, after the ore resource icon. Changes: grey limestone peaks with snow caps and broader shoulders, blue-seamed slate ore, a grey scree floor, and grey stone pebbles instead of beige boulders. Verify: tests, render and a browser look on High.
- [ ] 3.5 Browser check: robber on a mountain stays visible, clicks on a mountain intersection still pick it, Low shows the painted mountains.

## 4. Wrap-up

- [ ] 4.1 Screenshots of the default view for the owner's approval.
- [ ] 4.2 Record the source and licence of `microbox.fbx` in `theme.json` and the credits (ask the owner).
