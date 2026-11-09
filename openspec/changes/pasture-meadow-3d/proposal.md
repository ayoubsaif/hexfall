## Why

Forest hexes already show real little woods on Medium and High quality (change `coast-kit-and-ambient-look`). The rest of the terrains still use their painted art. This change continues the high-quality 3D rebuild of the hexagons with the pasture (wool) terrain: a meadow with grazing sheep, so pasture is recognisable at a glance and the board reads as one living diorama.

## What Changes

- **Sheep model** built in Blender by a script (`tools/blender/sheep.py`): an original low-poly sheep (round faceted wool body, blocky dark head, short thin legs) in the polygon style of an owner-chosen reference, in four variants (standing, grazing, lying down, lamb), exported as `models/sheep.glb` (Draco, about 23 KB, at most 252 triangles per variant).
- New model asset key `prop.sheep` with a procedural fallback (wool ellipsoid, dark head, four legs).
- **Sheep camp kit** after the owner's "sheep camp biome" concept sheet (style only): `tools/blender/sheep-camp.py` builds a thatched, timber-framed shepherd's hut, a wooden rail fence segment, a feed trough and a hay pile as `models/camp.glb` (key `prop.camp`, about 17 KB), with a procedural fallback.
- **3D pastures on Medium and High quality**: pasture hexes show a bright meadow (grass with clover patches and tiny white and yellow flowers) instead of the painted pasture art, laid out as a little sheep camp: a shepherd's hut with a hay pile on one side, a rail fence along the rim on the other with a flock of 3–5 sheep in front of it, a sandy path that hugs the chip from the hut door to the flock, 10–16 grass tufts and up to two bushes, clear of the number chip, robber spot, corners and edges. Low quality keeps the painted pasture.
- **Fix**: the ambient occlusion pass no longer draws see-through overlays (the number chips' label cards), which shaded a square "box-shadow" behind every chip on the bright meadow.
- Placement is pure and deterministic (`scene/pastureSheep.ts`), hashed by hex id, and drawn through the same instanced `CoastProps` as the forests.

## Capabilities

### New Capabilities
- `pasture-meadow`: the meadow ground and the sheep on pasture hexes at Medium/High quality, their clear zones and determinism.

### Modified Capabilities
- `asset-theming`: "Asset kinds" gains the model keys `prop.sheep` and `prop.camp`.

## Impact

- **Code**: `apps/client/src/scene/` (`pastureSheep.ts` new, `forestTrees.ts` tufts generalised, `IslandGround.tsx` meadow shader, `BoardView.tsx`, `coastScatter.ts`), `src/theme/keys.ts`, `src/theme/fallbacks/coast.tsx` and `index.ts`.
- **Assets**: `models/sheep.glb` and `models/camp.glb`, `theme.json` mappings and source text; `tools/blender/sheep.py`, `tools/blender/sheep-camp.py` and their `.blend` sources.
- **Dependencies**: none. **Performance**: about 20 sheep and 60 tufts more, a handful of extra instanced draw calls.
