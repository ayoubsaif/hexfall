// Isometric tile support (specs/asset-theming, "Isometric tile images"). An isometric
// hex image is painted as seen from ISO_ELEVATION_DEG above the board, looking toward
// row 1. Its top face is a pointy-top hex squashed vertically; under it is an earth band
// for the two side faces that face the viewer. The board draws such tiles as raised
// prisms so the band shows along the coast, and lowers the sea by the prism height.
import type { AssetKey } from "./keys.ts";
import type { ResolvedEntries } from "./manifest.ts";

/** Camera elevation the art is painted for (and the board camera uses). */
export const ISO_ELEVATION_DEG = 60;
/** Image size in pixels at the reference resolution (any size with the same ratio works). */
export const ISO_IMAGE_WIDTH = 1024;
/** Height of the top face's bounding box in the image: 2·R·sin(60°) = width exactly. */
export const ISO_TOP_HEIGHT = 1024;
/** Height of the earth band under the top face. */
export const ISO_SIDE_HEIGHT = 64;
export const ISO_IMAGE_HEIGHT = ISO_TOP_HEIGHT + ISO_SIDE_HEIGHT; // 1088

/** Hex circumradius in image pixels: the hex is √3·R wide. */
const R_PX = ISO_IMAGE_WIDTH / Math.sqrt(3);

/**
 * Prism height in board units (1 = hex circumradius) that the earth band shows at the
 * reference elevation: band px = t · R_px · cos(elevation).
 */
export const ISO_THICKNESS =
  ISO_SIDE_HEIGHT / (R_PX * Math.cos((ISO_ELEVATION_DEG * Math.PI) / 180));

/** Image pixel of a point (x, z) on a hex's top face, hex centered at the origin. */
export function isoTopPixel(x: number, z: number): [number, number] {
  const sin = Math.sin((ISO_ELEVATION_DEG * Math.PI) / 180);
  return [ISO_IMAGE_WIDTH / 2 + x * R_PX, ISO_TOP_HEIGHT / 2 + z * R_PX * sin];
}

/** Texture UV (v up, three.js convention) of an image pixel. */
export function pixelUv(px: number, py: number): [number, number] {
  return [px / ISO_IMAGE_WIDTH, 1 - py / ISO_IMAGE_HEIGHT];
}

/** Height of a land block from its top (y = 0) down to its base: tall, rounded terrain. */
export const LAND_THICKNESS = 0.4;
/** How far the sea surface sits below the land tops (the block shows this much above water). */
export const SEA_DEPTH = 0.14;
/** Radius of the rounded rim where a land top curves down into its sides. */
export const LAND_ROUNDING = 0.09;

/**
 * Height of the gentle dome at a land hex's center, per terrain. It falls to zero toward the
 * edges and corners (ρ ≥ DOME_RADIUS), so roads, settlements and cities keep standing on y = 0.
 */
export const DOME_AMPLITUDE: Readonly<Record<string, number>> = {
  "tile.mountains": 0.24,
  "tile.hills": 0.15,
  "tile.forest": 0.09,
  "tile.pasture": 0.05,
  "tile.fields": 0.025,
  "tile.desert": 0.05,
};
/** Distance from the hex center (circumradius 1) at which the dome has fallen to zero. */
export const DOME_RADIUS = 0.9;

/** Dome height of terrain `assetKey` at distance ρ from the hex center. */
export function domeHeight(assetKey: string, rho: number): number {
  const a = DOME_AMPLITUDE[assetKey] ?? 0;
  if (rho >= DOME_RADIUS) return 0;
  const u = 1 - (rho / DOME_RADIUS) ** 2;
  return a * u * u;
}

export type Projection = "top" | "isometric";

const LAND_KEYS: readonly AssetKey[] = [
  "tile.forest",
  "tile.pasture",
  "tile.fields",
  "tile.hills",
  "tile.mountains",
  "tile.desert",
];

export interface LandRelief {
  /** Land tiles are prisms whose top stays at y = 0; the sea sits lower. */
  raised: boolean;
  /** Terrain images are isometric: the camera keeps near the art's view and turns only a little. */
  isometric?: boolean;
  /** Prism height (0 when not raised). */
  thickness: number;
  /** Height of the sea surface and of everything drawn on it (harbors). */
  seaLevel: number;
}

const FLAT_RELIEF: LandRelief = { raised: false, thickness: 0, seaLevel: 0 };

/**
 * The island is raised (tall rounded land blocks over a lowered sea) when any terrain key uses
 * an image, top-down or isometric; themes with only procedural terrain stay flat.
 * Pure, so it is unit-testable; `useLandRelief` binds it to the active theme.
 */
export function landRelief(entries: ResolvedEntries): LandRelief {
  const images = LAND_KEYS.map((k) => entries[k]).filter((e) => e?.kind === "image");
  if (images.length === 0) return FLAT_RELIEF;
  const isometric = images.some((e) => e?.kind === "image" && e.projection === "isometric");
  return { raised: true, isometric, thickness: LAND_THICKNESS, seaLevel: -SEA_DEPTH };
}
