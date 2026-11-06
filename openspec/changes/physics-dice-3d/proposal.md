## Why

The dice are CSS cubes in a HUD tray that play a canned tumble. Players want real dice: a 3D model thrown onto the table by a physics simulation, bouncing and settling naturally, while still landing on the number the server rolled. The project now has a die model (`Dice.obj` + `Dice.mtl`, red body with white pips) to make that possible.

## What Changes

- Two 3D dice built from `Dice.obj` are thrown onto a dice area on the table, beside the island, in the board's WebGL scene. A rigid-body physics simulation drives the tumble and bounces.
- The dice always come to rest on the server's roll. The client simulates the whole throw ahead of time, reads which face lands up, then turns the die model inside its physics body (a cube symmetry, so the physics is unchanged) so the face that lands up is the rolled value. The server keeps rolling with its seeded RNG; nothing about the roll moves to the client.
- The throw is seeded from the roll (room and roll index), so every player sees the same tumble.
- Rolls that arrive in a snapshot (join, resume) and every roll under reduced motion show the dice already at rest on their values, with no simulation played.
- After the throw the dice stay on the table showing the roll until the next one. Before the first roll of a turn they sit in a resting pose.
- The HUD dice tray keeps its job as the roll button and the text readout ("Rolled 3 and 4, total 7", announced when the dice settle). Its CSS cubes are replaced by a compact total readout. "Settled" now means the 3D dice came to rest.
- A new `tools/obj-to-glb.mjs` converts `Dice.obj`/`Dice.mtl` into a meshopt-compressed `die.glb` in the diorama theme, recoloring it white with black pips (the owner's choice) and recording which local axis carries each value (+Y=1, +Z=2, +X=3, −X=4, −Z=5, −Y=6, measured from the pip geometry).
- New model asset key `dice.die` with a procedural fallback (rounded cube with pips), so the game works without the file.
- New dependency: `cannon-es` (pure JavaScript rigid-body physics), loaded lazily with the dice so the start screen does not pay for it.

## Capabilities

### New Capabilities
- `board-dice`: physics dice thrown on the board, server-authoritative faces, shared seeded throw, static display for snapshots and reduced motion, settle signal and the tray's readout role.

### Modified Capabilities
- `asset-theming`: adds the `dice.die` model key (key set and asset kinds) and a reproducible OBJ → GLB conversion for the die with its face map and license record.

## Impact

- **Client**: new `apps/client/src/scene/dice/` (simulation, face remap, `BoardDice` component); `scene/Scene.tsx` mounts the dice; `hud/dice/DiceTray.tsx` drops `Die3d` for a readout and listens to the 3D settle; `hud/dice/Die3d.tsx` is removed; `theme/keys.ts`, fallbacks and the diorama `theme.json` gain `dice.die`.
- **Tools**: new `tools/obj-to-glb.mjs` and `pnpm run models:dice`; `tools/check-assets.mjs` budgets the die.
- **Assets**: `Dice.obj` and `Dice.mtl` move to `docs/art/sources/dice/` with a source and license record. Their author and license are not known yet and must be recorded before the model ships (licensing guard); until then the procedural fallback die is used.
- **Dependencies**: `cannon-es` added to `apps/client`.
- **Server, protocol, engine**: no change. Dice values stay server-rolled.
- **Related change**: supersedes the CSS dice of the unarchived `dice-tray-3d` change (its tray placement and roll button stay).
