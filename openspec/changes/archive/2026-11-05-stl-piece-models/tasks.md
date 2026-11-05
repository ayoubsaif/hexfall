## 1. Sources and licensing record

- [x] 1.1 Ask the owner for the title, author, URL, license and download date of each STL (road, settlement, city). If any license is NC, ND or unclear, stop and ask the owner how to proceed. Verify: answers recorded in the next task.
- [x] 1.2 Copy `assets/{road,settlement,city}.stl` to `docs/art/sources/pieces/` and write `docs/art/sources/pieces/SOURCE.md` with the per-file credit data. Verify: `git status` shows the four new files, and `assets/` is untouched.

## 2. Converter tool

- [x] 2.1 Add the devDependencies `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions` and `meshoptimizer` (pinned), plus a root script `models:pieces` that runs `node tools/stl-to-glb.mjs`. Verify: `pnpm install` succeeds and the script runs (it may still fail at this point, for lack of a config).
- [x] 2.2 Implement the binary STL parser in `tools/stl-to-glb.mjs`. It rejects ASCII or truncated input with a named error. Verify: a Vitest test parses a hand-built two-triangle binary STL and rejects a truncated buffer.
- [x] 2.3 Implement the vertex weld, the creased normals (40°), the winding fix for negative signed volume, and the orientation (`upAxis`, `yawDeg`, optional `crossScale`) from a per-piece config. Verify: unit tests on a unit cube check that 8 corners weld into a 24-vertex creased mesh with outward normals, and that Z-up input becomes Y-up.
- [x] 2.4 Implement the normalization: center X/Z, set min Y = 0, and apply a uniform scale to the target (road X extent 0.72; settlement and city longest horizontal side 0.20 and 0.36). Verify: a unit test checks the bounds against the contract tolerances in the spec ("Converted road follows the contract").
- [x] 2.5 Write GLBs with `@gltf-transform/core`: one mesh and one PBR material, then meshopt compression with quantization and no timestamps. Output goes to `apps/client/public/themes/diorama/models/{road,settlement,city}.glb`. Verify: a test runs the conversion twice and the outputs are byte-identical, and each file has `EXT_meshopt_compression` in `extensionsUsed`.

## 3. Manifest credits and validation

- [x] 3.1 Extend the zod schema in `apps/client/src/theme/manifest.ts` with optional `credits` (`keys`, `title`, `author`, `url`, `license`), and expose `credits` from the resolved theme. Verify: new cases in `apps/client/test/theme/manifest.test.ts` pass for a valid credit list, and make a credit with a missing field invalidate the manifest.
- [x] 3.2 Extend `tools/check-assets.mjs` to enforce four rules:
  - the license allowlist (`CC0-1.0`, `CC-BY-3.0`, `CC-BY-4.0`, `CC-BY-SA-3.0`, `CC-BY-SA-4.0`, `MIT`);
  - rejection of `-NC`/`-ND`;
  - credit keys must be mapped by the manifest;
  - every attribution-licensed mapped key must be credited.

  Verify: run the check against temporary fixture themes, one per failing scenario in the spec delta. Each fails with the theme, key and reason, and the real `diorama` theme passes.

## 4. Wire the models into the diorama theme

- [x] 4.1 Run `pnpm run models:pieces`. Then add the `piece.road`, `piece.settlement` and `piece.city` entries, with no overrides, plus the `credits` from task 1.2 to `apps/client/public/themes/diorama/theme.json`, and update its `source` text. Verify: `node tools/check-assets.mjs` passes with no budget or compression warnings for the three keys.
- [x] 4.2 Visual check in the running client, in both the 3D and Flat board styles, with 3–4 players placing roads, settlements and cities. Pieces must:
  - stand upright;
  - rest on the board;
  - match the fallback size closely enough (spec scenario "Converted model swaps in without moving");
  - show each player's color clearly.

  If the up axis or yaw is wrong, or the road is too chunky, adjust `upAxis`/`yawDeg`/`crossScale`, then reconvert and recheck. Verify: screenshots of both styles are shared with the owner, and the owner approves them.

## 5. Credits view

- [x] 5.1 Add a Credits dialog that lists the active theme's credits (title, author, license, link that opens in a new tab with `rel="noopener noreferrer"`), or the manifest license/source when there are no credits. It opens from the start screen and from the HUD. Verify: Vitest/RTL tests cover both the credits-present and no-credits cases, and the link attributes are asserted.

## 6. Final checks

- [x] 6.1 Run `pnpm run check` and the full test suite. Verify: both are green, apart from any pre-existing failures already recorded in CHECKPOINT.md.
- [x] 6.2 Run a production build of the client and confirm that `dist/` contains the three GLBs and no file from `assets/` or `docs/art/sources/`. Verify: a directory listing of `apps/client/dist/themes/diorama/models`, and a grep for `.stl` in `dist/` that returns nothing.
- [x] 6.3 Update `CHECKPOINT.md` with the change status and the conversion command. Verify: the file mentions `stl-piece-models` and `pnpm run models:pieces`.
