// Pure pick rules: what a click on a target sends (specs/board-interaction,
// "Picking sends one action", "Robber move and victim choice").
import type { ClientAction } from "@hexfall/protocol";
import type { Pick } from "../game/pick.ts";

import { dragThreshold } from "./gestures.ts";
import { wasMultiTouch } from "./useGestures.ts";

/** Pointer travel (px) above which a touch press is a camera drag, not a pick (mouse: 3). */
export const DRAG_THRESHOLD_PX = 6;

export type PickOutcome =
  | { kind: "send"; action: ClientAction }
  | { kind: "chooseVictim"; hex: number }
  | { kind: "none" };

/**
 * What picking target `id` does for `pick`. Pure, so the robber victim rules are testable:
 * no victims → victim null, one → that victim, several → the player chooses.
 */
export function pickOutcome(
  pick: Pick,
  id: number,
  robberVictims: (hex: number) => readonly number[] | undefined,
): PickOutcome {
  if (!pick.targets.has(id)) return { kind: "none" };
  switch (pick.kind) {
    case "placeSettlement":
    case "buildSettlement":
    case "buildCity":
      return { kind: "send", action: { type: pick.kind, vertex: id } };
    case "placeRoad":
    case "buildRoad":
      return { kind: "send", action: { type: pick.kind, edge: id } };
    case "moveRobber": {
      const victims = robberVictims(id) ?? [];
      if (victims.length > 1) return { kind: "chooseVictim", hex: id };
      return { kind: "send", action: { type: "moveRobber", hex: id, victim: victims[0] ?? null } };
    }
  }
}

/** True when a click ended a camera drag rather than a tap or click. */
export function isDrag(deltaPx: number, pointerType?: string): boolean {
  if (wasMultiTouch()) return true;
  return deltaPx > (pointerType === undefined ? DRAG_THRESHOLD_PX : dragThreshold(pointerType));
}
