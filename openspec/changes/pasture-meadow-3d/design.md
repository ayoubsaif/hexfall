## Context

Same base as the forests (see `coast-kit-and-ambient-look/design.md` §7): `IslandGround.tsx` draws the whole island with one shader that gives every terrain a texture slot, and on Medium/High (`QUALITY_RICH`) the forest slot becomes a procedural forest floor. `forestTrees.ts` places trees and tufts per forest hex with `forestSpotClear` (chip, robber spot, corners, edges), and `CoastProps` instances them per key and variant.

## Decisions

### 1. Meadow ground in the island shader
On Medium/High the pasture slot is replaced by `meadowFloor()`: the shared `grassAt()` with `PASTURE_GRASS` (`#8fb84a`, brighter and yellower than the forest floor's `#557a2f`), lusher clover patches from low-frequency noise, and a sparse hashed grid of tiny white and yellow flower dots. The dots fade out with `fwidth` before they get smaller than a pixel, like the blade grain, so they never shimmer. *Alternative:* a CC0 meadow texture (rejected: one more download; the procedural look matches the forest floor).

### 2. Sheep model by script
`tools/blender/sheep.py` builds each sheep in the polygon style of the owner's reference (a low-poly sheep on CGTrader, used for style only; nothing downloaded or copied): one round, egg-shaped wool body with big flat facets (shaded wool on the faces pointing down), a large blocky dark head with a flat face and a narrower muzzle, set high on the front of the body and overlapping it, flat ears sticking out sideways, and short thin legs tucked under the middle of the body (owner request). Variants: `sheep_variant_0` standing, `1` grazing (muzzle just above the grass), `2` lying (front legs folded), `3` lamb (0.72 scale). Facing +X, origin at the base centre, at most 252 triangles per variant, about 23 KB in all. Heights 0.057–0.08, under a quarter of a city (0.368). Materials `Wool`, `WoolShade`, `SheepFace`, `Hoof`.

### 3. Sheep camp kit
`tools/blender/sheep-camp.py` builds `camp.glb` with four variants (style after the owner's concept sheet, nothing traced): `0` hut (stone footing, plaster walls in a dark timber frame with braces, a plank door and small window on +X, plaster gables with a king post, a steep thatched roof in three stepped straw layers, ridge roll and crossed ridge sticks); `1` rail fence segment (three posts, two split rails, 0.16 long along X); `2` feed trough on trestle legs filled with hay (kept in the kit but not placed: on the path ring just behind the chip it read as a stray box, owner feedback); `3` hay pile. Neutral straw, plaster and wood colours only, never player colours.

### 4. Camp layout and size
`hexCamp(hex)` lays out one camp per pasture, all hashed by the hex id:
1. **Hut** at 0.6 from the centre, on the first clear spot of 24 angles from a hashed start, door turned to the chip; a hay pile beside it.
2. **Fence** on the rim (radius 0.68) opposite the hut: 3 segments chained post to post. Pen angles offset by 0, ±0.35, ±0.7 and ±1.05 rad are tried and the longest clear run wins (the robber's spot can block part of the rim). A segment whose posts or rails would touch a corner, edge, chip or robber clear zone is left out, like a gate.
3. **Flock** of 3–5 between the chip and the fence (weighted poses: grazing 42 %, standing 28 %, lying 18 %, lamb 12 %), never overlapping each other or the camp props.
4. Up to two bushes and 10–16 tufts, keeping out from under everything.
5. **Path** (`CampGround`), after the owner's sketch: short straight legs, no arcs. Five points: the hut door (0.5 from the centre), three bends on a ring at 0.43 just outside the chip, and the flock (0.5 toward the pen), spread the short way round, so it hugs the front of the chip without touching it. Passed to `IslandGround` per tile (three `vec4` uniforms) and painted by `campGround()` with the same sand as the strips between tiles, a little darker and trodden, with a ragged edge and slightly flattened grass along it.

At native size the hut was about 12 px at the default camera, so placement scales the camp up: hut ×2.0 (0.19 tall, still shorter than a settlement's 0.222), fence and hay ×1.7, sheep ×1.6 (at most 0.14 tall, under half a city). Footprint radii scale with them.

### 5. Rendering
`BoardView` concatenates `forestTrees(board)` and `pastureSheep(board)` into the one Medium/High `CoastProps` list (keyed on the terrains, not the robber). `prop.sheep` and `prop.camp` join `COAST_KEYS`, so it gets the theme GLB or the procedural fallback the same way as the kit.

### 6. Overlays skip ambient occlusion
The GTAO pass draws depth and normals with one override material, so the chips' transparent label quads (and any other `transparent` + `depthWrite: false` overlay) became solid squares and shaded a square shadow round every chip. `PostFx` now hides such overlays while the AO pass renders (`isOverlay`), then shows them again.

## Risks / Trade-offs

- [Pasture and rim grass look alike] → the rim grass is darker (`#7d9e45`) and separated from tiles by sand strips; the sheep are the main cue.
- [Sheep or camp props hide pieces or chips] → same clear zones as forests (fence posts and rails sampled along each segment), unit tested on the beginner board and two variable boards.
- [The hut is mistaken for a settlement] → shorter than a settlement, thatched and plaster-coloured, never in a player colour, always set back from corners.
- [White wool clips under the warm grade] → wool is off-white (`#eee8d8`).
