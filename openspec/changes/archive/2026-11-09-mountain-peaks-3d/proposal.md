## Why

The high-quality 3D rebuild of the hexagons continues terrain by terrain, and forests and pastures are done. Mountain hexes still use their painted art. The owner supplied a landscape model (`microbox.fbx`) and asked for it to be reduced to a cartoon, low-poly style. They also asked for groups of ore rocks like the ore card: dark blue-grey rock with gold veins in the cracks.

## What Changes

- **Peak kit** built in Blender by a script (`tools/blender/mountain-kit.py`). It imports the owner's landscape model and cuts four summits out of it. Each summit fades to a round rim, gets a sharpened top, and is decimated to about 1.3k triangles. Faces are coloured like the Pyrenees: alpine green foothills, grey limestone, darker cliffs and snowy tops. Two of the cuts are taller, with broad shoulders and a snow cap, and serve as the big centre mountain. Exported as `models/peak.glb` (Draco, about 206 KB), model key `prop.peak`.
- **Rock kit** from the same script: three clusters of chunky faceted grey slate rocks split by glowing blue seams, after the ore resource icon, and the same three clusters in plain grey stone. (The first gold-veined version read as volcanic rock and was dropped, owner feedback.) Exported as `models/ore.glb` (about 51 KB), model key `prop.ore`.
- Procedural fallbacks for both keys (cone peak, rock lump).
- **3D mountains on Medium and High quality**. Mountain hexes show a grey scree floor (grey gravel and rock, a little alpine grass) instead of the painted art. Each one carries one big grey mountain in the middle, standing just behind the number chip (from the default camera) so it never covers the number. Around it are 3–4 grey stone clusters, one blue-seamed ore cluster, 2–3 small spruces and 3–5 small grey pebbles (owner feedback: "one mountain in the middle with some rocks in grey"). All of them stay clear of the number chip, the robber spot, the corners and the edges. The mountain is about 1.4× the height of a city, but from the default camera it never hides the piece on the corner behind it. Low quality keeps the painted mountains.
- Placement is pure and deterministic (`scene/mountainPeaks.ts`) and hashed by hex id. The props are drawn through the same instanced `CoastProps` as the forests and pastures.

## Capabilities

### New Capabilities
- `mountain-peaks`: the scree ground, peaks, ore, spruces and rubble on mountain hexes at Medium/High quality, their clear zones, height limit and determinism.

### Modified Capabilities
- `asset-theming`: "Asset kinds" gains the model keys `prop.peak` and `prop.ore`.

## Impact

- **Code**: `apps/client/src/scene/` (`mountainPeaks.ts` new, `IslandGround.tsx` scree shader, `BoardView.tsx`, `coastScatter.ts`), `src/theme/keys.ts`, `src/theme/fallbacks/coast.tsx` and `index.ts`.
- **Assets**: `models/peak.glb`, `models/ore.glb`, `theme.json` mappings and source text, plus `tools/blender/mountain-kit.py` and its `.blend` source. The owner's `microbox.fbx` lives in the git-ignored `assets/mountain/`.
- **Dependencies**: none. **Performance**: 3–4 mountains and about 40 more small props, and a few extra instanced draw calls.
