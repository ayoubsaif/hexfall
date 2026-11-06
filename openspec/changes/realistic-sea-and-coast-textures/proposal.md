## Why

The sea is a fully procedural shader (`apps/client/src/scene/Water.tsx`): flat gradients, sine swell and noise foam. It reads as a clean vector sea, while the rest of the board is painted. The coast is a thin foam line with one tiled sand image. The owner wants a stylized-realistic look like the supplied reference (a lagoon with glassy turquoise water, soft sunlit sand shallows, gentle shoreline gradient). The reference is a stylized 3D game render, used here as a mood and palette reference only.

## What Changes

- Add original, seamless, tileable sea and coast texture images, generated with Higgsfield from prompts derived from the reference (not copied from it): shallow turquoise water with caustics, wet sand shoreline, dry sand, soft foam lace. Owner supplies extra screenshots if the generated results drift from the reference.
- Rework the `Water` shader to sample those textures: depth ramp from sandy shallows through luminous turquoise to deep blue, scrolling caustic and normal detail on the surface, a translucent wet-sand band at the waterline, soft foam edge. Keep the signed-distance coast field so the look follows the island outline.
- Add a coast band: dry sand, wet sand, then shallow water, blended by distance to land, replacing the single sand tile and hard foam line.
- Keep the procedural look as the fallback when textures are missing or fail to load. The game stays playable with zero assets.
- Reduced motion keeps a still sea; texture scrolling and caustic animation freeze.
- Textures are lazy-loaded, WebP, with a size budget so mobile load stays small.
- **No** gameplay, engine, server or layout change. Hex, harbor and piece placement is unchanged.

## Capabilities

### New Capabilities
- `sea-coast-rendering`: how the sea plane and coast band are drawn: texture layers, depth ramp, shoreline blend, animation, reduced-motion, fallback and performance budget.

### Modified Capabilities
- `asset-theming`: the default-theme art rule currently forbids any existing artwork as input or reference. It must allow an owner-supplied style reference for the sea and coast textures, still forbidding copying or tracing it, and still requiring owner approval of each image. The sea and coast textures are also added as theme-resolved textures.
- `board-view`: the "Sea frame" requirement states the sea is flat tiles over a sea-colored background; it must state the sea is a continuous textured water surface with a shaded coast band.

## Impact

- Code: `apps/client/src/scene/Water.tsx`, `apps/client/src/scene/Scene.tsx`, the theme loader and manifest (`apps/client/public/themes/diorama/theme.json`), the asset check script.
- Assets: new WebP textures under `apps/client/public/textures/` (or the theme folder), a few hundred KB total.
- Tests: client scene tests for fallback and reduced motion; asset check for texture size and license declaration.
- Dependencies: none new. Higgsfield is used only at authoring time and credits are spent then.
- Risk: look drifts from the reference or hurts mobile GPU cost. Mitigated by owner approval gate and a fragment cost budget.

## Continued owner scope (2026-11-07)

Upgrade Realistic High to raised sand, textured rocks and evolving GPU shallow-water physics. Preserve Classic and cheaper tiers. The no-geometry limitation is superseded for High; no gameplay or engine changes. Validate bounded solver stepping, obstacles, fallback, reduced motion and resource cleanup.
