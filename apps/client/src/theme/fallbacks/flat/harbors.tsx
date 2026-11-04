// Harbors: a flat rounded badge on the marker layer, one distinct color per harbor type.
// The board view draws the ratio label and the links to the slot's intersections.
import { FlatShape } from "../../flat.tsx";

export type HarborKey =
  | "harbor.generic"
  | "harbor.brick"
  | "harbor.grain"
  | "harbor.lumber"
  | "harbor.ore"
  | "harbor.wool";

/** Fallback color per harbor type; pairwise distinct. Generic (3:1) is cream. */
export const HARBOR_COLORS: Readonly<Record<HarborKey, string>> = {
  "harbor.generic": "#f4efe1",
  "harbor.brick": "#b4532f",
  "harbor.grain": "#e0b83c",
  "harbor.lumber": "#2f6b34",
  "harbor.ore": "#6f747c",
  "harbor.wool": "#a5d46a",
};

export const GenericHarbor = () => (
  <FlatShape assetKey="harbor.generic" color={HARBOR_COLORS["harbor.generic"]} />
);
export const BrickHarbor = () => (
  <FlatShape assetKey="harbor.brick" color={HARBOR_COLORS["harbor.brick"]} />
);
export const GrainHarbor = () => (
  <FlatShape assetKey="harbor.grain" color={HARBOR_COLORS["harbor.grain"]} />
);
export const LumberHarbor = () => (
  <FlatShape assetKey="harbor.lumber" color={HARBOR_COLORS["harbor.lumber"]} />
);
export const OreHarbor = () => (
  <FlatShape assetKey="harbor.ore" color={HARBOR_COLORS["harbor.ore"]} />
);
export const WoolHarbor = () => (
  <FlatShape assetKey="harbor.wool" color={HARBOR_COLORS["harbor.wool"]} />
);
