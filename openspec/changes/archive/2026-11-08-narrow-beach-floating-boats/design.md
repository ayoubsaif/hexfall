## Context

`beachHeight(shore)` (coastTerrain.ts, mirrored in GLSL) is 0.095 inland and falls 0.38 across shore ∈ [−0.18, 1.5], so the waterline sits at shore ≈ 0.37. `sampleCoast` sets `shore = d − 0.14 + bay·1.15 + rag·0.4 + fine·0.08`, so bays move it by up to ±0.6. Boats sit at `JETTY_LENGTH + BOAT_GAP` (0.495) from the edge midpoint at `seaLevel`, often right at the waterline.

## Decisions

1. **Steeper profile.** The slope end moves from 1.5 to 0.75 (`BEACH_SLOPE_END`), putting the waterline at shore ≈ 0.12. The GLSL string is generated from the same constants so the two cannot drift.
2. **Smaller shoreline variation.** Bay 1.15 → 0.55, rag 0.4 → 0.22, and `shore ≤ d + 0.05`, so the beach is always dry within 0.05 of an outer hex edge however the noise falls. Depth (colour ramp) is unchanged.
3. **Boat placement as a pure function.** `boatDistance(land, mid, out, along)` in `boatFloat.ts` starts at the jetty end and steps out 0.03 until the centre and both hull ends (±0.2 along the coast) have `beachHeight(shore) ≤ −0.05`, capped at +0.6. `HarborMarker` uses it with the fixed board layout's land centres (positions never change between boards).
4. **Bobbing in the existing sail loop.** `useSailRigs` already runs once per frame over every boat; it also sets the boat root's local `position.y` (±0.008) and `rotation.z` roll (±0.035 rad), phased by the boat's world position. The sail turn works in the rig parent's space, so it is unaffected. Reduced motion: the loop resets both to 0.

## Risks / Trade-offs

- [A boat pushed out leaves a gap after the jetty] → the cap is small and only applies where the beach is wide; accepted.
- [Shoreline less ragged] → still varies at three scales; tests keep a minimum variation.
