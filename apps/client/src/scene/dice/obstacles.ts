// What the dice bump into on the board: settlements, cities, roads, the robber and the number
// chips near the dice area, as static boxes and cylinders in the dice simulation's local units
// (world / DICE_SCALE, floor at y = 0). Built from the game view when a roll arrives; every
// client has the same view at that point in the log, so the throw stays shared.
// No physics import here, so the main bundle can use it.
import type { PlayerView } from "@hexfall/engine";
import { topologyOf } from "@hexfall/engine/geometry";
import { CHIP_HEIGHT, TOKEN_RADIUS } from "../../theme/flat.tsx";
import { DOME_AMPLITUDE, DOME_RADIUS, domeHeight } from "../../theme/relief.ts";
import { boardLayout } from "../layout.ts";
import { pieceLayout } from "../pieces.ts";
import { DICE_AREA, DICE_SCALE } from "./area.ts";

export interface BoxObstacle {
  shape: "box";
  /** Center, local units. */
  position: [number, number, number];
  /** Half extents before the yaw, local units. */
  half: [number, number, number];
  /** Turn about +Y (radians). */
  yaw: number;
}

export interface CylinderObstacle {
  shape: "cylinder";
  position: [number, number, number];
  radius: number;
  height: number;
}

export type Obstacle = BoxObstacle | CylinderObstacle;

/**
 * World half extents (x, y, z) of each piece, base on the land: measured from the diorama
 * models (the procedural fallbacks are a little smaller).
 */
const PIECE_HALF = {
  settlement: [0.125, 0.112, 0.15],
  city: [0.14, 0.185, 0.25],
  road: [0.36, 0.067, 0.07],
} as const;
const ROBBER = { radius: 0.13, height: 0.48 };
/** Obstacles further than this outside the walls cannot be reached (world units). */
const REACH = 0.4;
/** How deep a die may sink into a land dome before the dome counts as a wall (world units). */
const DOME_SINK = 0.06;

/** Radius around a hex center where its dome rises above DOME_SINK (0 when it never does). */
function domeWall(assetKey: string): number {
  const a = DOME_AMPLITUDE[assetKey] ?? 0;
  if (a <= DOME_SINK) return 0;
  return DOME_RADIUS * Math.sqrt(1 - Math.sqrt(DOME_SINK / a));
}

function near(x: number, z: number, extent: number): boolean {
  const ax = DICE_AREA.halfX * DICE_SCALE + REACH + extent;
  const az = DICE_AREA.halfZ * DICE_SCALE + REACH + extent;
  return Math.abs(x) <= ax && Math.abs(z) <= az;
}

const local = (v: number) => v / DICE_SCALE;

/**
 * `raised`: the theme draws domed land, which lifts each chip (and the robber) to its dome
 * top. The dice floor stays flat, so a raised chip is a column from the floor to its top, and
 * the high part of a dome is a wall too: otherwise a die could roll under a chip or sink into
 * a hill and be hidden.
 */
export function diceObstacles(view: PlayerView, raised = false): Obstacle[] {
  const out: Obstacle[] = [];
  for (const p of pieceLayout(
    view.vertices,
    view.edges,
    { raised: false, thickness: 0, seaLevel: 0 },
    topologyOf(view.board),
  )) {
    const [hx, hy, hz] = PIECE_HALF[p.kind];
    const [x, z] = p.position;
    if (!near(x, z, Math.max(hx, hz))) continue;
    out.push({
      shape: "box",
      position: [local(x), local(hy), local(z)],
      half: [local(hx), local(hy), local(hz)],
      yaw: p.yaw,
    });
  }
  const layout = boardLayout(view.board, view.robber);
  const tiles = new Map(layout.tiles.map((t) => [t.hex, t]));
  const column = (x: number, z: number, radius: number, height: number) =>
    out.push({
      shape: "cylinder",
      position: [local(x), local(height / 2), local(z)],
      radius: local(radius),
      height: local(height),
    });
  const domeAt = (hex: number, x: number, z: number) => {
    const tile = tiles.get(hex);
    if (!raised || !tile) return 0;
    return domeHeight(tile.assetKey, Math.hypot(x - tile.position[0], z - tile.position[1]));
  };
  if (raised) {
    for (const t of layout.tiles) {
      const radius = domeWall(t.assetKey);
      const [x, z] = t.position;
      if (radius > 0 && near(x, z, radius)) column(x, z, radius, domeHeight(t.assetKey, 0));
    }
  }
  for (const t of layout.tokens) {
    const [x, z] = t.position;
    if (!near(x, z, TOKEN_RADIUS)) continue;
    column(x, z, TOKEN_RADIUS, domeAt(t.hex, x, z) + CHIP_HEIGHT);
  }
  const [rx, rz] = layout.robber.position;
  if (near(rx, rz, ROBBER.radius)) {
    column(rx, rz, ROBBER.radius, domeAt(layout.robber.hex, rx, rz) + ROBBER.height);
  }
  return out;
}
