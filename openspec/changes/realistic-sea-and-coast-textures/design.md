## Context

`Water.tsx` draws one 200x200 plane with a custom `ShaderMaterial`. A signed-distance field over the 19 land hexes (`uLand[]`) gives `d`, the distance to the coast. Colors, swell, foam and one tiled `sand.webp` are all derived from `d` and noise. There are no sea textures. The reference image shows: glassy turquoise water that fades to pale sand in the shallows, soft caustic light, a smooth sand-to-water gradient with no hard line, warm lighting. The board camera is high-angle (default 60° elevation), so surface detail is seen from above, not at a grazing angle.

Constraints: no engine changes; procedural fallback must stay (see `asset-theming`); mobile GPU budget; reduced-motion users get a still sea; textures must be original (generated), the reference is style guidance only.

## Goals / Non-Goals

**Goals:**
- Sea and coast look close to the reference mood: luminous turquoise shallows, warm sand shoreline, soft foam, subtle caustics.
- Keep one shader and one plane. Add texture sampling, not geometry.
- Textures are seamless tiles, small, lazy-loaded, with the existing procedural look as fallback.

**Non-Goals:**
- No real reflections, refraction render targets, or mesh waves.
- No change to land tile art, harbors, pieces, layout, or camera.
- No per-device quality settings UI (a simple low-cost path is automatic).

## Decisions

1. **Texture-driven layers in the existing shader, not new meshes.** Layers: (a) `sea-caustics.webp` seamless grayscale caustic/ripple map, sampled twice at different scales and scroll directions, used to modulate brightness and as a normal-perturbation source; (b) `coast-sand.webp` seamless sand albedo (replaces `sand.webp`), used for the dry beach; (c) `coast-wet.webp` is not a separate file: wet sand is `sand` darkened and glossed by the shader. Alternative: tile `sea` hex images per ring cell. Rejected: seams between tiles, cannot follow the island outline, and the ring is only 18 cells.
2. **Distance bands drive the look.** From `d` (hex-radius units): dry sand (inside the land edge, `d < 0`) is not drawn by water; beach sand `0..0.35`, wet sand with a moving waterline `~0.15..0.5`, turquoise shallows `0.3..1.6`, mid blue `1.6..3.6`, deep beyond. The turquoise to deep ramp is a 3-stop gradient with tuned colors (`WATER_SHALLOW` luminous, new `WATER_LAGOON`). Sand shows through shallow water by blending with alpha falling off with `d`, which reproduces the reference's sand-under-water look.
2b. **Irregular shoreline (owner feedback 2026-11-06: "too straight, looks fake").** The land distance blends hex corners with a smooth-min, and the beach distance is warped by fbm at three scales (bays ~1 hex wide, ragged ~0.4, fine grain). Foam fronts and the depth ramp use the warped distance too, so no band is a clean offset of the hex outline. The beach always starts at the hex edge or beyond, so land tiles stay uncovered.
2c. **Mixed soft and crisp foam (owner decision 2026-11-06, after a static review of a reference site).** The soft lace foam and tint stay. On top, thin crisp contour lines of the same warped coast distance (wave lines that travel toward the beach and break into noise-cut segments, plus one thin waterline) use `fwidth` for one-pixel edges at any zoom. No extra texture fetch.
2d. **Baked coast field, Bruno-style (owner decision 2026-11-06).** A static review of a reference site showed a cheap structure: one baked scalar field drives a gradient ramp for the colour and hard contour lines for foam and ripples, with a tiling noise texture breaking the lines up. We adopt that structure (technique only, no code or assets copied): `coastField.ts` bakes shore distance, depth distance and wave phase into a 256x256 half-float texture at board creation (about 9 hex radii across), and the shader reads it with one fetch instead of looping 19 hexes and evaluating about ten fbm per pixel. The approved caustics image doubles as the noise texture. The approved lagoon image is no longer used (the gradient ramp supplies the water colour) and its file and manifest slot are removed. The shoreline no longer drifts over time; the wave lines, caustics and tide still animate.
3. **Generate textures with Higgsfield (authoring time), reviewed by the owner.** Use the reference only to write the prompt: "seamless tileable top-down stylized turquoise lagoon water caustics, soft, no foam, no objects" and "seamless top-down warm sand, fine grain, painterly". Reference image is not uploaded as an input. If owner prefers closer matching, owner shares extra screenshots and the spec's owner-supplied reference clause covers it. Each image needs owner approval before it enters the theme. Verify tileability by tiling 3x3 in a scratch image before shipping.
4. **Texture format and budget.** WebP, 512x512 each, grayscale caustics as single-channel-in-RGB, total under 300 KB. Mipmaps on, `RepeatWrapping`, anisotropy 4. Loaded with `useTexture` inside Suspense; while loading or on failure the existing procedural look renders (the uniforms use a `uHasTex` flag, so one shader serves both).
5. **Theme layer owns the paths.** The sea/coast textures are added to the theme manifest under a `water` block (not new `asset key`s, since the key set is fixed by `asset-theming`), and `Water` receives resolved URLs from the theme layer. No raw paths in `Scene` code. Alternative: add keys `sea.caustics`, `coast.sand`. Rejected: widens a closed key set and the "exactly this set" spec for little gain.
6. **Reduced motion.** `uTime` is frozen as today; caustic scroll and tide use `uTime`, so freezing time freezes them.
7. **Cost control.** At most 3 texture fetches per fragment; the SDF loop over 19 hexes stays. A `uLow` define (set when `devicePixelRatio > 2` on small screens or via `navigator.hardwareConcurrency <= 4`) drops the second caustic sample and the fbm foam lace octaves to 2.

## Risks / Trade-offs

- [Generated texture is not tileable or has visible repetition] → Tile-test 3x3 before approval; sample at two scales and rotated so repetition is not visible from the default camera.
- [Look drifts from reference] → Owner approval gate per texture; owner can supply screenshots; shader color constants are tunable in one place.
- [Mobile GPU cost] → 3-fetch cap, `uLow` path, measure with the existing perf tooling before merge.
- [Sea contrast hides harbor markers, roads on coast, or number legibility] → Keep deep-to-shallow ramp subtle near harbor markers; visually check harbors and coast roads in default and isometric board styles.
- [Provenance rule currently forbids references] → Delta to `asset-theming` allows an owner-supplied style reference, never copied or traced.

## Open Questions

- Should the turquoise lagoon tint also apply in the isometric board style, where the sea is lowered by the prism height? Default: yes, same shader, only `y` changes.
- Keep `sand.webp` as the fallback source or fully replace it? Default: replace and delete after the new sand is approved.
