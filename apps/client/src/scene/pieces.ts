// Pure layout of the live game's pieces and pick targets (specs/board-interaction).
// Positions come from the engine geometry; heights from the land relief.
import type { Building, Seat } from "@hexfall/engine";
import {
  STANDARD_TOPOLOGY,
  edgeMidpoint,
  hexCenter,
  vertexPosition,
  type Topology,
} from "@hexfall/engine/geometry";
import { seatColor } from "../game/colors.ts";
import type { Pick, TargetKind } from "../game/pick.ts";
import type { AssetKey, LandRelief } from "../theme/index.ts";
import type { XZ } from "./layout.ts";

export type PieceKind = "road" | "settlement" | "city";

export interface PieceItem {
  /** Stable per piece: `e40` for a road, `v12:settlement` / `v12:city` for buildings. */
  readonly key: string;
  readonly kind: PieceKind;
  readonly assetKey: AssetKey;
  /** EdgeId for roads, VertexId otherwise. */
  readonly at: number;
  readonly owner: Seat;
  readonly color: string;
  readonly position: XZ;
  /** Rotation about +Y; turns the model's local +X along the road's path (0 for buildings). */
  readonly yaw: number;
  /** Base height (land top). */
  readonly y: number;
}

/**
 * Height of the land surface. Land tiles keep their top at y = 0 in every relief mode
 * (a raised island lowers the sea instead), so pieces and targets rest at 0.
 */
export function landTop(_relief: LandRelief): number {
  return 0;
}

export function pieceLayout(
  vertices: readonly (Building | null)[],
  edges: readonly (Seat | null)[],
  relief: LandRelief,
  topo: Topology = STANDARD_TOPOLOGY,
): PieceItem[] {
  const y = landTop(relief);
  const items: PieceItem[] = [];
  edges.forEach((owner, e) => {
    if (owner === null || owner === undefined) return;
    const m = edgeMidpoint(e, topo);
    items.push({
      key: `e${e}`,
      kind: "road",
      assetKey: "piece.road",
      at: e,
      owner,
      color: seatColor(owner).hex,
      position: [m.x, m.z],
      // Rotating by yaw about +Y maps +X to (cos yaw, 0, −sin yaw); the path runs at `angle` in XZ.
      yaw: -m.angle,
      y,
    });
  });
  vertices.forEach((b, v) => {
    if (!b) return;
    items.push({
      key: `v${v}:${b.kind}`,
      kind: b.kind,
      assetKey: b.kind === "city" ? "piece.city" : "piece.settlement",
      at: v,
      owner: b.owner,
      color: seatColor(b.owner).hex,
      position: vertexPosition(v, topo),
      yaw: 0,
      y,
    });
  });
  return items;
}

/** Hit-area sizes in board units (1 = hex circumradius = one path length). */
export const VERTEX_TARGET_RADIUS = 0.18;
export const EDGE_TARGET_LENGTH = 0.62;
export const EDGE_TARGET_WIDTH = 0.16;
export const HEX_TARGET_RADIUS = 0.9;
/** Targets float just above the land so they are never hidden inside it. */
export const TARGET_LIFT = 0.03;

export interface TargetItem {
  /** `t-v12`, `t-e40`, `t-h7`. */
  readonly key: string;
  readonly target: TargetKind;
  readonly id: number;
  readonly position: XZ;
  readonly yaw: number;
  readonly y: number;
}

export function targetLayout(
  pick: Pick | null,
  relief: LandRelief,
  topo: Topology = STANDARD_TOPOLOGY,
): TargetItem[] {
  if (!pick) return [];
  const y = landTop(relief) + TARGET_LIFT;
  const ids = [...pick.targets].sort((a, b) => a - b);
  return ids.map((id) => {
    switch (pick.target) {
      case "vertex":
        return {
          key: `t-v${id}`,
          target: "vertex",
          id,
          position: vertexPosition(id, topo),
          yaw: 0,
          y,
        };
      case "edge": {
        const m = edgeMidpoint(id, topo);
        return { key: `t-e${id}`, target: "edge", id, position: [m.x, m.z], yaw: -m.angle, y };
      }
      case "hex":
        return { key: `t-h${id}`, target: "hex", id, position: hexCenter(id, topo), yaw: 0, y };
    }
  });
}
