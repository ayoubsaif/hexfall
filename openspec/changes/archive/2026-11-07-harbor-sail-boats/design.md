## Context

Today `HarborMarker` draws a stone pier (`HarborDock`) and a `HarborChip` on its deck. The chip registers with `BoardView`'s `useChipFacing` hook, which turns every chip toward the camera in pitch and yaw each frame (`faceChips` in `chipYaw.ts`). The chip's paper colour per type is `HARBOR_CHIP_BASE`; its rate texture is a cached canvas (`harborTexture`), and the resource icon comes from `/ui/resources/<type>.webp`.

Model assets go through the theme layer: `<Asset assetKey=…/>` renders the procedural fallback, or a `ThemedSlot` that loads the GLB with `useGLTF`, clones it with `instantiateModel`, and applies the manifest's per-asset `transform` (scale/rotation/offset). Fallbacks live in `theme/fallbacks`.

The supplied model (`docs/assets/cartoon_boat_toon.glb`, 159 KB, Blender export, Draco-compressed with WebP textures; the client serves the Draco decoder itself from `/draco/` so it loads offline) has one root node `Boat Hull` with 22 child nodes, among them `Boat Sail` (material "Boat Canvas", **no UVs**), `Boat Mast` at local x=0.25, z=0, `Boat Yard` (top and bottom), nine `Boat Lashing` rings, and `Boat Mast Cap`. It is Y-up, about 5.3 units long along X, 2.1 wide, 4.3 tall, keel at y=0. The sail spans z −1.31…1.31 and y 1.45…3.65, curved slightly along x 0.36…1.13, so its face points along ±X (a square sail across the hull). Wood uses one textured material; rope and canvas are plain colours.

## Goals / Non-Goals

**Goals:**
- One boat per harbor, resolved by the key `prop.boat`, with identical sail label and turn on the themed model and the fallback.
- Sail label painted on the sail itself (not a floating quad), readable from the default camera on desktop and phone.
- No per-frame allocation and no React re-render for the sail turn.

**Non-Goals:**
- Turning in pitch (the sail stays upright like a real sail); bobbing or other animation; per-harbor random boat yaw.
- Changing `HarborDock` or harbor placement maths.

## Decisions

1. **New model key `prop.boat`, not `harbor.boat`.** `harbor.*` keys are flat, square badge images in the contract, the kinds list and the fallbacks; adding a model under that prefix would need exceptions everywhere. A `prop.` prefix is a clean new model namespace. The six `harbor.*` flat keys stay as they are (still used by the flat fallback badges and the maritime panel); only the board stops drawing a chip.

2. **The scene finds the rig by node name after the asset mounts.** `HarborBoat` renders `<Asset assetKey="prop.boat" />` inside a group and, in a layout effect keyed on the mounted object, traverses the subtree for the first mesh whose name contains `sail` and the nodes whose names contain `mast`, `yard` or `sheet` (case-insensitive). This works for the GLB and for the fallback (which uses the same names), keeps file paths out of scene code, and needs no change to `Asset`. Alternative considered: a new theme hook returning the raw `Object3D`; rejected as a larger theme API change for one consumer. Because the themed model replaces the fallback when loading finishes, the search reruns when the subtree changes (a `ThemedSlot` swap notifies via a ref callback on the inner group's first child).

3. **Turning about the mast by rebuilding local matrices.** For the sail, mast, yard, sheets, lashings and mast cap, store each node's original local matrix once, set `matrixAutoUpdate = false`, and each frame set `matrix = T(pivot) · R_y(yaw) · R_z(tilt) · T(−pivot) · original`, where `pivot` is the mast's foot in the hull frame (fallback: the sail's bounding-box centre at its bottom). `tilt` leans the rig back by 40% of the camera's elevation, capped at 25°, so a high camera reads the label (added after review in the running client: a purely vertical sail was seen nearly edge-on from the default 55° camera). The mast leans too, hinged at its foot; leaning only the sail swung it back through the upright mast, which then cut across the label. This avoids reparenting nodes in a cloned GLB. The yaw is `cameraYaw(camera, sailWorldPosition, previous)` from `chipYaw.ts` (pure, already tested, keeps the last yaw when the camera is overhead), minus the boat's own world yaw, plus a fixed −π/2 because the sail's labelled face points along +X instead of the chip's +Z. All harbor boats register with one `useFrame` in `BoardView` (replacing their `chipRef` registration), with reused `Vector3`/`Matrix4` scratch objects. Alternative: billboarding the whole boat; rejected because the hull must keep its mooring orientation.

4. **Planar UVs generated for the sail.** A pure function `sailUVs(positions)` maps each vertex's (z, y) in the sail's local frame to [0,1]² from the geometry's bounding box (u along −z so the label reads left-to-right from the +X side, v along y). It is applied once per geometry (geometries are shared between clones, the attribute is identical, so it is idempotent: skip when `uv` already exists). The slight curve along x is ignored; at this curvature the distortion is invisible.

5. **One sail texture and material per harbor type.** A cached canvas texture per `HarborType` draws: the canvas cloth colour (generic) or the resource tint (today's `HARBOR_CHIP_BASE` values, renamed `HARBOR_SAIL_BASE`), the resource icon in the upper part, and the rate with the existing halo/ink style in the lower part. The icon image is drawn into the canvas once it decodes (texture `needsUpdate` then), so the label never waits on Suspense. The sail mesh gets a shared `MeshStandardMaterial` per type (`map` = that texture, `side: DoubleSide`, roughness 0.85 like "Boat Canvas"); the GLB's own canvas material is left untouched and is not disposed. Alternative: a `LabelQuad` floating in front of the sail; rejected because it would clip through the curved sail and look pasted on.

6. **Placement: boat beyond the pier's sea end, hull parallel to the coast.** The marker already computes the pier vector `(pierX, pierZ)`. The boat group sits 0.42 units past the pier end, so the hull floats in open water clear of the beach, at `y = seaLevel`, rotated so its X axis runs along the slot path (perpendicular to the pier). The diorama manifest's transform override scales the model to about 1.05 units long (scale 0.2, so the sail is about 0.53 × 0.44 units; 0.18 proved too small to read and 0.23 too large in the running client) and offsets it down slightly so the keel is under the waterline. The fallback is authored at the same final size, so there is no jump when the GLB arrives.

7. **Theme assets and licence.** Copy the GLB to `apps/client/public/themes/diorama/models/boat.glb` and map `prop.boat` with the transform override. The owner confirmed the model is their own work, so it falls under the manifest-level `CC0-1.0` declaration; update the manifest's `source` text to mention it. No credit entry. The file is ~150 KB, inside the 300 KB budget; if the budget check flags it as not compressed, that is a warning only.

8. **Framing.** `useFitCamera` frames a circle holding the sea ring and harbor badges at board height. Masts add height (~0.8 units above the sea). Include the boat top height in the framed bounds (raise the framed sphere/box top by the boat's height) so the 16:9 and 9:16 load views keep the sails in view.

9. **Dry hull: a depth-only lid.** The sea plane runs through the open hull (the keel sits under the waterline and waves rise above the floor). `hullMask.ts` adds an invisible lid to the hull mesh, just under its rim, shaped from the convex outline of the hull's top vertices pulled 6% inward. It writes depth but no colour and is drawn after the boat (`renderOrder` 1) and before the sea (`renderOrder` 2), so the hull's floor and thwarts show and the sea fails the depth test inside the hull. Alternative: raising the boat until the floor clears the highest wave; rejected because the hull would float visibly above the sea.

## Risks / Trade-offs

- [The sail reads smaller than the chip on phones] → Size the boat so the sail is at least as tall as the old chip's diameter on screen; label text uses the same font sizing rules as the chip; tune the scale in the manifest without code changes.
- [Sheets (ropes) end near the rails; turned 90° they hang off the hull] → They turn with the sail so they stay attached at the top; slight clipping at the rails is acceptable for a cartoon boat. If it looks bad, hide the sheets (one-line filter) instead.
- [Sail turning 90° sweeps across the rails and thwarts] → Sail bottom (y 1.45) is above the rails (max y 1.12), so it clears the hull at every angle.
- [Leaning mast looks like a heeling boat] → Capped at 25° and only 40% of the camera elevation; from the default camera it reads as a sail trimmed toward the viewer.
- [Shared geometry mutated by adding UVs] → Idempotent and identical for all clones; documented in the function.
- [Nine extra GLB clones and nine draw-call groups] → The model is small (23 meshes); acceptable. If profiling shows a cost on Low quality, merge static hull meshes later.
- [Custom-loaded model replaces fallback mid-frame] → The rig search reruns on the subtree change; until it runs, the sail shows unlabelled for at most one frame.

## Migration Plan

Client-only visual change; ships with a normal deploy. Rollback is a revert. Old saved games are unaffected (no state change). Offline caches pick up `boat.glb` through the existing `/themes/` stale-while-revalidate rule.
