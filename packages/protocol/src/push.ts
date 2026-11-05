// Turn alerts shared by client and server (openspec change turn-sound-and-push):
// which wait the game has on a seat, and the Web Push payload the service worker reads.
import type { LegalActions } from "@hexfall/engine";
import { z } from "zod";

export const WaitKind = z.enum(["rollForOrder", "setup", "turn", "discard"]);
export type WaitKind = z.infer<typeof WaitKind>;

/** The seat's wait from its legal moves, or null (pass `ended` true once the game is over). */
export function waitKindOf(legal: LegalActions | null, ended = false): WaitKind | null {
  if (!legal || ended) return null;
  if (legal.rollForOrder) return "rollForOrder";
  if (legal.discard > 0) return "discard";
  if (legal.placeSettlement.length > 0 || legal.placeRoad.length > 0) return "setup";
  if (legal.rollDice) return "turn";
  return null;
}

/** JSON body of a turn push (game-server "Turn push delivery"). */
export const PushPayload = z.object({
  v: z.literal(1),
  kind: WaitKind,
  room: z.string(),
  lang: z.string(),
});
export type PushPayload = z.infer<typeof PushPayload>;
