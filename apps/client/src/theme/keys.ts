// The supported asset key set (specs/asset-theming, "Asset requests by key").
// Scene code requests assets only by these keys, never by file path.

export const ASSET_KEYS = [
  "tile.forest",
  "tile.pasture",
  "tile.fields",
  "tile.hills",
  "tile.mountains",
  "tile.desert",
  "sea",
  "token",
  "harbor.generic",
  "harbor.brick",
  "harbor.grain",
  "harbor.lumber",
  "harbor.ore",
  "harbor.wool",
  "piece.road",
  "piece.settlement",
  "piece.city",
  "piece.robber",
  "dice.die",
  "prop.boat",
  "prop.jetty",
  "prop.boulder",
  "prop.cliff",
  "prop.wall",
  "prop.tree",
  "prop.bush",
  "prop.sheep",
  "prop.camp",
  "prop.woods",
  "prop.peak",
  "prop.ore",
  "prop.gull",
] as const;

export type AssetKey = (typeof ASSET_KEYS)[number];

const KEY_SET: ReadonlySet<string> = new Set(ASSET_KEYS);

export function isAssetKey(value: string): value is AssetKey {
  return KEY_SET.has(value);
}

/**
 * Asset kinds (specs/asset-theming, "Asset kinds"): flat keys are drawn flat on the board
 * plane, optionally textured with an image; model keys are 3D, optionally a GLB.
 */
export type AssetKind = "flat" | "model";

export const ASSET_KIND: Readonly<Record<AssetKey, AssetKind>> = {
  "tile.forest": "flat",
  "tile.pasture": "flat",
  "tile.fields": "flat",
  "tile.hills": "flat",
  "tile.mountains": "flat",
  "tile.desert": "flat",
  sea: "flat",
  token: "flat",
  "harbor.generic": "flat",
  "harbor.brick": "flat",
  "harbor.grain": "flat",
  "harbor.lumber": "flat",
  "harbor.ore": "flat",
  "harbor.wool": "flat",
  "piece.road": "model",
  "piece.settlement": "model",
  "piece.city": "model",
  "piece.robber": "model",
  "dice.die": "model",
  "prop.boat": "model",
  "prop.jetty": "model",
  "prop.boulder": "model",
  "prop.cliff": "model",
  "prop.wall": "model",
  "prop.tree": "model",
  "prop.bush": "model",
  "prop.sheep": "model",
  "prop.camp": "model",
  "prop.woods": "model",
  "prop.peak": "model",
  "prop.ore": "model",
  "prop.gull": "model",
};

export function assetKind(key: AssetKey): AssetKind {
  return ASSET_KIND[key];
}

/** Keys tinted with the owning player's color. `piece.robber` and `dice.die` are never tinted. */
export const PLAYER_TINTED_KEYS = ["piece.road", "piece.settlement", "piece.city"] as const;

export function isPlayerTinted(key: AssetKey): boolean {
  return (PLAYER_TINTED_KEYS as readonly string[]).includes(key);
}

/** Name of the material that takes the player color in themed piece models. */
export const PLAYER_COLOR_MATERIAL = "PlayerColor";
