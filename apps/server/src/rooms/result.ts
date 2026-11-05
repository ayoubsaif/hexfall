// Early-end result (openspec change pause-and-resume-games, specs/early-end): totals every
// seat's VP, hidden VP cards included; every seat tied for the most VP wins. Not a game
// rule: the engine state is never changed by an early end.
import { hiddenVp, publicVp, type GameState } from "@hexfall/engine";
import type { EarlyResult } from "@hexfall/protocol";

export function earlyResult(state: GameState, at: number): EarlyResult {
  const scores = state.players.map((_, seat) => {
    const hidden = hiddenVp(state, seat);
    return { seat, vp: publicVp(state, seat) + hidden, hiddenVp: hidden };
  });
  const best = Math.max(...scores.map((s) => s.vp));
  return {
    reason: "host",
    at,
    winners: scores.filter((s) => s.vp === best).map((s) => s.seat),
    scores,
  };
}
