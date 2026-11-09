// 3D mountains (specs/mountain-peaks): every mountain hex carries exactly one mountain, the
// owner's twin-peak snowy model spread over the whole hexagon (peak.glb, built by
// tools/blender/mountain-kit.py). The model is already fitted to one hex in Blender: it follows
// the domed tile, sinks to the ground along the rim (corners, edges), leaves one clearing for the
// number chip and the robber, and keeps its camera side low. So it is placed at the hex centre
// with no yaw or scale; turning it would move the clearing away from the robber's spot.
// Pure and deterministic: it depends only on the hex id, so every player sees the same mountains.
import type { Board } from "@hexfall/engine";
import { STANDARD_TOPOLOGY, hexCenter, topologyOf, type Topology } from "@hexfall/engine/geometry";
import type { PropInstance } from "./coastScatter.ts";
import { hash01 } from "./forestTrees.ts";

/** peak.glb variants: 0 as supplied, 1 mirrored. */
export const MOUNTAIN_VARIANTS = 2;
/** The mountain spans the hex up to its rim. */
const MOUNTAIN_RADIUS = 0.9;

/** The one mountain of a mountain hex. */
export function hexMountain(hex: number, topo: Topology = STANDARD_TOPOLOGY): PropInstance[] {
  const [x, z] = hexCenter(hex, topo);
  return [
    {
      key: "prop.peak",
      variant: Math.floor(hash01(hex * 733 + 1) * MOUNTAIN_VARIANTS),
      x,
      z,
      ground: 0,
      yaw: 0,
      scale: 1,
      radius: MOUNTAIN_RADIUS,
    },
  ];
}

/** Every mountain on the board (only mountain hexes carry one). */
export function mountainPeaks(board: Board): PropInstance[] {
  const topo = topologyOf(board);
  return topo.hexes.flatMap((info) =>
    board.hexes[info.id]?.terrain === "mountains" ? hexMountain(info.id, topo) : [],
  );
}
