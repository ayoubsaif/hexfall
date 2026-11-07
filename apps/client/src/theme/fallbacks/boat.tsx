// Procedural harbor boat (`prop.boat`), authored at its final on-board size. It follows the
// boat contract (specs/asset-theming, "Model coordinate contract"): origin at the hull's
// waterline centre on y=0, length along X, and the named sail, mast and yard nodes that the
// harbor marker paints and turns, so the fallback carries the same label as the GLB.
import { useMemo } from "react";
import { DoubleSide, PlaneGeometry } from "three";
import { Mat } from "./common.tsx";

/** The fallback is drawn at the GLB's on-board size (theme scale 0.1 of a 5.3-long model). */
const SIZE = 0.1 / 0.18;

/** Sail extent in the hull frame: across the hull (Z) and up (Y), just in front of the mast. */
export const BOAT_SAIL = {
  x: 0.1 * SIZE,
  halfWidth: 0.23 * SIZE,
  bottom: 0.24 * SIZE,
  top: 0.62 * SIZE,
} as const;
export const BOAT_MAST = { x: 0.045 * SIZE, height: 0.72 * SIZE } as const;

/** A flat sail facing +X, without UVs (the marker generates them like for the GLB sail). */
export function sailGeometry(): PlaneGeometry {
  const g = new PlaneGeometry(BOAT_SAIL.halfWidth * 2, BOAT_SAIL.top - BOAT_SAIL.bottom);
  g.rotateY(Math.PI / 2);
  g.deleteAttribute("uv");
  return g;
}

/** Hull top (y) of the fallback: the sail must clear it at every turn. */
export const BOAT_HULL_TOP = 0.14 * SIZE;

export function BoatPiece() {
  const sail = useMemo(sailGeometry, []);
  return (
    <group name="Boat Hull">
      {/* Hull: a low box with a raised bow and stern, its keel just under the waterline. */}
      <mesh position={[0, 0.03 * SIZE, 0]} castShadow>
        <boxGeometry args={[0.8 * SIZE, 0.12 * SIZE, 0.3 * SIZE]} />
        <Mat color="#8a5a32" />
      </mesh>
      {[-1, 1].map((end) => (
        <mesh key={end} position={[end * 0.43 * SIZE, BOAT_HULL_TOP - 0.08 * SIZE, 0]} castShadow>
          <boxGeometry args={[0.08 * SIZE, 0.16 * SIZE, 0.08 * SIZE]} />
          <Mat color="#6e4526" />
        </mesh>
      ))}
      <mesh name="Boat Mast" position={[BOAT_MAST.x, BOAT_MAST.height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.014, BOAT_MAST.height, 6]} />
        <Mat color="#6e4526" />
      </mesh>
      <mesh
        name="Boat Yard"
        position={[BOAT_MAST.x + 0.02, BOAT_SAIL.top + 0.01, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.009, 0.009, BOAT_SAIL.halfWidth * 2 + 0.04, 6]} />
        <Mat color="#6e4526" />
      </mesh>
      <mesh
        name="Boat Sail"
        geometry={sail}
        position={[BOAT_SAIL.x, (BOAT_SAIL.top + BOAT_SAIL.bottom) / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color="#d1b885" roughness={0.85} side={DoubleSide} />
      </mesh>
    </group>
  );
}
