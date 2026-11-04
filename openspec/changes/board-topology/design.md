## Context

- `packages/engine` holds only the seeded RNG (`rng.ts`) and an empty `geometry.ts`. `geometry.ts` is the one engine subpath the client may import at runtime; the root is allowed only for `import type` (scaffold design decision 2, lint override in root `vite.config.ts`).
- The client's `Scene.tsx` is a debug scene. It has 7 land hexes, a sea ring with demo harbors and demo pieces, and its own `hexToWorld`. The pointy-top convention is 1 unit = circumradius, with corner 0 at +Z. +Z points toward the camera, so row 1 is at −Z (the top of the screen).
- The theme layer (`apps/client/src/theme/*`) resolves every key to a GLB (`useGLTF`) or a 3D procedural fallback. `manifest.ts` accepts only `model: *.glb`. `tools/check-assets.mjs` checks GLBs only (existence, orphans, budget, `assets/` guard).
- The rules source is the user's AGENTS.md text. It is not in the repo. It was recovered from the earlier planning session's transcript.

## Goals / Non-Goals

**Goals:**
- One canonical board graph, computed in the engine and shared by the engine, server and client. Ids are stable across runs and platforms.
- Boards are plain JSON, cheap to send and store, and replayable from the RNG state.
- Flat painted board rendering that swaps cleanly between procedural colors and themed images.
- A file ownership split that lets three agents work in parallel.

**Non-Goals:**
- Placement legality, the setup phase, production or any game reducer (`rules-engine`).
- Sending boards over the protocol or storing them in Redis (`game-server`).
- Picking or highlighting intersections and paths (`client-3d`).
- Themed GLB piece models.

## Decisions

### 1. Integer vertex lattice for exact ids

Hex (q, r) has its center at lattice point `(X, Z) = (2q + r, 3r)`. The units are `√3/2` on x and `1/2` on z. Corner i, for i = 0..5 (corner 0 at +Z, going counter-clockwise in the math sense), is at offset `(0,2) (1,1) (1,−1) (0,−2) (−1,−1) (−1,1)`. Every intersection is therefore an exact integer pair. Intersections are deduplicated by the key `"X,Z"`, and a path is the sorted pair of its end keys. There is no float comparison anywhere.
- Hex ids: sorted by (r, q).
- Intersection ids: sorted by (Z, X) of their lattice point.
- Path ids: sorted by (Z₁+Z₂, X₁+X₂) of the midpoint.

All three are reading order. Hex side i runs from corner i to corner i+1.
- *Alternative*: ids from float world positions with rounding. Rejected because it is fragile, and the lattice is just as short.
- *Alternative*: string ids like `"v:3,-6"`. Rejected because small integers make compact JSON and index arrays directly.

World positions are `x = X·√3/2` and `z = Z/2`. This matches the existing `hexToWorld` and the fallback prism's corner order.

### 2. Topology is a frozen constant, built once

`topology.ts` builds `TOPOLOGY` at module load (pure computation, deep-frozen):

```ts
type HexId = number; type VertexId = number; type EdgeId = number;
interface HexInfo    { id: HexId; q: number; r: number; vertices: readonly VertexId[]; edges: readonly EdgeId[] } // 6 each, corner/side order
interface VertexInfo { id: VertexId; hexes: readonly HexId[]; edges: readonly EdgeId[]; neighbors: readonly VertexId[]; coastal: boolean; harborSlot: number | null }
interface EdgeInfo   { id: EdgeId; vertices: readonly [VertexId, VertexId]; hexes: readonly HexId[]; coastal: boolean }
interface Topology {
  hexes: readonly HexInfo[]; vertices: readonly VertexInfo[]; edges: readonly EdgeInfo[];
  coastalEdges: readonly EdgeId[];   // 30, clockwise from hex 0's upper-left side
  harborSlots: readonly EdgeId[];    // 9, coastal positions 0,3,6,10,13,16,20,23,26
  cornerHexes: readonly HexId[];     // 6 ring-2 corners, in counter-clockwise direction order
  seaRing: readonly { q: number; r: number }[]; // 18 ring-3 cells, for rendering only
}
```

World helpers: `hexToWorld(q, r)`, `hexCenter(id)`, `vertexPosition(id)`, `edgeMidpoint(id) → { x, z, angle }`, `edgeOutward(id) → [x, z]` (unit vector away from its only hex; coastal paths only).

The clockwise coastal order is built from the lattice by walking the coastline. Start at the side between corners 3 and 4 of hex 0, which is its upper-left side (corner 3 is the top corner). Then repeatedly take the next coastal path that shares the current end intersection. Walking from corner 4 to corner 3, then onward to corner 2, goes clockwise on screen. This was checked with a throwaway script: 54/72/30/30 counts, 9 slots with 18 distinct end intersections, and slots 0–2 on hexes 0–2, slot 3 on (2,0) and so on around the island.

*Why fixed slot positions 0,3,6,10,13,16,20,23,26 (gaps 3,3,4 repeating)?* AGENTS.md gives the harbor *order* but not the slot geometry, and Illustration A is not available. The repeating 3/3/4 gap is threefold symmetric (30 coastal paths = 3 × 10). It gives every harbor 2 intersections that no other harbor uses, and it spreads the harbors evenly. This is recorded as Hexfall's own frame, not a copy of any printed frame.

### 3. Board data shape

```ts
type Terrain = "forest" | "pasture" | "fields" | "hills" | "mountains" | "desert";
type Resource = "brick" | "grain" | "lumber" | "ore" | "wool";
type HarborType = "generic" | Resource;
interface Board {
  hexes: readonly { terrain: Terrain; token: number | null }[]; // index = HexId, length 19
  harbors: readonly HarborType[];                                // index = harbor slot, length 9
  robber: HexId;
}
```

The board holds only what varies between games. Everything derivable (adjacency, coastal paths, slot paths) stays in `TOPOLOGY`, so a board is about 1 KB of JSON. `Terrain → Resource` is a small exported map (`TERRAIN_RESOURCE`, where desert maps to null).

### 4. Module and export split

| File | Exports | Imported by |
|---|---|---|
| `src/topology.ts` | `TOPOLOGY`, id types, world helpers | geometry, board |
| `src/board.ts` | `Terrain`, `Resource`, `HarborType`, `Board`, `TERRAIN_RESOURCE`, `beginnerBoard()`, `createVariableBoard(rng)` | index; geometry re-exports the types and `beginnerBoard` |
| `src/geometry.ts` | re-exports `topology.ts`, the board types, `TERRAIN_RESOURCE` and `beginnerBoard` | client (runtime) |
| `src/index.ts` | everything above, plus `createVariableBoard` | server, tests |

`beginnerBoard()` is fixed data with no randomness, so it may go through the client-visible subpath. That lets the client show the preview without an engine runtime import. `createVariableBoard` stays root-only because generation is a server concern.

### 5. Variable generation, step by step

```
[terrains, s1] = shuffle(rng, TERRAIN_BAG)      // 4F 4P 4Fi 3H 3M 1D, fixed bag order
[harbors,  s2] = shuffle(s1,  HARBOR_BAG)       // 4 generic + brick grain lumber ore wool
[k,        s3] = nextInt(s2, 6)                 // start corner direction
spiral = ring(2, k) ++ ring(1, k) ++ [center]   // ring(rad,k): start at rad*D[k], then step D[(k+2+side)%6] rad times per side
assign LETTER_VALUES in order to spiral hexes, skipping the desert
robber = desert hex; return [board, s3]
```

`D = [(1,0),(1,−1),(0,−1),(−1,0),(−1,1),(0,1)]` lists the axial directions in counter-clockwise screen order. `ring(2,k)` walks counter-clockwise around the coast from the corner `2·D[k]`. `ring(1,k)` starts at `D[k]`, which is adjacent to both the start corner and the 12th outer hex. This was verified for all 6 values of k: each spiral visits all 19 hexes once.

The fixed bag orders and draw order are part of the replay contract. Changing them changes every seeded board, so tests pin a known seed's output as a snapshot.

### 6. Asset kinds and manifest entries

`keys.ts` gains `ASSET_KIND: Record<AssetKey, "flat" | "model">` and `assetKind(key)`. `manifest.ts` validates each known key's entry against its kind:
- **flat** → `{ image: <relative .png|.webp|.jpg|.jpeg> }`, strict, so overrides are rejected.
- **model** → today's `{ model: <.glb>, scale?, rotation?, offset? }`.

A mismatch fails the whole manifest, which matches today's behavior for an invalid entry. `ResolvedEntry` becomes a tagged union `{ kind: "image", url } | { kind: "model", url, transform? }`. `resolveAsset` returns `{ kind: "fallback" } | { kind: "image", url } | { kind: "model", url, transform }`.

*Alternative*: one `file` field, with the extension deciding the kind. Rejected because explicit field names make wrong-kind entries obvious in review and in error messages.

### 7. Flat rendering

`<Asset>` dispatches by kind. Flat keys render `<FlatAsset>`: a fixed flat geometry per key plus a material. The material's `map` is the themed texture (drei `useTexture`, inside the same Suspense and error-boundary pattern used for models), or none for the procedural color.
- **Hex geometry**: `new CircleGeometry(1, 6, Math.PI / 2)`, rotated −90° about X. The `Math.PI / 2` start angle puts corners at ±Z (pointy-top). CircleGeometry's built-in UVs are already `u = 0.5 + x/2` and `v = 0.5 − z/2` after the rotation, so a square image maps exactly per the coordinate contract with no custom UV code. The texture uses `SRGBColorSpace` and max anisotropy.
- **Layering**: tiles and sea at y = 0, harbor links at y = 0.002, harbor badges and token discs at y = 0.004, labels at y = 0.006. It also uses `polygonOffset` on overlay materials. This avoids z-fighting without visible thickness.
- **Fallbacks** (`fallbacks/tiles.tsx`, `token.tsx`, `harbors.tsx`) are rewritten as flat shapes with distinct colors. The 3D props are deleted. `common.tsx` keeps what pieces still use.
- **Lighting**: flat tiles use `MeshStandardMaterial` with roughness 1, so painted art is not washed out. 3D pieces cast shadows onto the tiles, which receive them.

### 8. Board view composition (`apps/client/src/scene/`)

- `BoardView({ board })`:
  - maps `TOPOLOGY.hexes` to `<Asset key=tile.*>` at `hexCenter(id)`;
  - maps `seaRing` to `<Asset key="sea">`;
  - draws a `<NumberToken value>` per token hex;
  - draws a `<HarborMarker slot type>` per slot;
  - draws `<Asset key="piece.robber">` at the robber hex, offset by (−0.45, +0.3) when that hex has a token.
- `NumberToken`: the `token` flat asset, then a label quad on top. The label is a `CanvasTexture` drawn once per value (10 cached textures). It shows the number in a bold system serif and `6 − |7 − n|` pips, in red `#c0392b` for 6 and 8 and dark ink otherwise. Canvas text avoids fetching a font file at runtime (drei `Text` would load one).
- `HarborMarker`:
  - Badge center: `edgeMidpoint + edgeOutward × 0.55`.
  - The `harbor.<type>` flat asset is a rounded badge.
  - A canvas label shows "3:1", or "2:1" plus the resource name.
  - Two thin flat link strips run from the badge to `vertexPosition` of the slot's two intersections.
- `useFitCamera`: on resize, places the camera so that a circle of radius 6.3 (sea ring plus badges) fits the smaller view dimension at fov 45. OrbitControls limits: `maxPolarAngle = π/2.2` and min/max distance around the fit distance.
- `Scene.tsx` becomes lighting, background, `<BoardView board={previewBoard} />` and controls. The preview board is `beginnerBoard()` from `@hexfall/engine/geometry`. `PLAYER_COLORS` and the demo pieces are removed. Per-player tint stays covered by the existing theme unit tests.

### 9. Asset check extension (`tools/check-assets.mjs`)

- Read `ASSET_KIND` alongside `ASSET_KEYS` from `keys.ts`.
- For each entry, take `image` or `model` by kind. Fail on a missing file, a path escaping the theme folder, an `assets/` reference or a kind mismatch.
- Warn when an image is over 400 KB.
- Orphan detection covers both model extensions and `.png/.webp/.jpg/.jpeg`.

### 10. Painted tile art pipeline

1. **Cost approval.** The lead agent asks the user to approve the cost before generating anything. Generation uses an attached image tool (e.g. Creative Claw `generate_image`) with **text prompts only**: no `image_urls`, no reference images, nothing from `assets/`.
2. **Prompts.** All prompts share one style line: "original hand-painted gouache illustration, strict top-down orthographic view, square, soft light from upper left, muted natural palette, no text, no borders, no frame, no hexagon outline, edges continue naturally". Each terrain prompt describes its own content (e.g. forest: dense conifer canopy with clearings; pasture: rolling meadow with scattered sheep seen from above; and so on). Sea is a calm water texture.
3. **Review.** About two candidates per key are shown to the user in a review page. Only approved images go further. Rejected ones get a revised prompt.
4. **Encoding.** Approved images are downscaled to 1024×1024 and encoded as WebP of 400 KB or less, using a local tool run on demand (`npx sharp-cli`, `cwebp` or `ffmpeg`). None of these is a project dependency.
5. **Commit.** Files go in `apps/client/public/themes/diorama/tiles/<key>.webp`. The manifest `source` is updated to say "original, AI-generated from text prompts for Hexfall, no image inputs, approved by the project owner", with license `CC0-1.0`.

Until approval, the theme maps nothing and flat colors render. Nothing blocks on art.

*Why keep theme id `diorama`?* Renaming the default theme is churn with no user-visible benefit. The id is just a folder name.

### 11. Parallel implementation split

The lead agent first writes the contracts that other agents compile against:
- `packages/engine/src/board.ts` types and the signatures in decision 2/4, as stubs that throw;
- `ASSET_KIND` in `keys.ts`;
- `AGENTS.md`.

Then three background agents work in parallel with disjoint file ownership:

| Agent | Owns |
|---|---|
| engine | `packages/engine/src/{topology,board,geometry,index}.ts`, `packages/engine/test/**` |
| theme | `apps/client/src/theme/**` (except `keys.ts` kinds, already set), `apps/client/test/theme/**`, `tools/check-assets.mjs` |
| board-view | `apps/client/src/scene/**`, `apps/client/test/scene/**`, `apps/client/src/App.tsx` |

The board-view agent codes against the stub signatures and the `<Asset>` contract (its props are unchanged). The lead agent runs the art pipeline with the user in the meantime, then integrates, runs `pnpm run check|test|build` and does a visual check in Chrome.

## Risks / Trade-offs

- [The harbor slot geometry is our own, and it may differ from the printed beginner frame] → It is documented as Hexfall's frame (decision 2). The harbor *order* matches AGENTS.md. Slot positions are one constant, so they are easy to change if the user supplies the real positions later.
- [Changing the bag order or draw order silently changes all seeded boards] → A snapshot test pins one seed's board, and a comment marks the order as part of the replay contract.
- [Painted textures can show seams at hex borders] → The prompts ask for edges that continue naturally. A thin darker outline is drawn on every tile as part of the flat hex material, which also helps readability. Review catches bad candidates.
- [Generated art may look like existing game art] → Prompts never name the game or include image inputs. The user reviews each image, and anything that resembles the reference art is rejected.
- [Canvas-drawn labels look different across OS fonts] → They use a generic `serif`/`sans-serif` bold stack. Legibility, not exact typography, is the requirement.
- [Removing the 3D fallbacks for tiles and harbors loses work from the scaffold] → This is intended (flat-board decision). Git history keeps them.
- [Flat keys reject overrides, so a slightly off-center image can't be nudged] → The coordinate contract is simple (square, centered). Images are fixed at export time instead.

## Migration Plan

This is internal only, with no deployed users. Existing manifests with `{}` assets stay valid. A manifest mapping a flat key to `model` becomes invalid; none exist. Rollback is a git revert.
