## Why

Harbors are currently a stone pier with a flat chip (resource icon + "3:1"/"2:1") lying on its deck. The chip reads like a number token and looks out of place on the sea. A small sailing boat moored at each pier, with the harbor's resource and rate painted on its sail, is easier to read as "a harbor" at a glance and fits the 3D diorama look. The owner supplied the boat model (`docs/assets/cartoon_boat_toon.glb`).

## What Changes

- Each of the 9 harbors shows a boat (the supplied cartoon boat model) moored at the sea end of its stone pier, floating on the sea surface.
- **BREAKING (visual)**: the harbor chip is removed. The harbor's information moves onto the boat's sail: the sail shows the trade rate ("3:1" or "2:1"), and special harbors also show their resource icon and a sail tint in the resource colour. All six harbor types stay distinguishable.
- The sail (with its yard and sheets) turns about the mast so its painted face always points toward the viewer's camera, horizontally, like a weather vane. The hull stays fixed. The turn is per client (each player's own camera); it is not game state and is not synced.
- A new model asset key `prop.boat` is added to the theme layer. The `diorama` theme maps it to `models/boat.glb` (the supplied model). Like every key, it has a procedural fallback (a simple hull, mast and flat sail), used while the model loads, if it fails, or with zero asset files. The sail label works on both.
- The boat's sail mesh has no UV coordinates, so the client generates flat (planar) UVs for it to paint the label.
- The camera framing keeps the masts and sails in view.

Non-goals: boat animation (bobbing, sailing), changes to harbor rules, placement or trade logic, changes to the pier model.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `board-view`: "Harbor markers" changes from a pier + chip to a pier + moored boat whose camera-facing sail shows the rate and resource. "Board framing" must include the boats' masts.
- `asset-theming`: the supported key set and the asset kinds gain the model key `prop.boat`; the model coordinate contract defines the boat's origin, axes, and its named sail and mast parts; the procedural fallback covers the boat.

## Impact

- Client scene: `apps/client/src/scene/HarborMarker.tsx` (chip removed, boat added), new `HarborBoat` component and sail label texture, `chipYaw.ts` reused for the sail's yaw, `BoardView.tsx` (harbors no longer register with the chip-facing hook), `useFitCamera.ts` (framing height).
- Theme layer: `apps/client/src/theme/keys.ts`, fallbacks, manifest validation, `apps/client/public/themes/diorama/theme.json` and a new `apps/client/public/themes/diorama/models/boat.glb` (about 150 KB, within the 300 KB model budget). The theme credits/licence entry must cover the new model.
- Tests: `apps/client/test/scene/harborChip.test.ts` is replaced by sail-colour tests; new tests for sail yaw, planar sail UVs, the new key and its fallback.
- Offline cache: `/themes/` is already served stale-while-revalidate by `sw.js`, so no service worker change.
- No engine, protocol or server changes.
