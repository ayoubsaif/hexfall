## 1. Textures (owner downloads)

- [x] 1.1 Give the owner the exact download commands for the CC0 sets (1K): Poly Haven mossy rock (`mossy_rock` or `rock_boulder_dry`), grass (`aerial_grass_rock` or ambientCG `Grass004`), beach sand (`coast_sand_01`), into `assets/textures-src/` (git-ignored). Verify: files present after the owner runs them.
- [x] 1.2 Extend `tools/soil-texture.mjs` (or a new `tools/coast-textures.mjs`) to convert them to 512 px seamless WebP (color only: the shaders use no normal or roughness maps) in `apps/client/public/textures/coast/`, and add their entries to `SOURCE.json`. Verify: script runs, files under 400 KB each, `pnpm run check` passes the licensing guard.

## 2. Blender coast kit

- [x] 2.1 With Blender running and the Blender MCP connected, import `jetty.glb`, `boat.glb` and a sample of the current coast rocks as the scale/style reference. Verify: screenshot of the reference scene shown to the owner.
- [ ] 2.2 Model `boulder` (5 variants) and `cliff` (3 variants) as low-poly rounded rocks with the mossy-rock material, named `variant_0..n`, origin at base centre. Verify: ≤ 1.5k tris per variant; owner approves a render.
- [ ] 2.3 Model `wall` (straight dry-stone segment + end cap), `tree` (2 pines) and `bush` (3 variants incl. grass tufts) with vertex colors; tree height below the city model. Verify: owner approves a render next to `city.glb`.
- [x] 2.4 Save every step as `tools/blender/coast-kit.py` and export compressed GLBs to `apps/client/public/themes/diorama/models/{boulder,cliff,wall,tree,bush}.glb`. Verify: `blender -b -P tools/blender/coast-kit.py` reproduces the files; each ≤ 300 KB.

## 3. Asset keys and fallbacks

- [x] 3.1 Add `prop.boulder|cliff|wall|tree|bush` as model keys in `theme/keys.ts` with procedural fallbacks (icosahedron rock, tall rock, box wall, cone tree, sphere bush). Verify: kind and fallback unit tests pass, including the new "Coast kit keys are models" scenario.
- [x] 3.2 Map the keys in `diorama/theme.json`, update its `source` text (Blender kit, CC0 textures). Verify: `tools/check-assets.mjs` passes with no unreferenced files.

## 4. Coast placement

- [x] 4.1 Write `scene/coastScatter.ts` (pure): shoreline rocks, rim vegetation, wall runs, hashed jitter, Y from `beachHeight`. Verify: unit test that output is identical across two calls and has ≥ 3 rock variants with no shore gap > 1 hex radius away from harbors.
- [x] 4.2 Add clear-zone rejection (land hexes, every intersection and path footprint, jetties, jetty→boat lanes). Verify: unit test that no instance overlaps any intersection, path, jetty or lane on the beginner board and three seeded variable boards.
- [x] 4.3 Render the scatter with one `InstancedMesh` per key+variant in `CoastTerrain.tsx`, replacing the icosahedron rocks; shadows on Medium/High. Verify: browser check on the beginner board; no z-fighting or floating rocks.
- [x] 4.4 Add the grass band to the beach shader and the moss-on-top blend to the rock material, with plain-color fallbacks when maps are missing. Verify: browser check; a unit/render test with the grass map absent still renders.

## 5. Ambient look

- [x] 5.1 Add `screenFilters` (default true) to `store/prefs.ts` with validation, and a switch in `GraphicsSection.tsx` with en/es strings. Verify: prefs and SettingsDialog tests pass.
- [x] 5.2 Write the grade+vignette shader and a pure JS port of its color curve. Verify: contrast test that the six terrains, all player colors and red chip colors stay pairwise distinguishable after grading.
- [x] 5.3 Build `scene/PostFx.tsx` (Render → GTAO on Medium/High → Grade/Vignette → Output), mounted only when filters are on; resize with the canvas. Verify: browser check on Low/Medium/High; toggling the switch updates without reload.
- [ ] 5.4 Retune lights in `Scene.tsx` (warm low sun, cooler hemisphere). Verify: side-by-side screenshot against the reference images shown to the owner.
- [ ] 5.5 Check picking and framing with filters on. Verify: existing picking/board-view tests pass and a manual click on a settlement spot picks the same spot with filters on and off.

## 6. Forest hexes

- [x] 6.1 The owner downloads "Thuja Occidentalis Lowpoly" with the BlendKit add-on and saves it as `assets/blendkit/thuja.blend`. Verify: the file exists.
- [ ] 6.2 Write `tools/blender/thuja-reduce.py` (join, decimate to about 1.5k triangles, flat `Pine`/`PineLight`/`Bark` materials, 0.24 high, 2 variants) and export `models/tree.glb`. Verify: ≤ 300 KB, height < 0.368, and the owner approves a render next to the original.
- [x] 6.3 Allow `LicenseRef-BlendKit-RF` in `tools/check-assets.mjs` and add the `prop.tree` credit to `theme.json`. Verify: check-assets passes; a test manifest mapping a BlendKit asset without a credit fails.
- [x] 6.4 Write `scene/forestTrees.ts` (5–9 trees per forest hex, ring placement, clear of chip, robber spot, corners and edges, hashed by hex id). Verify: unit tests for count, clear zones, height and determinism on the beginner board and two variable boards.
- [ ] 6.5 On Medium/High, bind the grass map to the forest slot in `IslandGround.tsx` and render the forest trees through the coast instancing; Low keeps the art and no trees. Verify: browser check at Low and High, robber moved onto a forest stays visible, and clicks on a forest intersection still pick it.
- [x] 6.6 Forest floor realism: patchy grass with needle litter, two-scale grass texture, anti-aliased blade grain in `IslandGround.tsx`, and 18 to 26 grass tufts per forest hex (`hexTufts` in `forestTrees.ts`). Verify: forest tests for tuft count and clear zones; browser check on High.

## 7. Wrap-up

- [x] 7.1 Run `pnpm run check` and `pnpm run test`. Verify: both pass.
- [x] 7.2 Measure frame rate on High and Low with filters on vs off. Verify: Low stays at its previous frame rate within 10 %; record numbers in the change notes.
- [ ] 7.3 Screenshots of the default view (Flat/3D, filters on/off) for the owner's approval. Verify: owner approves.

## Notes

- 7.1: lint, engine and asset checks and all tests pass. `vp check` still reports formatting in 14 files this change does not touch (unchanged since the last commit).
- 7.2: on the dev machine (165 Hz display) High and Low both hold 165 fps with filters on and off, so no measurable cost there. Worth re-measuring on a slower device.
- 6.5 / 5.5 still to check by hand: robber moved onto a forest, and a click on a forest intersection with filters on and off.
