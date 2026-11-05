## Context

- See proposal.md "Why". The theme layer (`apps/client/src/theme/Asset.tsx`) already loads GLB models for model keys through drei's `useGLTF`. It clones each model per player and tints it: without a `PlayerColor` material, the whole piece is tinted. While a model loads, or if it fails, the procedural fallback renders instead. `Pieces.tsx` requests pieces only by key, in both the Flat and the 3D board styles. No scene code needs to change.
- The three sources are binary STLs exported by Autodesk ATF (Fusion/Inventor). They are in millimetres, unindexed, carry no materials and are offset far from the origin. Measured bounds:

  | file | triangles | X extent | Y extent | Z extent |
  |---|---|---|---|---|
  | road.stl | 3 966 | 23.55 | 8.95 | 8.68 |
  | settlement.stl | 9 092 | 12.99 | 15.69 | 11.64 |
  | city.stl | 9 844 | 12.98 | 23.29 | 17.12 |

  Proportions suggest Y is already up (the settlement and city are tallest on Y, and the road is long on X). This still has to be confirmed visually: see the "Up axis is wrong" risk below.
- Procedural fallback sizes, which set the swap-without-moving target: road 0.72 × 0.10 × 0.11 along X, settlement footprint 0.20 × 0.18, city footprint about 0.36 × 0.22.
- `assets/` is git-ignored reference material. `tools/check-assets.mjs` fails on any theme reference into it. The open `board-topology` change modifies the "Theme manifest" requirement of `asset-theming`. This change only adds requirements and modifies "Licensing guard", so the two deltas don't collide at archive time.

## Goals / Non-Goals

**Goals:**
- An offline, deterministic STL → GLB build step that is committed alongside its sources.
- Generated GLBs that need no runtime overrides: they follow the model contract out of the box.
- License data that can be checked by machine, and visible in-app attribution.

**Non-Goals:**
- Loading STL at runtime (no `STLLoader` in the client bundle).
- A robber model, or any change to tile, token or harbor art.
- Authoring a `PlayerColor`/neutral material split. The STLs have one surface, so full-piece tinting is correct.
- Decimating the meshes. They fit the budget compressed (see Decisions); decimate only if the check warns.

## Decisions

1. **Convert offline, commit the GLBs.** `tools/stl-to-glb.mjs` runs on demand (`pnpm run models:pieces`) rather than inside the Vite build.
   - *Why*: it keeps the runtime path unchanged (GLB via `useGLTF`). The build stays free of the new devDependencies' native/WASM steps, and `check-assets` keeps validating plain committed files.
   - *Alternative*: a Vite plugin that converts on build. Rejected, because it adds build-time coupling for three files that rarely change.

2. **Sources move to `docs/art/sources/pieces/`**, next to a `SOURCE.md` that records the title, author, URL, license and download date of each file.
   - *Why*: the licensing guard forbids shipping anything from `assets/`, and that folder is git-ignored, so conversions there would not be reproducible. `docs/` is not scanned for asset references and is not part of the client build.
   - The originals in `assets/` stay where they are. Deleting them is the owner's call.

3. **Pipeline (pure Node, ESM, run with `node`):**
   1. Parse the binary STL directly (header, triangle count, then 50-byte records). The format is trivial, so this avoids pulling `three` into the tool. Reject ASCII STL and truncated files with a clear error.
   2. Weld coincident vertices (quantized at 1e-5 of the bounding-box diagonal) into indexed geometry.
   3. Compute creased normals: split vertices where adjacent face normals differ by more than 40°. Flat CAD faces stay crisp, and curved fillets stay smooth.
   4. Apply the orientation from a per-piece config (`upAxis`, `yawDeg`). The default is Y-up with yaw 0, pending visual confirmation.
   5. Normalize: translate so the bounding box is centered on X/Z and its min Y is 0. Then apply one uniform scale per piece: road X extent → 0.72; settlement and city longest horizontal side → the fallback's (0.20 and 0.36).
   6. Write the GLB with `@gltf-transform/core`: one mesh, one node, and one unnamed `MeshStandardMaterial`-compatible PBR material (roughness 0.6, metalness 0). Then run `@gltf-transform/functions` `meshopt()` with the `meshoptimizer` encoder, through `EXT_meshopt_compression` with `KHR_mesh_quantization`.

   - *Why meshopt over Draco*: drei's `useGLTF` bundles the meshopt decoder, so nothing is fetched at runtime. Draco would load its decoder from a CDN by default, which breaks offline/LAN play.
   - Rough size: about 10k triangles, welded to about 5k vertices and quantized, should come to tens of KB. The 300 KB budget only needs decimation (`simplify`) if the check warns.

4. **Uniform scale per piece, not one shared scale.** If the three pieces shared one scale with the road at 0.72 long, the settlement would be about 0.40 wide, double the fallback, and crowd the intersections. Per-piece scale meets the swap-without-moving contract.
   - *Trade-off*: the relative sizes of the original printed set are not kept exactly.

5. **Determinism**: no timestamps or generator version strings in the asset block, stable ordering, and pinned dependency versions. A test converts twice and compares the bytes.

6. **Manifest `credits`**: an optional array of `{ keys: AssetKey[], title, author, url, license }`, validated by zod in `manifest.ts`. `check-assets.mjs` gets the rules the spec requires:
   - an allowlist of licenses;
   - rejection of `-NC` and `-ND` licenses;
   - credit keys must be mapped;
   - attribution licenses need full coverage.

   An invalid `credits` list makes the manifest invalid at runtime, the same as any other structural error (existing "Manifest validation" behavior).

7. **Credits UI**: a small "Credits" button on the start screen and in the HUD menu area. It opens a dialog (reusing `Dialogs.tsx` styling) that reads `credits`, `license` and `source` from the resolved theme context. Links open with `rel="noopener noreferrer"` and `target="_blank"`.

## Risks / Trade-offs

- **Up axis is wrong (the STLs are Z-up).** → The per-piece `upAxis`/`yawDeg` config exists for exactly this. A task renders all three in the client and checks them against the fallbacks before the GLBs are committed.
- **The scaled road is chunky.** At 0.72 long, the road's cross-section becomes about 0.27, versus 0.10 for the fallback, so it may look taller than the settlements. → Visual check task. If it's too heavy, the config allows an optional per-piece `crossScale` (Y/Z only) for the road. The spec only constrains its length and contract.
- **The STL license turns out to be NC or ND, or has no clear license.** → `check-assets` fails. The owner must decide (pick other models or get permission) before the GLBs ship. The converter and credits work are still useful either way.
- **Mesh normals or holes from the CAD export cause shading seams.** → Creased normals plus `side: FrontSide`. If the faces are inverted, the tool flips the winding order when the signed volume is negative.
- **New devDependencies** (`@gltf-transform/*`, `meshoptimizer` is already in the lockfile transitively). → They are dev-only and never imported by client or server code.

## Migration Plan

This is an additive change. Rollback means removing the three `piece.*` entries and the credits from `theme.json`, and the pieces fall back to the procedural ones automatically. Players see no protocol or state change.

## Open Questions

- The exact title, author, URL and license of each STL. The owner supplies these when the tasks are applied, and they only fill in data fields. If the license is NC or ND, the risk above applies.

## Implementation Notes

- Visual check (2026-11-04): all three STLs turned out to be **Z-up**, so `upAxis: "z"` is set for every piece.
- Owner request (2026-11-04): settlements and cities were too small next to the roads. Their footprints are now 1.5x the fallback (settlement 0.30, city 0.50; the city's 0.54 was rounded down so it doesn't crowd the roads). This replaces the "within 10 % of fallback" rule in Decision 4 and the spec.
- The full-thickness road (an arched bridge) stood as tall as a city. The owner chose `crossScale: 0.5`.
- Attribution comes from the owner: Burgers, https://www.printables.com/@Burgers, CC-BY-4.0. The credit links to the author's profile because no per-model URL was given.
- `tools/` became the workspace package `@hexfall/tools`, because the client's lint rules ban `node:*` imports in tests.
- `check-assets` reference-name heuristic narrowed (distinctive stems only). Before this, `assets/settlement.stl` flagged every file mentioning "settlement".
