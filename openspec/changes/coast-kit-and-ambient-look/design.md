## Context

See proposal.md for why. Current state:

- `scene/IslandGround.tsx` draws one island mesh for image themes; `scene/coastTerrain.ts` + `CoastTerrain.tsx` draw the beach slope (`beachHeight`, `BEACH_SLOPE_END` 0.75) and a few `IcosahedronGeometry` rocks textured with Poly Haven `rock_2` (CC0, `public/textures/coast/`). `scene/coastField.ts` `sampleCoast(land, x, z)` gives distance to land and the noisy shoreline; the `sea-shore` spec pins the beach width.
- `scene/HarborBoat.tsx`, `boatFloat.ts` place jetties and boats; `prop.jetty` / `prop.boat` are GLBs made in Blender (the jetty by script).
- `Scene.tsx` lights the board with one hemisphere light and one directional sun. `BoardCanvas.tsx` creates the R3F `<Canvas gl={{ alpha: true }}>`. Graphics tiers live in `graphicsQuality.ts` (`QUALITY.low|medium|high`).
- A Blender MCP server (`blender-mcp`) is configured for Claude Code but its tools only appear when Blender is running with the add-on connected.
- Asset keys and their kinds are in `theme/keys.ts`; every key needs a procedural fallback; `tools/check-assets.mjs` enforces budgets and licensing.

## Goals / Non-Goals

**Goals:**
- A rocky, vegetated coast close to the owner's reference images, built from a small reusable GLB kit.
- A warm, soft overall look via a cheap post-processing chain.
- No change to rules, picking, board framing or the `sea-shore` beach-width contract.

**Non-Goals:**
- Changing hex tile art, pieces, the water shader or the HUD.
- Buildings, people, flags or paths on the land (the reference villages are the players' pieces).
- Baking the whole coast into one static mesh.
- Tilt-shift, bloom or depth of field.

## Decisions

### 1. Procedural coast + Blender kit, not a baked coast
The island outline follows the board layout and the noisy shoreline from `sampleCoast`. A baked coast would fight that and duplicate the beach. Blender builds only reusable pieces; code places them. *Alternative:* sculpt one coast GLB (rejected: fixed shape, large file, breaks if the layout or beach tuning changes).

### 2. Kit contents and format
One GLB per key in `themes/diorama/models/`: `boulder.glb` (5 variants), `cliff.glb` (3 tall chunks), `wall.glb` (1 straight dry-stone segment + 1 end cap), `tree.glb` (2 pine variants), `bush.glb` (3 variants, includes grass tufts). Variants are root-level child meshes named `variant_0..n`; code picks a variant per instance. Low-poly (≤ 1.5k tris per variant), painterly flat-ish shading, Draco or meshopt compressed, ≤ 300 KB each (asset budget). Models obey the existing model coordinate contract (origin at base centre, +Y up, unit = board unit). The existing coast rocks, jetty and boat are imported into Blender first as the scale and style reference, so the kit matches them. Blender source `.blend` files and the generator script live in `tools/blender/` (outside the client build).

Blender work goes through the Blender MCP tools (create/modify objects, apply materials, export GLB). Each modelling step is also saved as a Python script in `tools/blender/coast-kit.py` so the kit can be rebuilt without the MCP, like the jetty.

### 3. Materials and textures
Rocks: a mossy-rock CC0 PBR material (albedo, normal, roughness) plus a world-up moss blend in the shader (`dot(normal, up)`), so all rock variants share one material and one set of maps. Trees/bushes: vertex colors, no textures. Beach: the existing sand shader gains a grass band near the land side (blend by `sampleCoast` distance with noise), using a CC0 grass texture; sand switches to a CC0 beach-sand set if it reads better than `water/sand.webp`.

Textures are downloaded by the owner (no downloads without asking). The tasks list exact candidate assets (Poly Haven `aerial_grass_rock`, `rock_boulder_dry` / `mossy_rock`, `coast_sand_01`, or ambientCG equivalents), 1K JPG/PNG. A local script converts them to 512 px WebP in `public/textures/coast/` and `SOURCE.json` records name, author, URL and CC0 license, as today. Missing maps fall back to plain colors (spec "Shore surfaces").

### 4. Placement algorithm
A pure function `coastScatter(layout, harbors, seed)` in `scene/coastScatter.ts` returns instance lists `{ key, variant, x, z, yaw, scale }`:
1. Walk the shoreline polyline from `sampleCoast` at fixed arc steps; place boulders/cliffs with a blue-noise jitter from a hash of the arc position (no `Math.random`). Larger cliffs on stretches where the beach is narrowest, small boulders into the shallows.
2. Fill the rim band (outer hex edge + margin → waterline) with bushes, tufts and trees using a Poisson-disk sampler seeded by a fixed constant.
3. Lay wall segments along 2–3 longest harbor-free rim stretches, chained end to end.
4. Reject any instance inside the clear zones: land hexes, a radius around every board intersection and path midpoint (settlement/city/road footprint + margin), each jetty footprint, and the jetty→boat lane (`boatFloat` gives the boat position).
5. Y comes from `beachHeight(sampleCoast(...).shore)` (or seabed depth), so props rest on the surface.

Rendering uses one `InstancedMesh` per key+variant, cast/receive shadows on Medium/High. The old icosahedron rocks are replaced; their fallback becomes the procedural fallback for `prop.boulder`.

### 5. Post-processing with three.js's own passes
No new dependency: `three/examples/jsm/postprocessing` (`EffectComposer`, `RenderPass`, `GTAOPass`, `ShaderPass`, `OutputPass`) inside a `<PostFx>` component that takes over rendering with `useFrame(..., 1)`. Chain: Render → GTAO (Medium/High only, half resolution on Medium) → Grade+Vignette `ShaderPass` (one custom shader: lift/gamma/gain with warm highlights and teal shadows, saturation, smooth radial vignette) → Output (tone mapping + sRGB). When filters are off, `<PostFx>` is not mounted and R3F renders normally. *Alternative:* `@react-three/postprocessing` (rejected: new dependency; the pmndrs effects are nicer but not needed for three passes).

Lighting retune in `Scene.tsx`: lower, warmer sun (golden hour, ~35° elevation, `#ffd9a0`), cooler hemisphere ground, slightly stronger shadows, so the grade has something to work with.

### 6. Preference
`prefs.screenFilters: boolean` (default `true`), validated like `graphicsQuality`, switch in `GraphicsSection.tsx`, i18n keys in en and es.

### 7. Forest hexes: grass ground + 3D evergreens (Medium/High)
`IslandGround.tsx` gives every terrain its own texture slot. On Medium/High it binds the CC0 grass map (`aerial_grass_rock`, tinted slightly darker) to the forest slot instead of `tiles/forest.webp`, so the hex keeps its sand-strip border and dome. A pure `forestTrees(board)` in `scene/forestTrees.ts` places 5–9 trees per forest hex: Poisson-disk points in the ring between the chip radius (0.34) and 0.72 from the centre, rejecting the robber spot (`ROBBER_TOKEN_OFFSET`, radius 0.2), every hex corner (`VERTEX_CLEAR`) and edge (`PATH_CLEAR`), seeded by a hash of the hex id (not the game RNG), so it is identical for all players. Trees render through the same `CoastProps` instancing as the coast (`prop.tree`), with raycast disabled. Low quality keeps the painted forest and mounts no trees. *Alternative:* trees on top of the painted art (rejected by the owner: the painted trees and 3D trees would clash).

### 8. The BlendKit Thuja as `prop.tree`
The owner downloads "Thuja Occidentalis Lowpoly" (BlendKit, Alexander Novgorodtsev, Royalty Free) with the BlendKit add-on and saves its `.blend` to `assets/blendkit/thuja.blend` (git-ignored, never shipped). `tools/blender/thuja-reduce.py` opens it, joins the meshes, rebuilds the crown as a low-poly shell (Decimate collapse to about 1,500 triangles, plus a remesh of the leaf cards when they decimate badly), bakes the leaf colour into two flat materials (`Pine`, `PineLight`) and the trunk (`Bark`), scales it to 0.24 high (under a city's 0.368), and exports two variants (as-is and a squatter, rotated copy) as `models/tree.glb`, Draco, at most 300 KB. Until the download arrives, `tree.glb` is the original clump-crown evergreen from `coast-kit.py`. `check-assets.mjs` allows `LicenseRef-BlendKit-RF`, and `theme.json` gets a credit for `prop.tree` (title, author, BlendKit URL, license), which also shows in the in-game Credits.

## Risks / Trade-offs

- [Canvas is `alpha: true`; composer render targets drop alpha] → the sea covers the full frame, so use an opaque target and confirm the page background never shows through; test on the start screen preview.
- [GTAO cost on mid-range mobiles] → off on Low; Medium uses half resolution; the existing `QualitySampler` still steps tiers down.
- [Grade shifts player colors] → contrast test renders a fixed palette through the grade shader math (pure JS port of the curve) and checks pairwise distance.
- [Props hiding pieces or chips] → clear-zone rejection is unit tested against every intersection, path and jetty; tree height capped below a city.
- [Blender MCP not connected at apply time] → the apply step asks the owner to start Blender with the add-on; the saved `coast-kit.py` lets the kit be rebuilt headless with `blender -b -P`.
- [Texture licensing] → only CC0 sources; `SOURCE.json` per texture; `check-assets` licensing guard unchanged.
- [Draw calls] → instancing keeps it to ~15 extra draw calls.
- [The BlendKit leaf cards may decimate into a blob] → rebuild the crown from the decimated shell plus clump spheres sampled on it; compare a render with the original before shipping.
- [BlendKit license scope] → the model ships only as a reduced, embedded game asset with a credit; the source `.blend` stays in git-ignored `assets/`.
- [Forest readability without the painted art] → grass tinted darker than pasture, plus the trees themselves; contrast is checked at the default camera (spec "Forest still recognisable").

## Migration Plan

Purely additive visuals. Themes without the new keys get procedural fallbacks (simple rocks, cone trees). Rollback: turn Screen filters off, or revert the theme manifest entries.
