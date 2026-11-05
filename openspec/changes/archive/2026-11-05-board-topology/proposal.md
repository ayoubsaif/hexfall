## Why

Every later change needs a real board: the rules engine (placement, production, harbors, robber, Longest Road), the server and the 3D client. Right now there is only a 7-hex debug scene and no board model in the engine. This change adds the full 19-hex island as plain data. That covers the hexes, the 54 intersections, the 72 paths, the sea frame and the 9 harbor slots, plus the two board setups from AGENTS.md §4a/§4b. It also gives the client the agreed look: flat painted tiles with 3D pieces.

## What Changes

- **Engine: board topology (pure, static).** Adds pointy-top axial coordinates and stable ids for 19 hexes, 54 intersections and 72 paths. It also adds the adjacency between them (hex↔intersection↔path, intersection neighbors), coastal flags and 9 fixed harbor slots on coastal paths. These are exported from the allow-listed `@hexfall/engine/geometry` subpath, together with world-space helpers (hex centers, intersection positions, path midpoints and angles), so the client never re-derives geometry.
- **Engine: board setups.**
  - *Beginner*: the exact §4a terrain/token table, with the robber on the desert and harbor types in the §4a clockwise order.
  - *Variable*: from a seeded RNG, shuffled terrains and shuffled harbor types on the fixed slots. Number tokens follow the A–R counter-clockwise spiral from a random corner, skipping the desert. The robber starts on the desert. The same RNG state always produces the same board.
  - The board is plain JSON data.
- **Client: board view.** Replaces the debug scene with the full board: 19 flat land tiles, a ring of flat sea tiles, flat number tokens (number plus probability pips, with 6 and 8 emphasized), flat harbor markers on their slot paths (ratio plus resource), and the 3D robber. It renders the beginner board as a preview until the server sends real games.
- **Theming (modified).** `tile.*`, `sea`, `token` and `harbor.*` become *flat* keys mapped to image textures on flat geometry. Their procedural fallback is a flat colored shape. `piece.*` stay GLB *model* keys. The manifest, validation, load-failure and budget/orphan checks are extended to image files. **BREAKING** (only internal): flat keys no longer accept `model` entries or transform overrides. The 3D tile, token and harbor fallbacks are removed.
- **Art.** Original painted top-down textures for the six terrains and the sea. They are generated only from text prompts, with no image input, never from `assets/`. The user reviews them before they are committed to the default theme.
- **Docs.** Restores the user's rules text as `AGENTS.md` at the repo root, since specs refer to it and it is not in the repo yet.

Out of scope:
- Beginner pre-placed settlements and roads. AGENTS.md §4a says to fall back to the normal setup phase, because Illustration A is unavailable. The setup phase itself belongs to `rules-engine`.
- The optional "fully random tokens with 6/8 never adjacent" mode.
- Placement legality.
- Interactive picking.

## Capabilities

### New Capabilities
- `board-topology`: the engine's static board graph (ids, adjacency, coastal paths, harbor slots, world coordinates) and the beginner and variable board setups as deterministic plain-data generation.
- `board-view`: client rendering of a board value: flat tiles, sea frame, number tokens, harbor markers and robber, all placed from engine geometry through the theme layer.

### Modified Capabilities
- `asset-theming`:
  - Asset keys split into flat (image) and model (GLB) kinds.
  - The manifest maps flat keys to images.
  - The coordinate contract covers flat assets.
  - The procedural fallbacks for flat keys become flat colored shapes.
  - Load failure, validation, budget and orphan checks cover image files.
  - Transform overrides apply only to model keys.
  - The default theme ships original painted tile art.

## Impact

- `packages/engine`:
  - New `topology.ts` / `board.ts` modules.
  - `geometry.ts` gains real exports.
  - New tests.
  - No new dependencies.
- `apps/client`:
  - `src/theme/*`: manifest schema, `Asset`, fallbacks and keys metadata.
  - `src/scene/*`: new board view replacing the debug scene.
  - `public/themes/diorama/`: new texture files and manifest entries.
- `tools/check-assets.mjs`: image files are covered by the existing-file, orphan, budget and `assets/` guards.
- No protocol or server changes. Games are not created or sent yet (`game-server`).
- Art generation uses an external image-generation tool, which may cost credits. It is a one-off, user-reviewed step, not a build dependency.
