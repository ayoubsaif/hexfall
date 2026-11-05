## Why

Roads, settlements and cities are still drawn with the procedural box-and-cone fallbacks. The `diorama` theme maps no models yet. The owner has three downloaded, openly licensed STL piece models (`road.stl`, `settlement.stl`, `city.stl`). Using them gives the board real game pieces. The theme layer cannot load STL, though. The files are also in the wrong units and axes and are unindexed, and they sit in the git-ignored `assets/` reference folder, which must never ship. So they need a reproducible conversion path and a proper license record before the theme can use them.

## What Changes

- Move the three STL sources out of `assets/` into a committed, licensed source folder (`docs/art/sources/pieces/`), along with a record of their author, URL and license.
- Add a Node conversion tool (`tools/stl-to-glb.mjs`) that does four things:
  - reads each STL;
  - fixes the orientation, origin and scale to match the model coordinate contract (Y-up, base center at the origin, 1 unit = hex circumradius, sizes that match the current fallbacks);
  - welds vertices and computes creased normals;
  - writes a meshopt-compressed GLB into `apps/client/public/themes/diorama/models/`.
- Map `piece.road`, `piece.settlement` and `piece.city` in the `diorama` theme manifest to the generated GLBs. The robber stays procedural.
- Extend the theme manifest with an optional `credits` list (keys, title, author, URL, license) for third-party assets whose license requires attribution. Extend `tools/check-assets.mjs` to reject disallowed licenses and attribution licenses with missing credit fields.
- Show the active theme's credits in the client (a small "Credits" entry in the HUD).
- The STLs carry no materials, so each piece is tinted entirely in the owner's color. This is the existing behavior for a model without `PlayerColor`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `asset-theming`: the theme manifest gains an optional per-asset `credits` declaration. The licensing guard now allows attribution-required permissive licenses (e.g. CC-BY), but only when they are credited, and the client must show those credits. A new requirement covers a reproducible source-mesh conversion pipeline that produces contract-conforming, compressed piece GLBs.

## Impact

- **New files**: `tools/stl-to-glb.mjs` and its tests, `docs/art/sources/pieces/{road,settlement,city}.stl` plus `SOURCE.md`, and `apps/client/public/themes/diorama/models/{road,settlement,city}.glb`.
- **Modified**: `apps/client/public/themes/diorama/theme.json` (piece entries, credits, updated source text), `apps/client/src/theme/manifest.ts` (credits schema), `tools/check-assets.mjs` (license allowlist and credits validation), and the HUD (credits entry).
- **Dependencies (dev only)**: `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`, `meshoptimizer`. Runtime decoding uses the meshopt decoder that drei's `useGLTF` already bundles, so no CDN is needed.
- **No changes**: the rules engine, server and protocol. Scene code still requests pieces by key only.
- **Open item**: the exact author, URL and license of the downloaded STLs must come from the owner before the GLBs are committed. Non-commercial or no-derivatives licenses are blocked pending an owner decision.
