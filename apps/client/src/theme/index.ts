// Public surface of the theme layer. Scene code imports only from here.
export { Asset, type AssetProps, useAsset } from "./Asset.tsx";
export { useTheme } from "./context.ts";
export {
  CHIP,
  CHIP_HEIGHT,
  FLAT_LAYER,
  HARBOR_BADGE_CORNER,
  HARBOR_BADGE_SIZE,
  HEX_RADIUS,
  TOKEN_RADIUS,
} from "./flat.tsx";
export { DIE_EDGE, DIE_FACE_AXES, DIE_VALUES, type Axis, type DieValue } from "./die.ts";
export { ASSET_KEYS, type AssetKey, type AssetKind, assetKind } from "./keys.ts";
export {
  ISO_ELEVATION_DEG,
  ISO_IMAGE_HEIGHT,
  ISO_IMAGE_WIDTH,
  ISO_SIDE_HEIGHT,
  ISO_THICKNESS,
  LAND_THICKNESS,
  SEA_DEPTH,
  domeHeight,
  type LandRelief,
  type Projection,
} from "./relief.ts";
export { ThemeProvider } from "./ThemeProvider.tsx";
export { useLandRelief } from "./useLandRelief.ts";
