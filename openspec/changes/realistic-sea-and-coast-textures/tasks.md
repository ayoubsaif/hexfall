## 1. Texture authoring (needs owner approval)

- [x] 1.1 Write Higgsfield prompts (seamless tileable top-down stylized turquoise lagoon caustics; seamless warm beach sand) from the reference mood; do not upload the reference as an image input
- [x] 1.2 Generate 2-3 candidates per texture; ask the owner for extra reference screenshots if candidates drift from the lagoon look
- [x] 1.3 Tile-test each candidate 3x3 in a scratch image; fix seams (offset-blend) or regenerate
- [x] 1.4 Show candidates to the owner and ship only approved ones as 512x512 WebP (`water/lagoon.webp`, `water/caustics.webp`, `water/sand.webp`, approved 2026-11-06), total under 300 KB

## 2. Theme layer

- [x] 2.1 Add a `water` block to the theme manifest schema and loader (texture file names, optional tint colors) with fallback to none
- [x] 2.2 Declare the new textures and provenance (original, generated with an owner-supplied style reference, license) in `apps/client/public/themes/diorama/theme.json`
- [x] 2.3 Expose resolved water texture URLs from the theme layer; ensure `Scene`/`Water` code holds no raw file paths

## 3. Water shader

- [x] 3.1 Add `uCaustics`, `uSand`, `uHasTex`, `uLow` uniforms; sample caustics at two scales and scroll directions
- [x] 3.2 Rework the depth ramp to turquoise lagoon shallows with deep blue offshore; tune colors in one constants block
- [x] 3.3 Build the coast band: beach sand, moving wet-sand waterline, sand visible through shallows, soft foam edge (no hard outline)
- [x] 3.4 Keep the procedural path when `uHasTex` is false; lazy-load textures via Suspense without blocking first render; handle load/decode failure
- [x] 3.5 Add the low-cost path (single caustic sample, fewer fbm octaves) and cap fetches at 3 per fragment
- [x] 3.6 Freeze caustic scroll and tide under reduced motion

## 4. Tooling and cleanup

- [x] 4.1 Extend `tools/check-assets.mjs`: verify `water` textures exist, are square, and total at most 300 KB
- [x] 4.2 Remove `apps/client/public/textures/sand.webp` and `tools/beach-gen.mjs` once the new sand is approved and unused

## 5. Tests and verification

- [x] 5.1 Client test: Water renders with no textures (fallback) and when a texture load fails, without throwing
- [x] 5.2 Client test: reduced motion yields a constant `uTime`
- [x] 5.3 Asset-check test for size, squareness and missing files
- [x] 5.4 Visual check in the browser: default and isometric board styles, harbors, coast roads, number legibility, concave coast corners, no seams
- [ ] 5.5 Mobile check: frame time acceptable on a low-end profile; run `vp check` and the client test suite

## 6. Baked coast field (Bruno-style rework)

- [x] 6.1 Bake shore, depth and phase into a half-float texture at board creation (`coastField.ts`) with unit tests
- [x] 6.2 Rewrite the water shader to read the baked field, colour by a depth gradient, and draw crisp contour lines plus the soft layer
- [x] 6.3 Reuse the caustics image as the noise texture; drop the unused lagoon image, manifest slot and check-assets slot
- [x] 6.4 Update the spec (fetch cap, baked field, crisp lines) and design notes
- [ ] 6.5 Measure frame time before/after on a quiet machine or phone

## 7. Physical coast and High-quality water (continued owner request)

- [x] 7.1 Finish raised sand and textured CC0 rocks, preserving road and harbor clearance and fallback materials
- [x] 7.2 Implement bounded fixed-step GPU shallow-water height/velocity evolution with finite depth, shore/rock obstacles and incoming waves
- [x] 7.3 Use simulated displacement/normals and terrain intersections for High water; preserve Classic, lower tiers, reduced motion and unsupported-device fallback; dispose GPU resources
- [x] 7.4 Test geometry, stability/timestep behavior and lifecycle; run checks, client tests and build; visually verify High and fallback modes
- [x] 7.5 Align wooden harbor docks to their coastal edges, widen the deck and seat chips flush on it (owner follow-up)

### Verification notes — 2026-11-07

- Tasks 7.1–7.5 implemented; 749 client tests across 84 files pass, production build passes, OpenSpec strict validation passes. `vp check` has no errors (one unrelated unused-import warning in concurrent resource-icon work). Asset checks pass with existing terrain-size warnings.
- Chromium checks: both water modes at Low/Medium/High/Auto, saved choices, 390px layout and High reduced-motion pixel equality pass; no shader errors or JS exceptions. Visual review confirms raised coast/rocks, clear labels and widened, edge-aligned harbor decks with seated chips.
- GPU readback after 1200 solver steps: finite values, maximum height 0.04294, 35790 moving cells including 2792 shallow cells, zero obstacle leakage, exact freeze equality, and all three GPU textures released after disposal.
- Task 5.5 remains open: the available headless browser uses SwiftShader software rasterization. At 390×844 / DPR 1, Realistic Low and 4× CPU throttle, 180 frame intervals averaged 127.6 ms (median 116.7, p95 166.7). This is not acceptable mobile performance and does not establish hardware-GPU phone performance. Tests/checks within 5.5 are complete.
- Task 6.5 remains open: no quiet hardware-GPU before/after baseline or physical phone is available in this session. Do not treat the CPU-throttled software result as phone validation.


## 8. Chip and camera follow-ups

- [x] 8.1 Apply player-card aged-paper styling to pale-yellow number and harbor chips
- [x] 8.2 Face chips and text toward camera pitch/yaw; fit labels and use shared number size with probability-weight typography
- [x] 8.3 Remove panning and its setting; keep zoom/orbit fixed on board center
- [x] 8.4 Fix live shader-uniform synchronization so water time, loaded textures and High simulation reach the rendered material; add R3F regression test
- [x] 8.5 Add 35% smaller, lighter textured rocks to Realistic Low/Medium while preserving their sea shader and avoiding High beach geometry/solver costs (owner-approved combination)
- [x] 8.6 Reduce the coast from 21 stones to at most eight, with two uneven clusters and two isolated stones; retain road/harbor clearance
- [x] 8.7 Size the sea to the visible camera footprint, reduce Low water from 8192 triangles to two, and use cheaper rock meshes without unused beach textures

Final follow-up validation: 753 client tests / 85 files pass; production build and strict
OpenSpec validation pass. Browser confirms the fixed center, advancing Low-water time,
loaded caustic/sand textures, eight fully textured rocks, and no shader errors after the
visible-footprint optimization. Final screenshot: `/tmp/hexfall-final-low-coast.png`.
The earlier hardware performance tasks remain unmeasured; triangle-count savings do not
constitute a hardware frame-time benchmark.
