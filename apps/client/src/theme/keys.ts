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
] as const;

export type AssetKey = (typeof ASSET_KEYS)[number];

const KEY_SET: ReadonlySet<string> = new Set(ASSET_KEYS);

export function isAssetKey(value: string): value is AssetKey {
  return KEY_SET.has(value);
}

/** Keys tinted with the owning player's color. `piece.robber` is never tinted. */
export const PLAYER_TINTED_KEYS = ["piece.road", "piece.settlement", "piece.city"] as const;

export function isPlayerTinted(key: AssetKey): boolean {
  return (PLAYER_TINTED_KEYS as readonly string[]).includes(key);
}

/** Name of the material that takes the player color in themed piece models. */
export const PLAYER_COLOR_MATERIAL = "PlayerColor";
