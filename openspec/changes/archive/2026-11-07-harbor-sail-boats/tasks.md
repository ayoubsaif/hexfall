## 1. Theme key and assets

- [x] 1.1 Add `prop.boat` (kind `model`) to `ASSET_KEYS` and `ASSET_KIND` in `apps/client/src/theme/keys.ts`; extend `apps/client/test/theme/keys.test.ts` so the key set is exactly the 20 keys and `prop.boat` is a model; verify with `pnpm --filter client test keys`
- [x] 1.2 Add the procedural boat fallback in `apps/client/src/theme/fallbacks/` (hull box/lathe, mast cylinder named `Boat Mast`, flat sail plane named `Boat Sail` with its face along ±X and UVs, a yard named `Boat Yard`), authored at the final on-board size with the waterline at y=0; register it in `FALLBACKS`; extend `fallbacks.test.ts` to check the named sail and mast nodes exist and the hull's lowest point is at or just below y=0
- [x] 1.3 Copy `docs/assets/cartoon_boat_toon.glb` (Draco-compressed; the client serves the Draco decoder from `/draco/`) to `apps/client/public/themes/diorama/models/boat.glb`; map `prop.boat` in `theme.json` with a transform override (scale 0.2, small negative y offset so the keel sits under the waterline) and mention the boat as the owner's original work in the manifest `source`; verify `node tools/check-assets.mjs` passes with no unreferenced-file error

## 2. Sail label

- [x] 2.1 Add a pure `sailUVs(positions)` helper (new `apps/client/src/scene/sailUv.ts`) that maps local (z, y) to [0,1]² from the bounding box, u reading left-to-right from the +X side; unit test corners and orientation in `apps/client/test/scene/sailUv.test.ts`
- [x] 2.2 Rename `HARBOR_CHIP_BASE` to `HARBOR_SAIL_BASE` (generic becomes the canvas cloth colour `#d1b885`, special types keep their resource tints); move `harborChip.test.ts` to `harborSail.test.ts` checking one distinct tint per resource and dark rate ink contrast on every tint; verify the test passes
- [x] 2.3 Add the cached per-type sail texture and shared material (cloth/tint background, resource icon above, rate with halo below; icon drawn in when it decodes and `needsUpdate` set); verify in a test that the six types give six distinct textures and that generic draws no icon

## 3. Boat on the harbor

- [x] 3.1 Add the pure rig-turn maths to `chipYaw.ts` (or a sibling `sailYaw.ts`): sail yaw in the hull frame from camera position, sail world position, boat world yaw and the previous yaw, using `cameraYaw` plus the −π/2 face offset; and the pivot matrix `T(p)·R_y(yaw)·T(−p)·M0`. Unit test: camera due +X of a zero-yaw boat gives yaw 0; camera overhead keeps the previous yaw; pivoted rotation keeps the mast axis point fixed
- [x] 3.2 Add `apps/client/src/scene/HarborBoat.tsx`: renders `<Asset assetKey="prop.boat" />`, finds the sail/mast/yard/sheet/mast-cap nodes by name after mount and after the themed model replaces the fallback, applies `sailUVs` once per sail geometry, assigns the harbor type's sail material, stores original local matrices and exposes a registration callback for the per-frame turn
- [x] 3.3 Update `HarborMarker.tsx`: remove `HarborChip`, the chip texture cache and the `chipRef` prop; place `HarborBoat` at the pier's sea end at `y = seaLevel`, hull X axis along the slot path; keep `HarborDock` unchanged
- [x] 3.4 In `BoardView.tsx`, stop passing `chipRef` to harbors and add one `useFrame` that turns every registered sail rig (reused scratch vectors/matrices, no allocation per frame); verify in the running client that all 9 sails face the camera while orbiting and the hulls stay still
- [x] 3.5 Update `useFitCamera.ts` to include the boats' mast-top height in the framed bounds; verify at 16:9 and 9:16 viewports that every sail top is in view at load (existing framing test extended or a new one in `apps/client/test/scene/`)

## 4. Verification

- [x] 4.1 Run `pnpm check` and `pnpm test`; both pass
- [ ] 4.2 Run the client and check on the beginner board: slot 1 shows a grain sail with "2:1"; generic sails show only "3:1" on plain canvas; with the theme unmapped (or `boat.glb` renamed) the fallback boats show the same labels and turn; take a desktop and a phone-width screenshot for review
