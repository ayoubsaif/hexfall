## Why

The island's edge is a smooth sand slope with a few stretched icosahedron rocks, and the scene is lit flat. The owner's two reference images (a medieval diorama island) show the look we want: a rocky shore of rounded, mossy boulders, a thin sand beach, grass tufts, bushes and pine trees on the rim, low stone walls, a deep teal sea and warm, soft, golden-hour light with gentle vignetting. The references are for style only; nothing in them is copied or traced.

## What Changes

- Build a **coast asset kit** in Blender (through the Blender MCP), starting from the current 3D objects (the procedural coast rocks, `jetty.glb`, `boat.glb`) as the scale and style baseline: a set of boulder variants, cliff rock chunks, a low dry-stone wall segment, pine trees and bushes. Each kit piece is a compressed GLB in the `diorama` theme.
- **Dress the coast in code**: keep the island ground and beach procedural (they follow the board layout), and scatter kit pieces deterministically along the shoreline and the outer rim, never on hexes, roads, settlement spots, harbor jetties or boat lanes.
- **Retexture the coast** with CC0 PBR maps (grass, mossy rock, beach sand) from Poly Haven / ambientCG. The owner downloads them; the plan gives the exact commands. The sand slope gains a grass band at its top, and kit rocks use the new rock material.
- **Ambient screen filters**: a warm color grade (golden-hour tone curve, slight saturation, teal sea / warm land split), a soft vignette, and ambient occlusion on Medium and High quality. Retune the sun and hemisphere light to match.
- A **Screen filters** on/off switch in Settings > Graphics (on by default).
- **3D forests** on Medium and High quality: forest hexes show a grass ground instead of the painted forest art, with a deterministic cluster of 3D evergreens standing on each, clear of the number chip, robber spot, corners and edges. Low quality keeps the painted forest. The evergreen (`prop.tree`, also used on the coast rim) is the owner-chosen BlendKit "Thuja Occidentalis Lowpoly" by Alexander Novgorodtsev, reduced in Blender from about 3 million to about 2 thousand triangles. The owner downloads it with the BlendKit add-on.
- New model asset keys `prop.boulder`, `prop.cliff`, `prop.wall`, `prop.tree`, `prop.bush`, each with a procedural fallback.

## Capabilities

### New Capabilities
- `coast-dressing`: the rocky, vegetated coast: which props exist, where they may and may not be placed, determinism, and the shore textures.
- `ambient-look`: the screen filters (color grade, vignette, ambient occlusion), their quality tiers and the user switch.
- `forest-trees`: 3D evergreens on forest hexes at Medium/High quality, the grass ground under them, and their clear zones.

### Modified Capabilities
- `asset-theming`: "Asset kinds" gains the five new `prop.*` model keys; "Licensing guard" also allows BlendKit's Royalty Free license (`LicenseRef-BlendKit-RF`), which always needs a credit.

## Impact

- **Code**: `apps/client/src/scene/` (`CoastTerrain.tsx`, `coastTerrain.ts`, `Scene.tsx`, `BoardCanvas.tsx`, `graphicsQuality.ts`, new coast scatter and post-processing modules), `src/theme/keys.ts` and fallbacks, `src/store/prefs.ts`, `src/settings/sections/GraphicsSection.tsx`, i18n (en, es).
- **Assets**: new GLBs in `apps/client/public/themes/diorama/models/`, new textures in `apps/client/public/textures/coast/` with `SOURCE.json` entries, `theme.json` source text updated. Blender source files kept outside the client build.
- **Dependencies**: none. Post-processing uses three.js's bundled `examples/jsm/postprocessing`.
- **Licensing**: BlendKit's Royalty Free license allows use inside a product such as this game, but not redistribution of the model on its own. The shipped GLB is a heavily reduced derivative, credited in `theme.json` and in the in-game Credits.
- **Tools**: Blender with the Blender MCP server (configured as `blender-mcp`; must be running when the kit is built). Texture downloads are run by the owner.
- **Performance**: more draw calls (mitigated by instancing) and one extra full-screen pass, plus AO on Medium/High.
