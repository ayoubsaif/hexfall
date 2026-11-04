// Wire schema for engine actions (design.md decision 1). Mirrors engine `Action`
// without `seat`: the server fills in the seat bound to the connection.
import type { Action, LegalActions, PlayerView } from "@hexfall/engine";
import { z } from "zod";

const id = z.number().int().nonnegative();
export const ResourceSchema = z.enum(["brick", "grain", "lumber", "ore", "wool"]);
const count = z.number().int().nonnegative();
/** Partial resource record; unknown keys are rejected (exact engine `ResourceBundle` type). */
export const BundleSchema = z.partialRecord(ResourceSchema, count);

const a = <T extends string, S extends z.ZodRawShape>(type: T, shape: S) =>
  z.object({ type: z.literal(type), ...shape }).strict();

export const ClientActionSchema = z.discriminatedUnion("type", [
  a("rollForOrder", {}),
  a("placeSettlement", { vertex: id }),
  a("placeRoad", { edge: id }),
  a("rollDice", {}),
  a("discard", { cards: BundleSchema }),
  a("moveRobber", { hex: id, victim: id.nullable() }),
  a("buildRoad", { edge: id }),
  a("buildSettlement", { vertex: id }),
  a("buildCity", { vertex: id }),
  a("buyDevCard", {}),
  a("playKnight", {}),
  a("playRoadBuilding", {}),
  a("playYearOfPlenty", { resources: z.array(ResourceSchema).max(2) }),
  a("playMonopoly", { resource: ResourceSchema }),
  a("revealVictoryPoints", {}),
  a("proposeTrade", { give: BundleSchema, get: BundleSchema, to: z.array(id).max(3) }),
  a("acceptTrade", { offerId: id }),
  a("rejectTrade", { offerId: id }),
  a("cancelTrade", { offerId: id }),
  a("maritimeTrade", {
    give: ResourceSchema,
    get: ResourceSchema,
    count: z.number().int().positive().max(19),
  }),
  a("endTurn", {}),
]);

/** Engine action as sent by a client (no seat). */
export type ClientAction = z.infer<typeof ClientActionSchema>;

/** `Action` minus `seat`, distributed over the union. */
export type SeatlessAction = Action extends infer A
  ? A extends { seat: number }
    ? Omit<A, "seat">
    : never
  : never;

/** Server-computed objects: typed by the engine, decoded as plain objects. */
export const PlayerViewSchema = z.custom<PlayerView>(
  (v) => typeof v === "object" && v !== null && !Array.isArray(v),
  "expected a player view object",
);
export const LegalActionsSchema = z.custom<LegalActions>(
  (v) => typeof v === "object" && v !== null && !Array.isArray(v),
  "expected a legal actions object",
);
