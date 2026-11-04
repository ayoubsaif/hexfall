// Procedural terrain and sea hexes: flat pointy-top hexes in a key color, no 3D props.
// The themed image (when mapped) is drawn on the very same shape (see ../flat.tsx).
import { FlatShape } from "../../flat.tsx";

export type TerrainKey =
  | "tile.forest"
  | "tile.pasture"
  | "tile.fields"
  | "tile.hills"
  | "tile.mountains"
  | "tile.desert";

/** Fallback color per terrain; pairwise distinct so terrains stay distinguishable. */
export const TERRAIN_COLORS: Readonly<Record<TerrainKey, string>> = {
  "tile.forest": "#3f7d3a",
  "tile.pasture": "#9ccc65",
  "tile.fields": "#e3c35a",
  "tile.hills": "#c4683f",
  "tile.mountains": "#8b8f96",
  "tile.desert": "#ead6a0",
};

export const SEA_COLOR = "#2f86c2";

export const ForestTile = () => (
  <FlatShape assetKey="tile.forest" color={TERRAIN_COLORS["tile.forest"]} />
);
export const PastureTile = () => (
  <FlatShape assetKey="tile.pasture" color={TERRAIN_COLORS["tile.pasture"]} />
);
export const FieldsTile = () => (
  <FlatShape assetKey="tile.fields" color={TERRAIN_COLORS["tile.fields"]} />
);
export const HillsTile = () => (
  <FlatShape assetKey="tile.hills" color={TERRAIN_COLORS["tile.hills"]} />
);
export const MountainsTile = () => (
  <FlatShape assetKey="tile.mountains" color={TERRAIN_COLORS["tile.mountains"]} />
);
export const DesertTile = () => (
  <FlatShape assetKey="tile.desert" color={TERRAIN_COLORS["tile.desert"]} />
);
export const SeaTile = () => <FlatShape assetKey="sea" color={SEA_COLOR} />;
