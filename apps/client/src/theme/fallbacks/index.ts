// One procedural component per asset key. Used when a key is unmapped, loading or failed.
import type { ComponentType } from "react";
import type { AssetKey } from "../keys.ts";
import type { FallbackProps } from "./common.tsx";
import {
  BrickHarbor,
  GenericHarbor,
  GrainHarbor,
  LumberHarbor,
  OreHarbor,
  WoolHarbor,
} from "./harbors.tsx";
import { CityPiece, RoadPiece, RobberPiece, SettlementPiece } from "./pieces.tsx";
import {
  DesertTile,
  FieldsTile,
  ForestTile,
  HillsTile,
  MountainsTile,
  PastureTile,
  SeaTile,
} from "./tiles.tsx";
import { TokenPiece } from "./token.tsx";

export type { FallbackProps } from "./common.tsx";

export const FALLBACKS: Record<AssetKey, ComponentType<FallbackProps>> = {
  "tile.forest": ForestTile,
  "tile.pasture": PastureTile,
  "tile.fields": FieldsTile,
  "tile.hills": HillsTile,
  "tile.mountains": MountainsTile,
  "tile.desert": DesertTile,
  sea: SeaTile,
  token: TokenPiece,
  "harbor.generic": GenericHarbor,
  "harbor.brick": BrickHarbor,
  "harbor.grain": GrainHarbor,
  "harbor.lumber": LumberHarbor,
  "harbor.ore": OreHarbor,
  "harbor.wool": WoolHarbor,
  "piece.road": RoadPiece,
  "piece.settlement": SettlementPiece,
  "piece.city": CityPiece,
  "piece.robber": RobberPiece,
};
