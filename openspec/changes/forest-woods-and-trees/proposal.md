## Why

The owner wants forest hexes to read as a forest: richer dressing after their low-poly forest reference sheet (fallen trees, a woodpile "ready to pick up", the coast's rocks) and better trees after a low-poly forest tree pack on Sketchfab (style only). A creek with a footbridge was tried and then dropped at the owner's request. They also asked to take the trees off the coast and narrow the beach.

## What Changes

- New trees `models/tree.glb`, a mix the owner chose: 5 original faceted trees (`tools/blender/forest-trees.py`: tall spruce, spruce, young spruce, birch, broadleaf) plus the 8 textured background trees of "Low Poly Forest Tree Pack" by 99.Miles (CC BY 4.0, downloaded by the owner), combined by `tools/blender/tree-pack.py` (rescaled, re-anchored, atlas baked to a 768 px WebP with alpha clip; 238 KB). Replaces the reduced BlendKit thuja; credit moves to 99.Miles.
- New forest kit `models/woods.glb` (key `prop.woods`, `tools/blender/forest-kit.py`): small fallen log, stump, fern, woodpile of cut logs, mushrooms.
- Every forest hex (Medium/High): 18–26 mixed trees packed into a wood, 2–4 coast boulders, a woodpile, often a fallen log, stumps, ferns and mushrooms, scaled up 1.6x, plus grass tufts.
- Coast: no trees on the rim (bushes and grass only); narrower beach (`BEACH_SLOPE_END` 0.75 -> 0.5).

## Impact

`scene/forestTrees.ts`, `scene/coastScatter.ts`, `scene/coastTerrain.ts`, `theme/keys.ts`, `theme/fallbacks/*`, `diorama/theme.json`, tests.
