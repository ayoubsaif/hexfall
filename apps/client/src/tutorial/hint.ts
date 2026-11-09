// Tutorial phase hint (openspec tutorial-mode-and-rules-guide, specs/tutorial-mode "Phase hint";
// design decision 4): what the viewer must or can do now, and the rules guide section that
// explains it. Mirrors the phase logic of game/status.ts `statusOf`. Pure.
import type { PlayerView } from "@hexfall/engine";
import type { RulesSection } from "../store/rulesGuide.ts";

export type HintKey =
  | "rollForOrder"
  | "rollForOrderWaiting"
  | "setupSettlement1"
  | "setupRoad1"
  | "setupSettlement2"
  | "setupRoad2"
  | "setupWaiting"
  | "rollFirst"
  | "main"
  | "waiting"
  | "discard"
  | "discardWaiting"
  | "robberSeven"
  | "robberKnight"
  | "robberWaiting"
  | "roadBuilding"
  | "roadBuildingWaiting"
  | "specialBuild"
  | "specialBuildWaiting";

export interface Hint {
  key: HintKey;
  /** Interpolation count (discard owed, free roads left). */
  count?: number;
  rulesSection: RulesSection;
}

/** The hint for the viewer now, or null once the game has ended. */
export function hintOf(view: PlayerView): Hint | null {
  const viewer = view.viewer;
  const mine = viewer !== null && viewer === view.turn.seat;
  const p = view.phase;
  switch (p.kind) {
    case "rollForOrder": {
      const waiting = viewer !== null && p.contenders.includes(viewer) && p.rolls[viewer] == null;
      return { key: waiting ? "rollForOrder" : "rollForOrderWaiting", rulesSection: "setup" };
    }
    case "setup": {
      const seat = p.order[p.index] ?? view.turn.seat;
      if (viewer !== seat) return { key: "setupWaiting", rulesSection: "setup" };
      const round = p.index < p.order.length / 2 ? 1 : 2;
      const step = p.step === "settlement" ? "setupSettlement" : "setupRoad";
      return { key: `${step}${round}`, rulesSection: "setup" };
    }
    case "turn":
      if (!mine) return { key: "waiting", rulesSection: "trading" };
      return view.turn.rolled
        ? { key: "main", rulesSection: "building" }
        : { key: "rollFirst", rulesSection: "turn" };
    case "discard": {
      const own = viewer === null ? 0 : (p.owed[viewer] ?? 0);
      return own > 0
        ? { key: "discard", count: own, rulesSection: "robber" }
        : { key: "discardWaiting", rulesSection: "robber" };
    }
    case "moveRobber":
      if (!mine) return { key: "robberWaiting", rulesSection: "robber" };
      return p.source === "knight"
        ? { key: "robberKnight", rulesSection: "devCards" }
        : { key: "robberSeven", rulesSection: "robber" };
    case "roadBuilding":
      return mine
        ? { key: "roadBuilding", count: p.remaining, rulesSection: "devCards" }
        : { key: "roadBuildingWaiting", rulesSection: "devCards" };
    case "specialBuild":
      return viewer === p.current
        ? { key: "specialBuild", rulesSection: "building" }
        : { key: "specialBuildWaiting", rulesSection: "building" };
    case "ended":
      return null;
  }
}
