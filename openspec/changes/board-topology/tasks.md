## 1. Shared contracts (lead)

- [x] 1.1 Restore the user's rules text as `AGENTS.md` at the repo root. Keep the rules only, from "# AGENTS.md — Catan Base Game App" to the end of §14, without session preamble. Verify that the file has sections §1–§14 and that `node tools/check-assets.mjs` still passes.
- [x] 1.2 Add `packages/engine/src/topology.ts` and `board.ts` holding the exported types and function signatures from design decisions 2–4, as stubs that throw "not implemented". Wire the re-exports in `geometry.ts` and `index.ts`. Verify that `pnpm run check` passes.
- [x] 1.3 Add `ASSET_KIND` / `assetKind()` to `apps/client/src/theme/keys.ts` (14 flat keys, 4 model keys). Verify with a unit test in `apps/client/test/theme/` that every key has exactly one kind.

## 2. Engine topology (engine agent)

- [x] 2.1 Implement the integer-lattice builder in `topology.ts` (design decision 1): hexes, intersections and paths with reading-order ids; hex corner and side order; intersection hexes, paths and neighbors; path ends and hexes. Verify the counts 19/54/72, the reading-order hex ids (0, 2, 9, 18), that center-hex intersections have degree 3, and that relations are symmetric.
- [x] 2.2 Implement coastal flags, the clockwise `coastalEdges` walk starting at hex 0's upper-left side, `harborSlots` at positions 0,3,6,10,13,16,20,23,26 with `VertexInfo.harborSlot`, `cornerHexes` and `seaRing`. Verify 30 coastal paths and 30 coastal intersections, that the coastal order is a single loop, that the 9 slots have 18 distinct intersections, that each slot intersection's lookup returns its slot, and that there are 18 sea cells adjacent to the island.
- [x] 2.3 Implement the world helpers (`hexToWorld`, `hexCenter`, `vertexPosition`, `edgeMidpoint`, `edgeOutward`) and deep-freeze `TOPOLOGY`. Verify that shared corners coincide across all three hexes, that midpoints are halfway between path ends, that outward vectors point away from the path's hex, and that mutating `TOPOLOGY` throws.
- [x] 2.4 Implement `beginnerBoard()` from the AGENTS.md §4a table and harbor order. Verify the full table, the harbor order generic/grain/ore/generic/wool/generic/generic/brick/lumber, robber = 9, a JSON round-trip, and that two calls are deep-equal.
- [x] 2.5 Implement `createVariableBoard(rng)` (design decision 5): terrain shuffle, then harbor shuffle, then corner pick, then the A–R spiral skipping the desert. Verify:
  - same seed gives deep-equal boards and RNG states;
  - 20 seeds give at least 2 layouts;
  - component counts hold for 200 seeds;
  - the robber is on the desert;
  - the spiral A/B scenario holds;
  - the desert-skip scenario holds;
  - a snapshot of one pinned seed's board matches.
- [x] 2.6 Verify the engine stays pure: `node tools/check-engine.mjs` passes and engine tests pass with `vp test run` in `packages/engine`.

## 3. Theme layer for flat assets (theme agent)

- [x] 3.1 Extend `manifest.ts`:
  - flat entries `{ image }` (.png/.webp/.jpg/.jpeg, strict, no overrides);
  - model entries unchanged;
  - a kind mismatch or overrides on a flat key invalidate the manifest;
  - `ResolvedEntry` becomes a tagged union.

  Verify with manifest tests for a valid image entry, a GLB on a flat key, an image on a model key, an override on a flat key, and the existing cases still passing.
- [x] 3.2 Update `resolve.ts` to return `fallback | image | model`, and make load-failure messages name the key, the theme and the image or model. Verify with resolve tests.
- [x] 3.3 Add `FlatAsset` and dispatch by kind in `Asset.tsx`: a pointy-top `CircleGeometry(1, 6, π/2)` hex for tiles and sea, disc and badge shapes for token and harbors, the `useTexture` map with Suspense, an error boundary with a single warning per URL, and sRGB textures. Verify with a test that a failing image URL renders the fallback and warns once, naming the key and theme.
- [x] 3.4 Rewrite `fallbacks/tiles.tsx`, `token.tsx` and `harbors.tsx` as flat shapes with distinct colors and no 3D props, and remove unused helpers from `common.tsx`. Verify with a test that the six terrain fallback colors and the six harbor fallback colors are pairwise distinct.
- [x] 3.5 Extend `tools/check-assets.mjs` (design decision 9):
  - kind-aware `image`/`model` entries;
  - images warn above 400 KB;
  - orphan checks include image files;
  - kind mismatch and `assets/` references fail.

  Verify by running the check against temporary fixture themes (missing image, orphan `.webp`, 600 KB image, GLB on a flat key) and confirm the expected pass/fail/warn results, then remove the fixtures.
- [x] 3.6 Board style (owner request, 2026-11-04):
  - Keep the 3D procedural diorama fallbacks for `tile.*`, `sea`, `token` and `harbor.*` alongside the flat ones.
  - Add `BoardStyle = "flat" | "3d"` with `useBoardStyle()`.
  - Add a pure default resolver: a coarse pointer or a smaller side under 768 gives flat, otherwise 3d.
  - Persist the choice in `localStorage` under `hexfall.boardStyle`, wrapped in try/catch.
  - `Asset` renders flat-kind keys according to the style.

  Verify with resolver unit tests (phone, desktop, stored value) and a test where storage throws.

## 4. Board view (board-view agent)

- [x] 4.1 Add `scene/BoardView.tsx`: land tiles at `hexCenter`, the 18-cell sea ring, and the robber (offset when its hex has a token), all through `<Asset>` with no local coordinate math. Verify with a test rendering the beginner board: 19 tile keys match terrains, 18 `sea` assets, and the robber is at hex 9.
- [x] 4.2 Add `scene/NumberToken.tsx`: the `token` asset plus a cached canvas label with the value and `6 − |7 − n|` pips, red for 6 and 8. Verify with a unit test of the label model (value → pip count and color) and that the desert gets no token.
- [x] 4.3 Add `scene/HarborMarker.tsx`: a badge at `edgeMidpoint + edgeOutward × 0.55`, links to both slot intersections, and a "3:1" or "2:1 <resource>" label. Verify with a test that 9 markers render, slot 1 of the beginner board is grain "2:1", and generic markers read "3:1".
- [x] 4.4 Add `useFitCamera` and OrbitControls limits, and replace the debug `Scene.tsx` with lighting, background, `<BoardView board={beginnerBoard()} />` and controls, with no demo pieces. Verify that `pnpm run build` succeeds and the client test suite passes.
- [x] 4.5 Add a HUD settings control (lead), usable by touch and keyboard, that switches the board style between Flat and 3D using `useBoardStyle()`. The switch must apply immediately. Verify with a HUD test that toggling calls `setStyle` and the control shows the current style, and with a visual check of both styles.

## 5. Painted tile art (lead with user)

- [x] 5.1 Ask the user to approve the image-generation cost and tool. Then generate one candidate each for the six terrains from text prompts only (owner chose this to fit a 100-credit balance). At the owner's suggestion, the sea is an original hand-written SVG rasterized locally (design decision 10). Verify that no generation call passes an image input.
- [x] 5.2 Present the candidates to the user for review and regenerate rejected keys until all 6 terrains and the SVG sea are approved (regeneration needs more credits). Verify the user's explicit approval of each key.
- [x] 5.3 Encode the approved images as 1024×1024 WebP of 400 KB or less in `apps/client/public/themes/diorama/tiles/`, map them in `theme.json` as `{ image }` entries, and update the license/source text. Verify that `node tools/check-assets.mjs` passes with no orphan or missing-file errors.

## 6. Integration and verification (lead)

- [x] 6.1 Run `pnpm run check`, `pnpm run test` and `pnpm run build` from the root. Verify that all pass and that `apps/client/dist` contains no file from `assets/`.
- [x] 6.2 Run `pnpm run dev` and check in Chrome at desktop and phone widths:
  - the whole board is visible;
  - the beginner layout matches the table;
  - tokens are readable, with red 6 and 8;
  - 9 harbor markers sit outside their slots, linked to their intersections;
  - the robber is on the desert;
  - tiles meet without gaps.

  Verify with screenshots shared with the user.
- [x] 6.3 Temporarily point `tile.hills` at a missing file. Verify that the hills tiles fall back to flat color with one warning naming `tile.hills` and `diorama`, then revert.
- [x] 6.4 Update `CHECKPOINT.md` with the board-topology status and the next change (`rules-engine`). Verify that the file names this change and lists the harbor-slot assumption.

## 7. Isometric tile support (owner request, 2026-11-04)

- [x] 7.1 Add an optional `projection: "top" | "isometric"` to flat manifest entries, accepted only on hex keys and resolved with the default "top". Verify with manifest and resolve tests.
- [x] 7.2 Add `relief.ts` (ISO_* constants, `landRelief`) and isometric prism geometry in `flat.tsx`. Lower the sea and harbors and set the camera to 60° elevation with ±25° azimuth when raised. Verify with relief tests for the corner → pixel mapping, band UVs, prism height and the raised/flat rules.
- [x] 7.3 Extend `tools/check-assets.mjs` to read PNG/WebP/JPEG sizes: fail on an isometric image that is not 16:17 or a bad `projection`, and warn on a non-square top-down tile. Verify against a temporary fixture, then remove it.
- [x] 7.4 Add `docs/art/tile-isometric-template.svg`, `tile-top-template.svg` and `README.md`. Verify visually by mapping a raster of the isometric template to `tile.desert` temporarily, then revert.
