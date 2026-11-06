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
