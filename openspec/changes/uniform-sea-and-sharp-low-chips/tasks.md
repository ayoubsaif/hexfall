## 1. One sea for every quality level

- [x] 1.1 In `apps/client/src/scene/graphicsQuality.ts`, add `SEA = { segments: 256, waves: 7, low: false, rockDetail: 3, physical: true }` (High's waves; Classic keeps a 1-segment plane) and remove `segments` and `waves` from the `QUALITY` rows (design decision 1)
- [x] 1.2 In `apps/client/src/scene/Water.tsx`, read `SEA` instead of the tier for the plane segments, `WAVE_COUNT`, the `uLow` uniform and the coast-rock `detail`. Set `physical = realistic && SEA.physical && supportsWaterSimulation(renderer)`. Drop the tier from the shader material `key` (keep the mode)
- [x] 1.3 Mount `WaterSimulation` and the raised beach at every tier when float render targets work, so waves collide with the rocks (design decision 2)
- [x] 1.4 Update `test/scene/seaBounds.test.ts` to use `SEA.segments`, and make `test/scene/waterSimulation.test.ts` cover the solver directly without assuming High mounts it

## 2. Sharp chips at Low

- [x] 2.1 In `QUALITY`, change Low's `dpr` from 1 to 1.5 (Medium 1.5 and High 2 stay); `BoardCanvas.tsx` needs no other change
- [x] 2.2 Add a test that `QUALITY.low.dpr` is 1.5 and Low still has `shadows: false`

## 3. Settings copy

- [x] 3.1 Update `settings.graphics.qualityHint` in `src/i18n/locales/en/settings.ts` and `es/settings.ts`: Low now reduces shadows and sharpness, not waves; the sea looks the same at every level

## 4. Verify

- [x] 4.1 Add a test that the sea settings are not part of any quality tier (one `SEA` with High's 256 segments, 7 waves, `uLow` off, simulation on); `Water.tsx` no longer reads the tier
- [x] 4.2 Add a note to `openspec/changes/realistic-sea-and-coast-textures/` (or its archive step) that "Physical High-quality coast" is superseded by `graphics-quality` "Uniform sea across quality levels" (design decision 4)
- [ ] 4.3 Run the client test suite and typecheck (done: 739 tests pass, typecheck clean). Check by eye on a high-density phone (or devtools at DPR 3) that chip numbers are sharp at Low, the sea is identical across Low/Medium/High, waves reflect off the rocks and foam where they hit at Low, and frame rate on a phone at Low stays above ~42 fps

## 5. Resource harbor chip colours

- [x] 5.1 Let `ChipDisc` take a paper base colour (one cached texture per colour; default the number-chip yellow)
- [x] 5.2 Add `HARBOR_CHIP_BASE` in `HarborMarker.tsx` (light tint per resource, yellow for 3:1) and pass it to the harbor chip
- [x] 5.3 Test that the tints are distinct and keep at least 4.5:1 contrast with the rate ink
- [ ] 5.4 Check by eye that each harbor's icon and rate read clearly on its tint

## 6. Smooth physical coast

- [x] 6.1 Draw the water with a linearly filtered copy of the seabed (`bedSmooth`), so the waterline and rock contact foam no longer follow the solver's square cells
- [x] 6.2 Fade the water onto the raised sand using its depth over the real beach height, and draw the contact wash there, so the shore is soft like the analytic sea

## 7. Stone harbor piers

- [x] 7.1 Replace the plank texture in `HarborDock.tsx` with a procedural cartoon-stone colour and height map (Voronoi slabs, warm gaps, light rims, hairline cracks; seeded so it never changes), styled after the reference the owner gave (Guillaume Iperty, "Cartoon Rock Material"); no reference art is copied
- [x] 7.2 Turn the mooring posts into six-sided stone pillars under the deck; keep the deck height so harbor chips do not move
- [ ] 7.3 Owner check of the stone's colour and contrast close up
