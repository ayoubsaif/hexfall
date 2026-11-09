## Why

The owner supplied a new low-poly mountain model (`low-poly-mountain-free.zip` → `Mountain Lowpoly.fbx`, CC0) and asked for it to fill the whole mountain hexagon, with every other mountain prop removed. It is a twin-peak mountain with grey faceted rock and white snow patches, and one large mountain per hex reads more clearly than a small peak surrounded by rocks, ore, trees and pebbles.

## What Changes

- **Whole-hex mountain**: `tools/blender/mountain-kit.py` imports the owner's `Mountain Lowpoly.fbx` (kept in the git-ignored `assets/mountain/`). It drops the stray cube, camera and light, recentres the mesh, and stretches it over the whole hexagon, cropped to the hex shape. Its height fades to ground level along the hex rim, so corners (settlements, cities) and edges (roads) stay on flat ground. A clearing is carved in the middle for the number chip and the robber. The snow-capped peaks rise at the back, away from the default camera, and the slope on the camera side stays low enough that it never hides the chip, the robber or a front piece. The mesh is decimated to about 2k triangles and keeps its own rock and snow look, retinted to the board palette.
- **BREAKING (asset kit)**: `peak.glb` holds only the owner's mountain: variant 0 as supplied, variant 1 mirrored. The old landscape cuts (old variants 0–5) are removed.
- **Removed props**: mountain hexes no longer get grey stone clusters, the blue-seamed ore cluster, spruces or pebbles. `ore.glb` and the `prop.ore` model key are removed (only mountains used them).
- `scene/mountainPeaks.ts` places exactly one mountain per mountain hex, centred on the hex, with the form picked by hex id.
- `theme.json` drops `prop.ore` and its source text, and records the mountain as an owner-supplied CC0 model, reduced in Blender by the script. No credits entry is needed (CC0).
- The scree floor stays and shows round the mountain's rim.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `mountain-peaks`: one whole-hex mountain from the owner's model replaces the centre peak, rocks, ore, spruces and pebbles. (This capability is introduced by the in-progress change `mountain-peaks-3d`, so this change must be archived after it.)
- `asset-theming`: "Asset kinds" loses the model key `prop.ore`.

## Impact

- **Code**: `apps/client/src/scene/mountainPeaks.ts` (rewritten, much smaller), `src/theme/keys.ts`, `src/theme/fallbacks/coast.tsx` and `index.ts` (drop the ore fallback, update the peak fallback to fill the hex), key-count tests, `test/scene/mountainPeaks.test.ts`.
- **Assets**: `peak.glb` rebuilt, `ore.glb` deleted, `tools/blender/mountain-kit.py` rewritten (ore section removed) and its `.blend` source, `theme.json`. The FBX lives in the git-ignored `assets/mountain/` and is never shipped.
- **Dependencies**: none. **Performance**: fewer props (about 40 fewer small instances); one mountain of about 2k triangles per mountain hex.
