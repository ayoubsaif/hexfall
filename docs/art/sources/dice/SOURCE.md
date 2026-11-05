# Die model source

Source mesh for the `diorama` theme's `dice.die`. Convert it with `pnpm run models:dice`
(tools/obj-to-glb.mjs), which writes `apps/client/public/themes/diorama/models/die.glb`.

| File               | Asset key  | Author  | Source  | License |
| ------------------ | ---------- | ------- | ------- | ------- |
| Dice.obj, Dice.mtl | `dice.die` | unknown | unknown | unknown |

- Blender 2.76 export of `DiceBR.blend` (object `g_Dice_Roundcube.001`), supplied by the project
  owner on 2026-11-06. File timestamps are 2015-12-01.
- **Not shipped yet.** The author and license are unknown, so the theme does not map `dice.die`
  and the game uses the procedural die (specs/asset-theming "Licensing guard"). Once the owner
  confirms an allowed license, fill in the table, run `pnpm run models:dice`, map
  `"dice.die": { "model": "models/die.glb" }` in `theme.json` and add a credit if the license
  needs attribution.
- Materials: `Red` (body) and `White` (pips). Values by side, checked by the converter from the
  pip geometry: +Y=1, +Z=2, +X=3, −X=4, −Z=5, −Y=6. The converter centers the die on the origin
  and scales its edge to 0.30 units; it does not change the shape.
