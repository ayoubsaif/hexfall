// Pure board layout model: what BoardView draws and where (specs/board-view).
// All positions come from the engine's board geometry; no coordinate math is duplicated.
import type { Board, HarborType } from "@hexfall/engine";
import {
  TOPOLOGY,
  edgeMidpoint,
  edgeOutward,
  hexCenter,
  hexToWorld,
  vertexPosition,
} from "@hexfall/engine/geometry";
import type { AssetKey } from "../theme/index.ts";

export type XZ = readonly [number, number];

/** Badge distance from its slot path's midpoint, along the outward direction. */
export const HARBOR_OFFSET = 0.55;
/** Robber offset from the hex center when it shares the hex with a token. */
export const ROBBER_TOKEN_OFFSET: XZ = [-0.45, 0.3];

export interface Link {
  /** Center of the strip. */
  readonly mid: XZ;
  readonly length: number;
  /** Rotation about +Y that turns local +X along the strip. */
  readonly yaw: number;
}

export interface TileItem {
  readonly kind: "tile";
  readonly key: string;
  readonly hex: number;
  readonly assetKey: AssetKey;
  readonly position: XZ;
}
export interface SeaItem {
  readonly kind: "sea";
  readonly key: string;
  readonly position: XZ;
}
export interface TokenItem {
  readonly kind: "token";
  readonly key: string;
  readonly hex: number;
  readonly value: number;
  readonly position: XZ;
}
export interface HarborItem {
  readonly kind: "harbor";
  readonly key: string;
  readonly slot: number;
  readonly type: HarborType;
  readonly assetKey: AssetKey;
  readonly position: XZ;
  /** The slot path's two intersections. */
  readonly ends: readonly [XZ, XZ];
  readonly links: readonly [Link, Link];
}
export interface RobberItem {
  readonly kind: "robber";
  readonly key: string;
  readonly hex: number;
  readonly position: XZ;
}

export interface BoardLayout {
  readonly tiles: readonly TileItem[];
  readonly sea: readonly SeaItem[];
  readonly tokens: readonly TokenItem[];
  readonly harbors: readonly HarborItem[];
  readonly robber: RobberItem;
}

function link(from: XZ, to: XZ): Link {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  return {
    mid: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
    length: Math.hypot(dx, dz),
    // Rotating by yaw about +Y maps +X to (cos yaw, 0, −sin yaw).
    yaw: Math.atan2(-dz, dx),
  };
}

export function harborAssetKey(type: HarborType): AssetKey {
  return type === "generic" ? "harbor.generic" : `harbor.${type}`;
}

/** `robberHex` defaults to the board's own robber hex (the preview); a live game passes the view's. */
export function boardLayout(board: Board, robberHex: number = board.robber): BoardLayout {
  const tiles: TileItem[] = [];
  const tokens: TokenItem[] = [];
  for (const info of TOPOLOGY.hexes) {
    const hex = board.hexes[info.id];
    if (!hex) continue;
    const position = hexCenter(info.id);
    tiles.push({
      kind: "tile",
      key: `hex-${info.id}`,
      hex: info.id,
      assetKey: `tile.${hex.terrain}`,
      position,
    });
    if (hex.token !== null) {
      tokens.push({
        kind: "token",
        key: `token-${info.id}`,
        hex: info.id,
        value: hex.token,
        position,
      });
    }
  }

  const sea: SeaItem[] = TOPOLOGY.seaRing.map(({ q, r }) => ({
    kind: "sea",
    key: `sea-${q},${r}`,
    position: hexToWorld(q, r),
  }));

  const harbors: HarborItem[] = [];
  TOPOLOGY.harborSlots.forEach((edge, slot) => {
    const type = board.harbors[slot];
    const info = TOPOLOGY.edges[edge];
    if (!type || !info) return;
    const m = edgeMidpoint(edge);
    const [ox, oz] = edgeOutward(edge);
    const position: XZ = [m.x + ox * HARBOR_OFFSET, m.z + oz * HARBOR_OFFSET];
    const ends: [XZ, XZ] = [vertexPosition(info.vertices[0]), vertexPosition(info.vertices[1])];
    harbors.push({
      kind: "harbor",
      key: `harbor-${slot}`,
      slot,
      type,
      assetKey: harborAssetKey(type),
      position,
      ends,
      links: [link(position, ends[0]), link(position, ends[1])],
    });
  });

  const [cx, cz] = hexCenter(robberHex);
  const robberHasToken = board.hexes[robberHex]?.token != null;
  const [rx, rz] = robberHasToken ? ROBBER_TOKEN_OFFSET : [0, 0];
  const robber: RobberItem = {
    kind: "robber",
    key: "robber",
    hex: robberHex,
    position: [cx + rx, cz + rz],
  };

  return { tiles, sea, tokens, harbors, robber };
}
