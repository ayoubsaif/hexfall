// Order resource cards appear in across the HUD (hand, trade, dialogs, costs).
// Display only: the engine keeps its own RESOURCES order for seeded steals.
import type { Resource } from "@hexfall/engine";

export const CARD_ORDER: readonly Resource[] = Object.freeze([
  "lumber",
  "brick",
  "grain",
  "wool",
  "ore",
] as const);
