// Procedural components per asset key, used when a key is unmapped, loading or failed.
import type { ComponentType } from "react";
import type { AssetKey } from "../keys.ts";
import type { FallbackProps } from "./common.tsx";
import * as Flat from "./flat/harbors.tsx";
import * as FlatTiles from "./flat/tiles.tsx";
import { TokenPiece as FlatToken } from "./flat/token.tsx";
import { BoatPiece } from "./boat.tsx";
import { DiePiece } from "./die.tsx";
import {
  BoulderPiece,
  BushPiece,
  CampPiece,
  CliffPiece,
  PeakPiece,
  SheepPiece,
  TreePiece,
  WallPiece,
  WoodsPiece,
} from "./coast.tsx";
import { GullPiece } from "./gull.tsx";
import { JettyPiece } from "./jetty.tsx";
import { CityPiece, RoadPiece, RobberPiece, SettlementPiece } from "./pieces.tsx";

export type { FallbackProps } from "./common.tsx";
export { BOAT_MAST, BOAT_SAIL } from "./boat.tsx";
export { JETTY_LENGTH } from "./jetty.tsx";
export {
  COAST_KEYS,
  type CoastKey,
  type PropPart,
  type PropVariant,
  coastFallbackVariants,
} from "./coast.tsx";
export { HARBOR_COLORS, type HarborKey } from "./flat/harbors.tsx";
export { SEA_COLOR, TERRAIN_COLORS, type TerrainKey } from "./flat/tiles.tsx";
export { TOKEN_COLOR } from "./flat/token.tsx";

type FallbackMap = Record<AssetKey, ComponentType<FallbackProps>>;

const PIECES = {
  "piece.road": RoadPiece,
  "piece.settlement": SettlementPiece,
  "piece.city": CityPiece,
  "piece.robber": RobberPiece,
  "dice.die": DiePiece,
  "prop.boat": BoatPiece,
  "prop.jetty": JettyPiece,
  "prop.boulder": BoulderPiece,
  "prop.cliff": CliffPiece,
  "prop.wall": WallPiece,
  "prop.tree": TreePiece,
  "prop.bush": BushPiece,
  "prop.sheep": SheepPiece,
  "prop.camp": CampPiece,
  "prop.woods": WoodsPiece,
  "prop.peak": PeakPiece,
  "prop.gull": GullPiece,
} as const;

/** Flat colored hexes, the token chip and badges (same shapes as themed images). */
export const FALLBACKS: FallbackMap = {
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
