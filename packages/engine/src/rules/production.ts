// Dice roll and resource production (AGENTS.md §6). Owner: flow agent.
import { TERRAIN_RESOURCE, type Resource } from "../board.ts";
import type { ActionOf, GameState, ResourceBundle, Seat } from "../state.ts";
import {
  RESOURCES,
  assertActive,
  assertPhase,
  emit,
  rollTwoDice,
  takeFromBank,
  topo,
} from "./common.ts";
import { check } from "./errors.ts";
import { startSeven } from "./robber.ts";

export function canRollDice(s: GameState, seat: Seat): boolean {
  return s.phase.kind === "turn" && s.turn.seat === seat && !s.turn.rolled;
}

/** Rolls, logs, then produces (non-7) or starts the robber sequence (7). */
export function rollDice(s: GameState, a: ActionOf<"rollDice">): void {
  assertPhase(s, "turn");
  assertActive(s, a.seat);
  check(!s.turn.rolled, "already_rolled", "the dice were already rolled this turn");
  const dice = rollTwoDice(s);
  const total = dice[0] + dice[1];
  s.turn.rolled = true;
  s.turn.dice = dice;
  emit(s, { type: "diceRolled", seat: a.seat, dice, total });
  if (total === 7) startSeven(s);
  else produce(s, total);
}

/** Pays production for a dice total, with the robber block and the bank-shortage rule. */
export function produce(s: GameState, total: number): void {
  if (total === 7) return;
  // owed[seat][resource]
  const owed: Record<Resource, number>[] = s.players.map(() => ({
    brick: 0,
    grain: 0,
    lumber: 0,
    ore: 0,
    wool: 0,
  }));
  s.board.hexes.forEach((hex, id) => {
    if (hex.token !== total || id === s.robber) return;
    const res = TERRAIN_RESOURCE[hex.terrain];
    if (!res) return;
    const info = topo(s).hexes[id];
    if (!info) return;
    for (const v of info.vertices) {
      const b = s.vertices[v];
      if (!b) continue;
      const row = owed[b.owner];
      if (row) row[res] += b.kind === "city" ? 2 : 1;
    }
  });

  const paid: ResourceBundle[] = s.players.map(() => ({}));
  for (const r of RESOURCES) {
    const claimants = owed.map((row, seat) => ({ seat, n: row[r] })).filter((c) => c.n > 0);
    if (claimants.length === 0) continue;
    const need = claimants.reduce((sum, c) => sum + c.n, 0);
    if (need <= s.bank[r]) {
      for (const c of claimants) paid[c.seat]![r] = c.n;
      continue;
    }
    emit(s, { type: "shortage", resource: r });
    // Only one player affected: they get whatever remains; otherwise nobody gets it.
    if (claimants.length === 1 && s.bank[r] > 0) paid[claimants[0]!.seat]![r] = s.bank[r];
  }
  paid.forEach((bundle, seat) => {
    if (Object.keys(bundle).length === 0) return;
    takeFromBank(s, seat, bundle);
    emit(s, { type: "produced", seat, resources: bundle });
  });
}
