## Context

On Medium/High (`richForest`), forests (`forestTrees.ts`) and pastures (`pastureSheep.ts`) replace the painted tile art with two things: a procedural floor in `IslandGround.tsx` and instanced props in `CoastProps`. Mountains follow the same pattern.

## Goals / Non-Goals

**Goals:**
- Mountains are recognisable at a glance at the default camera.
- Peaks come from the owner's model, in a low-poly cartoon style.
- Ore rocks echo the ore card.
- Nothing hides the chips, the robber or the pieces.

**Non-Goals:** no change to Low quality, no change to the rules engine, no animation.

## Decisions

### 1. Peaks cut from the owner's model
`mountain-kit.py` imports the FBX landscapes and finds the four highest summits that are at least 0.45 apart (two per landscape). For each summit it:
1. Crops a radius of 0.42 round it.
2. Fades the height to zero at the rim and sharpens the top with a power curve.
3. Adds a short skirt below ground.
4. Decimates to about 650 target faces.
5. Colours faces by height and slope, after the Pyrenees (owner feedback): alpine green foothills below 0.06, then grey limestone, darker grey cliff on steep faces, and snow on the tops.

Variants 4–5 are the big centre mountain: the summits of variants 0 and 2 cut again with a 0.25 footprint, about 0.5 tall, with a gentle power curve (broad shoulders) and a larger snow cap (above 60% of the height).

Each variant has a fixed footprint radius and height (`PEAK_KINDS`). Building from the owner's model keeps the shapes they chose, and decimating plus flat colour bands gives the cartoon look.

### 2. Rock clusters after the ore icon
Lumpy icospheres (subdivision 2, with noise) are split into 3–4 chunks with an inset region. Variants 0–2 are ore, like the ore resource icon: grey slate whose cracks get an emissive blue material (`OreVein`, emission strength 1.4), so the seams read even in shade. A first gold-veined version read as volcanic rock and was dropped. Variants 3–5 are the same clusters in plain grey stone with dark grey cracks.

### 3. Placement (`hexMountain`)
1. **Mountain** (owner feedback: one mountain in the middle). A single big peak (variant 4 or 5) stands straight behind the chip on the −z side, away from the default camera, so the chip stays in front of it. Because it stands behind the chip it cannot cover the number, so its foot may come as close as the chip disc plus a gap (`MOUNTAIN_CHIP_CLEAR` = 0.26, passed to `forestSpotClear` as `chipClear`) instead of the usual 0.34. It shrinks only if it would not fit.
2. **Rocks**: one blue-seamed ore cluster and 3–4 grey stone clusters at 1.5× scale round the chip.
3. **Spruces**: 2–3 small trees (`prop.tree`, ×0.5).
4. **Pebbles**: 3–5 grey stone clusters drawn small (`prop.ore` variants 3–5, ×0.7), instead of the beige coast boulders.

Every other prop passes `forestSpotClear` with the usual chip clearance, and every prop also clears the robber spot, the corners and the edges.

**Height.** The mountain (about 0.5) is taller than a city (0.368). The camera looks 55° down, so a prop of height h covers the ground only up to h / tan 55° ≈ 0.36 behind it. The corner behind the mountain is about 0.5 away, so its piece always stays in view (unit test).

### 4. Scree floor
`mountainFloor()` in the island shader blends grey scree, darker grey rock patches, streaks, a little alpine grass and fine grain. It is applied only to the mountain slot, and only on Medium/High.

## Risks / Trade-offs

- `peak.glb` (about 206 KB) is the largest prop so far. It is still under the 300 KB per-model budget. Variants 1 and 3 are no longer placed and could be dropped to save space.
- Peaks near the rim can look cramped against neighbouring tiles. The edge clear zone keeps them inside the hex.
- The FBX's source and licence are not recorded yet. Ask the owner before release (task 4.2).
