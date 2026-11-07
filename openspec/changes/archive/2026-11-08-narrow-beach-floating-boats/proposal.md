## Why

The sand beach between the land hexagons and the sea is wide (the waterline sits about half a hex radius out, and much further in bays), so the water feels far from the board. Harbor boats are placed at a fixed distance past the jetty at sea level, so where the beach is wide they sit on sand instead of floating, and they never move.

## What Changes

- Narrower beach: the sand profile drops below sea level about half as far from the coast, and the bay/headland variation of the shoreline is smaller, so the waterline runs close to the outer hexagons all around the island. The beach never reaches past the hex edges into the land, and water never covers the land.
- The water shader and the beach mesh keep sharing one profile, so the wet-sand wash and foam follow the new waterline.
- Harbor boats always float: each boat is pushed out from the jetty end until its whole hull is over water of a minimum depth.
- Boats bob gently on the water (a small rise and fall with a slight roll, each boat out of phase). With reduced motion they stay still.

Non-goals: changing the sea colours, wave model, jetty model or boat model.

## Capabilities

### New Capabilities
- `sea-shore`: beach width against the island and harbor boats floating on the water.

### Modified Capabilities
<!-- None archived describe the beach profile or boat placement. -->

## Impact

- `apps/client/src/scene/coastTerrain.ts` (beach profile, shared with the water shader), `coastField.ts` (shoreline variation), new `boatFloat.ts` (pure placement), `HarborMarker.tsx` (uses it), `HarborBoat.tsx` (bobbing in the existing per-frame loop).
- Tests in `apps/client/test/scene/`.
