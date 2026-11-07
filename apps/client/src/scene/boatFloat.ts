// Harbor boat placement (specs/sea-shore "Boats float"): start just past the jetty's sea end and
// move out to sea until the whole hull is over water of a minimum depth. Pure and deterministic.
import { beginnerBoard } from "@hexfall/engine/geometry";
import { sampleCoast } from "./coastField.ts";
import { beachHeight } from "./coastTerrain.ts";
import { boardLayout, type XZ } from "./layout.ts";

/** Water depth (below mean sea level) the hull needs under its centre and both ends. */
export const FLOAT_DEPTH = 0.05;
/** Half the hull length along the coast, in world units. */
export const HULL_HALF = 0.2;
const STEP = 0.03;
/** Furthest a boat is moved past its starting distance. */
export const MAX_PUSH = 0.6;

/** Land hex centres; the same for every board (only terrains and numbers change). */
export const LAND_CENTERS: readonly XZ[] = boardLayout(beginnerBoard()).tiles.map(
  (t) => t.position,
);

function floats(land: readonly XZ[], x: number, z: number): boolean {
  return beachHeight(sampleCoast(land, x, z).shore) <= -FLOAT_DEPTH;
}

/**
 * Distance from the edge midpoint `mid` along the unit sea direction `out` at which the boat
 * floats, starting at `start`. `along` is the unit direction of the hull (the coast edge).
 */
export function boatDistance(
  land: readonly XZ[],
  mid: XZ,
  out: XZ,
  along: XZ,
  start: number,
): number {
  for (let d = start; d <= start + MAX_PUSH + 1e-9; d += STEP) {
    const cx = mid[0] + out[0] * d;
    const cz = mid[1] + out[1] * d;
    const ok = [-1, 0, 1].every((k) =>
      floats(land, cx + along[0] * HULL_HALF * k, cz + along[1] * HULL_HALF * k),
    );
    if (ok) return d;
  }
  return start + MAX_PUSH;
}
