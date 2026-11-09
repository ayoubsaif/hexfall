// Harbor marker: one edge-aligned jetty (asset key `prop.jetty`) running from the coastal edge
// out to sea, with a boat moored beyond its sea end. The boat's sail carries the trade rate and,
// for special harbors, the resource icon and tint, and it turns toward the camera
// (specs/board-view "Harbor markers").
import { useMemo } from "react";
import { Asset, JETTY_LENGTH, useLandRelief } from "../theme/index.ts";
import { LAND_CENTERS, boatDistance } from "./boatFloat.ts";
import type { XZ } from "./layout.ts";
import { type BoatHandle, HarborBoat } from "./HarborBoat.tsx";
import type { HarborItem } from "./layout.ts";

/** Gap from the jetty's sea end to the hull's centre line, so the boat lies just off its end. */
const BOAT_GAP = 0.135;

export function HarborMarker({
  item,
  boatRef,
  land = LAND_CENTERS,
}: {
  item: HarborItem;
  boatRef: (boat: BoatHandle | null) => void;
  /** Land hex centres of the board shown (the boat floats clear of its beach). */
  land?: readonly XZ[];
}) {
  // On a raised island the sea sits lower, and the boat floats on it.
  const { seaLevel } = useLandRelief();
  const [px, pz] = item.position;
  // Use the slot edge midpoint, not the island center: outer hex edges have six exact normals.
  const mx = (item.ends[0][0] + item.ends[1][0]) / 2;
  const mz = (item.ends[0][1] + item.ends[1][1]) / 2;
  // Unit vector from the coastal edge out to sea.
  const length = Math.hypot(px - mx, pz - mz);
  const sx = (px - mx) / length;
  const sz = (pz - mz) / length;
  // The hull lies along the coast (the slot path), just beyond the jetty's sea end.
  const ex = item.ends[1][0] - item.ends[0][0];
  const ez = item.ends[1][1] - item.ends[0][1];
  const el = Math.hypot(ex, ez);
  // Just past the jetty, or further out where the beach is wide, so the boat always floats.
  const boatOut = useMemo(
    () => boatDistance(land, [mx, mz], [sx, sz], [ex / el, ez / el], JETTY_LENGTH + BOAT_GAP),
    [land, mx, mz, sx, sz, ex, ez, el],
  );
  return (
    <group>
      <group position={[mx, 0, mz]} rotation={[0, Math.atan2(-sz, sx), 0]}>
        <Asset assetKey="prop.jetty" />
      </group>
      <group
        position={[mx + sx * boatOut, seaLevel, mz + sz * boatOut]}
        rotation={[0, Math.atan2(-ez, ex), 0]}
      >
        <HarborBoat type={item.type} register={boatRef} />
      </group>
    </group>
  );
}
