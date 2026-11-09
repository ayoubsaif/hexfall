## Context

Today a mountain hex (Medium/High) shows a scree floor plus props from `scene/mountainPeaks.ts`: one centre peak (`peak.glb` variant 4–5, radius 0.25, about 0.5 tall) behind the chip, stone and ore clusters (`ore.glb`), spruces (`prop.tree`) and pebbles. All are drawn by the instanced `CoastProps` (no raycast, so props never steal clicks).

Relevant geometry:
- Hex circumradius 1; corners at ρ = 1, edge midpoints at ρ ≈ 0.866. The mountain tile is domed: `domeHeight("tile.mountains", ρ) = 0.24·(1 − (ρ/0.9)²)²`, zero at ρ ≥ 0.9, so pieces stand at y = 0.
- Number chip: radius 0.22 at the centre. Robber: at offset (−0.45, +0.3) from the centre when the hex has a chip (+z faces the default camera, which looks 55° down).
- A city is about 0.37 tall.

The owner's `Mountain Lowpoly.fbx` (inspected headless in Blender 5.2): the object `Mountain` (5,137 triangles, scale 9.185, +90° X rotation from Y-up) plus a stray `Cube`, `Camera` and `Light`. Its world bounds are about 5.73 × 6.03 across and 2.29 tall, with the base at z ≈ 0, off-centre. It has two materials, `A` (dark grey rock) and `B` (light grey snow), with normal-map nodes but no textures, and a ragged base edge.

## Goals / Non-Goals

**Goals:** one mountain spanning the hex that still reads as the owner's model; the chip, robber and pieces stay visible and clickable; the build stays a repo script; `peak.glb` stays at 300 KB or less.

**Non-Goals:** no change to Low quality, the scree floor shader, other terrains or the rules engine. No change to chip, robber or piece positions.

## Decisions

### 1. Bake the hex fit in Blender, not at runtime
`mountain-kit.py` turns the FBX into a mesh already shaped for one hex (origin at the hex centre, 1 unit = circumradius), so the runtime only places one instance at the hex centre with `ground = 0` and `scale = 1`. Steps:
1. Import, keep only `Mountain`, apply its transform (+Z up), and centre its footprint on the origin.
2. Scale XY uniformly so the footprint spans the hex (largest half-width → 0.9, the dome radius), then scale Z to the target peak height `PEAK_HEIGHT` (a tuning knob, starting at 0.55 above the dome). The model's twin summits are rotated (yaw fixed in the script) so they sit on the back half (−z), away from the camera.
3. **Height mask** `m(x, z)` multiplies the model's height above its base:
   - **Rim fade**: 1 inside ρ = 0.6, smoothly to 0 at ρ = 0.85, so nothing rises at corners or edges (roads stay at ρ ≥ 0.866).
   - **Clearing**: 0 inside a stadium shape covering the chip (radius 0.22 + 0.06 gap round the centre) and the robber spot (radius 0.13 + 0.06 round (−0.45, +0.3)), smoothly to 1 over 0.12 beyond it.
   - **Front cap**: the camera looks down at 55° from +z, so a point at distance d in front of a target (toward +z) blocks it only if it rises above `target top + d · tan 55°`. For every point in front of the chip, the robber or a front corner piece, the height is capped below that line (with a 0.02 margin). In practice the front third of the hex becomes low foothills.
4. **Follow the dome**: final z = `domeHeight(ρ)` + masked mountain height, with the same dome formula as the client (0.24, radius 0.9) passed in as script constants. In the clearing and at the rim the mesh sits 0.005 *below* the dome, so the ground shader shows through and the chip and robber stand on the normal ground.
5. Crop to the hex: delete faces outside ρ = 0.88 (hexagon distance), then extrude the boundary down to −0.03 as a skirt.
6. Decimate (collapse, delimited by material) to about 2,000 triangles; flat shading.
7. Variant 1 is variant 0 mirrored on X (normals recalculated). Mirroring on X keeps the summits at the back.

*Alternative*: scale and dome-fit at runtime in a vertex shader. Rejected: more code paths, and the mask needs the robber offset, which is static anyway.

### 2. Materials: keep the owner's two looks
Slot `A` → grey rock Principled BSDF in the board palette; slot `B` → the existing snow material. Normal-map nodes are dropped. Faces that end up low (below 0.04 above the dome) after masking take a scree-grey material so the foothills blend into the floor shader.

### 3. Remove the other mountain props and `prop.ore`
`hexMountain` returns a single `prop.peak` instance: `{ variant: hash(hex) < 0.5 ? 0 : 1, x: cx, z: cz, ground: 0, yaw: 0, scale: 1 }`. Yaw stays 0 because the mask is built for a fixed orientation (the clearing and front cap depend on the camera side). `PEAK_KINDS`, `MOUNTAIN_CHIP_CLEAR`, the stone, ore, pine and pebble constants go. The ore section of `mountain-kit.py`, `ore.glb`, the `prop.ore` key, its fallback and theme mapping are removed. The `prop.peak` procedural fallback becomes a low hex-shaped mound with two back cones and the same clearing, so Medium/High without the GLB still keep play visible.

*Alternative*: keep `ore.glb` for later use. Rejected: unused assets are dead weight in the PWA cache.

### 4. Verifying "never hides"
The mask numbers (rim fade radii, clearing radii, robber offset, front cap angle, peak height) live in one file, `tools/blender/mountain-mask.json`, read by both `mountain-kit.py` and the client test. The script also exports the final mesh's height field as a small grid (`mountain-heights.json`, 33 × 33 per variant, test-only and not shipped). A unit test (`test/scene/mountainPeaks.test.ts`) ray-marches along the default camera direction (55° down, from +z) to the chip rim, the robber top (0.48) and the top of a city (0.37) on each corner of the hex and the two nearest corners of the hex behind it, and checks that the height grid never crosses those rays. The test needs no Blender.

## Risks / Trade-offs

- [The mask may flatten the model so much that it no longer looks like the supplied mountain] → peaks sit on the back half where the mask is 1; show the owner a preview render (hex, chip, robber, settlement on every corner) before wiring it in, and tune `PEAK_HEIGHT` and the yaw.
- [Tall back peaks may hide a piece on the far corners] → the rim fade guarantees zero height near the corners; the far corner piece is in front of the slope seen from the camera, so it is never behind the mountain. The unit test covers all six corners.
- [Back peaks of a front-row mountain hex may hide a piece on the hex behind it] → the rim fade ends at ρ = 0.85, but a 0.55-tall peak at ρ = 0.6 covers ground about 0.38 behind it, which can reach the back neighbour's front corner area. The test also checks the back neighbour's two nearest corners; lower `PEAK_HEIGHT` if it fails.
- [Decimation loses snow patch edges] → decimate with material delimit; check the preview.
- [The FBX is missing from a fresh checkout] → the script stops with a clear message naming `assets/mountain/Mountain Lowpoly.fbx`.

## Migration Plan

Rebuild `peak.glb`, delete `ore.glb`, update code, theme and tests, and ship. Rollback: restore the previous assets and `mountainPeaks.ts` from git.
