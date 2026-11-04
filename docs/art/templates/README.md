# Asset templates (one per asset key)

Starter files for every asset Hexfall can theme. Open one, paint or model over it, then
export and map it in a theme's `theme.json`. The sizes match the game exactly, so art made
on these templates lines up without tweaking. Regenerate them with
`node docs/art/templates/build.mjs` (then `pnpm exec vp fmt docs/art/templates`), which overwrites these files, so save your work
elsewhere first.

General rules for 2D files (same as `docs/art/README.md`):

- Export PNG or WebP (JPEG allowed), sRGB, 400 KB or less.
- Hide or delete the `guides` layer before exporting. Paint on the `art` layer.
- The top of each image faces away from the player (row 1 of the board).
- Blue dashed areas are covered by text, pips or the robber that the game draws itself.
  Keep them calm.
- Only use art you made or have written permission to use. Record its license and source in
  `theme.json`.

## What each key needs

| Asset key                                                                                 | Template                                                                           | Export as             | Notes                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `tile.forest` `tile.pasture` `tile.fields` `tile.hills` `tile.mountains` `tile.desert`    | `tiles-top/<name>.svg` (1024 × 1024) or `tiles-isometric/<name>.svg` (1024 × 1088) | `tiles/<name>.webp`   | Use the same format for all six. Isometric entries add `"projection": "isometric"`. The desert never gets a token, but the robber starts there. |
| `sea`                                                                                     | `tiles-top/sea.svg` (1024 × 1024)                                                  | `tiles/sea.webp`      | Always top-down. Drawn on the 18 frame cells around the island.                                                                                 |
| `token`                                                                                   | `token.svg` (1024 × 1024)                                                          | `token.webp`          | Disc background only. The game draws the number (6 and 8 in red) and 1–5 pips.                                                                  |
| `harbor.generic` `harbor.brick` `harbor.grain` `harbor.lumber` `harbor.ore` `harbor.wool` | `harbors/<type>.svg` (1024 × 1024)                                                 | `harbors/<type>.webp` | Rounded badge, shown in the sea. The game draws "3:1" or "2:1" plus the resource name.                                                          |
| `piece.road` `piece.settlement` `piece.city` `piece.robber`                               | `pieces/<name>.gltf`                                                               | `pieces/<name>.glb`   | 3D models. See below.                                                                                                                           |

Example `theme.json` entries:

```json
"tile.forest": { "image": "tiles/forest.webp" },
"token": { "image": "token.webp" },
"harbor.ore": { "image": "harbors/ore.webp" },
"piece.city": { "model": "pieces/city.glb" }
```

## 3D pieces

The `.gltf` files are size references built from the game's built-in pieces. Import one
into Blender (File → Import → glTF 2.0), model over it, delete the reference mesh, then
export a compressed `.glb` (Draco or meshopt). Aim for 300 KB or less;
`node tools/check-assets.mjs` warns above that.

- **Axes and scale:** Y is up, and 1 unit is the hex radius (center to corner).
- **Origin:** at the base center; the model rests on y = 0.
- **Road:** lies along the X axis. One hex side is 1 unit long, so keep it around
  0.7 long so roads don't touch at intersections.
- **Player color:** give the surfaces that should change per player a material named
  exactly `PlayerColor`; the other materials keep their own colors. With no
  `PlayerColor` material, the whole piece takes the player's color. The robber is never
  tinted.

| Key                | Reference size (x × y × z units) |
| ------------------ | -------------------------------- |
| `piece.road`       | 0.72 × 0.10 × 0.11               |
| `piece.settlement` | 0.22 × 0.24 × 0.20               |
| `piece.city`       | 0.41 × 0.38 × 0.22               |
| `piece.robber`     | 0.26 × 0.48 × 0.26               |
