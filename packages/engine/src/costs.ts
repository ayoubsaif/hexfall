// Static cost data, shared by the rules and the client (via ./geometry). No logic here.
import type { Resource } from "./board.ts";
import type { ResourceBundle } from "./state.ts";

/** Fixed resource order (also the steal expansion order, design.md decision 5). */
export const RESOURCES: readonly Resource[] = Object.freeze([
  "brick",
  "grain",
  "lumber",
  "ore",
  "wool",
] as const);

/** Building costs (AGENTS.md §3). */
export const COSTS = Object.freeze({
  road: Object.freeze({ brick: 1, lumber: 1 }),
  settlement: Object.freeze({ brick: 1, lumber: 1, wool: 1, grain: 1 }),
  city: Object.freeze({ ore: 3, grain: 2 }),
  devCard: Object.freeze({ ore: 1, wool: 1, grain: 1 }),
}) satisfies Record<string, ResourceBundle>;
