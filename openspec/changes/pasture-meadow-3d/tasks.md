## 1. Sheep model

- [x] 1.1 Write `tools/blender/sheep.py` (4 variants: standing, grazing, lying, lamb; facing +X; origin at base centre) and export `models/sheep.glb`. Verify: ≤ 2k tris per variant, ≤ 300 KB, preview render next to a tree and a city.
- [x] 1.2 Owner feedback: shorter, thinner legs, tucked closer to the middle of the body. Verify: new preview render.
- [x] 1.3 Rework to the polygon style of the owner's CGTrader reference (style only): one faceted egg body, blocky head, side ears. Verify: close-up and scale renders.
- [ ] 1.4 Owner approves the sheep look (the owner suggested a CGTrader low-poly sheep as the polygon-style reference). Verify: owner approves a render.

## 2. Sheep camp kit

- [x] 2.1 Write `tools/blender/sheep-camp.py` (hut, fence segment, trough, hay pile, after the owner's concept sheet, style only) and export `models/camp.glb`. Verify: ≤ 2k tris per variant, ≤ 300 KB, preview render with sheep and a settlement.

## 3. Asset keys and fallbacks

- [x] 3.1 Add `prop.sheep` and `prop.camp` to `theme/keys.ts`, `COAST_KEYS` and the procedural fallback kit; map it in `diorama/theme.json` and extend its `source` text. Verify: keys/manifest tests and `tools/check-assets.mjs` pass.

## 4. Pasture placement and ground

- [x] 4.1 Write `scene/pastureSheep.ts` (`hexCamp`: hut, hay, fence run, trough, flock of 3–5, up to 2 bushes, 10–16 tufts, path ground marks; generalise `hexTufts`). Verify: unit tests for counts, clear zones, no overlap, height and determinism on the beginner board and two variable boards.
- [x] 4.2 Add `meadowFloor()` and `campGround()` (dirt path and trodden patches) to the `IslandGround.tsx` shader for the pasture slot on Medium/High. Verify: type check passes.
- [x] 4.3 Render pasture props with the forest props in `BoardView.tsx`. Verify: full client test suite passes.
- [x] 4.4 Browser check on High: meadow, camps and flocks drawn; camp scaled up (hut ×2, kit ×1.7, sheep ×1.6) after the first look showed it too small at the default camera.
- [x] 4.6 Owner feedback: drop the trough (it read as a box behind every chip); make the path straight legs and sand-coloured like the strips between tiles. Verify: path tests and a browser look on High.
- [x] 4.7 Owner feedback: path after the owner's sketch (hut door, close round the front of the chip, ending among the sheep); remove the square shadow behind every chip (AO pass skips transparent overlays, `isOverlay` unit test). Verify: tests and a browser look on High.
- [ ] 4.5 Browser check: robber moved onto a pasture stays visible, clicks on a pasture intersection still pick it, Low shows the painted pasture.

## 5. Wrap-up

- [ ] 5.1 Screenshots of the default view for the owner's approval.
