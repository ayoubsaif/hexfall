# Tile art format

Hexfall draws each terrain (and the sea) from one image per key in a theme's
`theme.json`. Two formats are supported. All six terrain images in a theme should use
the same one.

|          | Top-down                            | Isometric                                                     |
| -------- | ----------------------------------- | ------------------------------------------------------------- |
| Template | `tile-top-template.svg`             | `tile-isometric-template.svg`                                 |
| Size     | 1024 × 1024 px (any square)         | 1024 × 1088 px (any 16:17)                                    |
| Hex      | pointy-top, 886.8 px wide, centered | top face fills 1024 × 1024, seen from 60°                     |
| Extra    | —                                   | 64 px earth band under the two front edges                    |
| Entry    | `{ "image": "tiles/forest.webp" }`  | `{ "image": "tiles/forest.webp", "projection": "isometric" }` |

Rules for both:

- PNG or WebP (JPEG allowed), sRGB, 400 KB or less. Pixels outside the hex are never shown;
  painting 10–20 px past the outline (bleed) avoids seams between tiles.
- The top of the image faces row 1 of the board (away from the player).
- Keep the blue **token area** quiet: a number token covers it.
- The purple **robber** spot is where the robber stands on a tile that has a token.
- Orange dots are intersections, where settlements and cities sit.
- Delete the `guides` layer before export.

When any terrain image is isometric, the board draws the island as raised tiles. The
camera tilts to 60° and turns at most ±25° so the art stays aligned. The earth band
shows along the coast.

`node tools/check-assets.mjs` fails on an isometric image that is not 16:17. It warns
on a top-down tile image that is not square.

Only use art you made or have written permission to use. Record its license and source
in `theme.json`.

## Resource card art

The HUD's resource cards (`apps/client/public/cards/{brick,grain,lumber,ore,wool}.webp`)
are cut from the diorama terrain tiles by `pnpm run cards:build`
(`tools/cards-from-tiles.mjs`): hills → brick, fields → grain, forest → lumber,
mountains → ore, pasture → wool. Each card is the centered 500 × 700 area inside the hex,
resized to 320 × 448 with a soft vignette, WebP quality 80. They are derived from the
project's own CC0 tiles, so they are CC0 too. Re-run the script whenever a tile changes;
the output is deterministic.
