// Harbor marker: one edge-aligned stone pier with a boat moored at its sea end. The boat's
// sail carries the trade rate and, for special harbors, the resource icon and tint, and it
// turns toward the camera (specs/board-view "Harbor markers").
import { useLandRelief } from "../theme/index.ts";
import { type BoatHandle, HarborBoat } from "./HarborBoat.tsx";
import { HarborDock } from "./HarborDock.tsx";
import type { HarborItem } from "./layout.ts";

/** Gap from the pier's sea end to the hull's centre line: the boat lies well out in the sea. */
const BOAT_CLEARANCE = 0.42;

export function HarborMarker({
  item,
  boatRef,
}: {
  item: HarborItem;
  boatRef: (boat: BoatHandle | null) => void;
}) {
  // On a raised island the sea sits lower, and the harbor sits on it.
  const { seaLevel } = useLandRelief();
  const [px, pz] = item.position;
  // Use the slot edge midpoint, not the island center: outer hex edges have six exact normals.
  // Extend the sea end a little past the marker position.
  const mx = (item.ends[0][0] + item.ends[1][0]) / 2;
  const mz = (item.ends[0][1] + item.ends[1][1]) / 2;
  const dx = mx - px;
  const dz = mz - pz;
  const length = Math.hypot(dx, dz);
  const extension = 0.15 / length;
  const ox = -dx * extension;
  const oz = -dz * extension;
  const pierX = dx - ox;
  const pierZ = dz - oz;
  // The hull lies along the coast (the slot path), just beyond the pier's sea end.
  const ex = item.ends[1][0] - item.ends[0][0];
  const ez = item.ends[1][1] - item.ends[0][1];
  const out = BOAT_CLEARANCE / length;
  return (
    <group position={[px + ox, 0, pz + oz]}>
      <HarborDock dx={pierX} dz={pierZ} seaLevel={seaLevel} />
      <group position={[-dx * out, seaLevel, -dz * out]} rotation={[0, Math.atan2(-ez, ex), 0]}>
        <HarborBoat type={item.type} register={boatRef} />
      </group>
    </group>
  );
}
