// Procedural components per asset key, used when a key is unmapped, loading or failed.
// Flat-kind keys have one fallback per board style; piece keys are style-independent.
import type { ComponentType } from "react";
import type { AssetKey } from "../keys.ts";
import type { BoardStyle } from "../style.ts";
import type { FallbackProps } from "./common.tsx";
import * as Diorama from "./diorama/harbors.tsx";
import * as DioramaTiles from "./diorama/tiles.tsx";
import { TokenPiece as DioramaToken } from "./diorama/token.tsx";
import * as Flat from "./flat/harbors.tsx";
import * as FlatTiles from "./flat/tiles.tsx";
import { TokenPiece as FlatToken } from "./flat/token.tsx";
import { CityPiece, RoadPiece, RobberPiece, SettlementPiece } from "./pieces.tsx";

export type { FallbackProps } from "./common.tsx";
export { HARBOR_COLORS, type HarborKey } from "./flat/harbors.tsx";
export { SEA_COLOR, TERRAIN_COLORS, type TerrainKey } from "./flat/tiles.tsx";
export { TOKEN_COLOR } from "./flat/token.tsx";

type FallbackMap = Record<AssetKey, ComponentType<FallbackProps>>;

const PIECES = {
  "piece.road": RoadPiece,
  "piece.settlement": SettlementPiece,
  "piece.city": CityPiece,
  "piece.robber": RobberPiece,
} as const;

/** "flat" style: flat colored hexes, disc and badges (same shapes as themed images). */
export const FLAT_FALLBACKS: FallbackMap = {
  "tile.forest": FlatTiles.ForestTile,
  "tile.pasture": FlatTiles.PastureTile,
  "tile.fields": FlatTiles.FieldsTile,
  "tile.hills": FlatTiles.HillsTile,
  "tile.mountains": FlatTiles.MountainsTile,
  "tile.desert": FlatTiles.DesertTile,
  sea: FlatTiles.SeaTile,
  token: FlatToken,
  "harbor.generic": Flat.GenericHarbor,
  "harbor.brick": Flat.BrickHarbor,
  "harbor.grain": Flat.GrainHarbor,
  "harbor.lumber": Flat.LumberHarbor,
  "harbor.ore": Flat.OreHarbor,
  "harbor.wool": Flat.WoolHarbor,
  ...PIECES,
};

/** "3d" style: the diorama hex prisms with 3D props, the raised token and docks. */
export const DIORAMA_FALLBACKS: FallbackMap = {
  "tile.forest": DioramaTiles.ForestTile,
  "tile.pasture": DioramaTiles.PastureTile,
  "tile.fields": DioramaTiles.FieldsTile,
  "tile.hills": DioramaTiles.HillsTile,
  "tile.mountains": DioramaTiles.MountainsTile,
  "tile.desert": DioramaTiles.DesertTile,
  sea: DioramaTiles.SeaTile,
  token: DioramaToken,
  "harbor.generic": Diorama.GenericHarbor,
  "harbor.brick": Diorama.BrickHarbor,
  "harbor.grain": Diorama.GrainHarbor,
  "harbor.lumber": Diorama.LumberHarbor,
  "harbor.ore": Diorama.OreHarbor,
  "harbor.wool": Diorama.WoolHarbor,
  ...PIECES,
};

export const FALLBACKS: Readonly<Record<BoardStyle, FallbackMap>> = {
  flat: FLAT_FALLBACKS,
  "3d": DIORAMA_FALLBACKS,
};
