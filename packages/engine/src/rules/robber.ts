// Rolling a 7: discard, move robber, steal (AGENTS.md §8, §13.7). Owner: flow agent.
import type { Resource } from "../board.ts";
import type { ActionOf, GameState, RobberOption, Seat } from "../state.ts";
import {
  RESOURCES,
  assertActive,
  assertPhase,
  cardTotal,
  emit,
  hasCards,
  normalizeBundle,
  isValidBundle,
  opponentsOnHex,
  payToBank,
  playerOf,
  randInt,
  topo,
} from "./common.ts";
import { check } from "./errors.ts";

/** After a rolled 7: enters discard if anyone holds 8+, else moveRobber. */
export function startSeven(s: GameState): void {
  const owed = s.players.map((p) => {
    const n = cardTotal(p.resources);
    return n > 7 ? Math.floor(n / 2) : 0;
  });
  s.phase = owed.some((n) => n > 0)
    ? { kind: "discard", owed }
    : { kind: "moveRobber", source: "seven" };
}

/** Cards the seat must still discard now (0 outside the discard phase). */
export function discardOwed(s: GameState, seat: Seat): number {
  return s.phase.kind === "discard" ? (s.phase.owed[seat] ?? 0) : 0;
}

/** Hexes the seat may move the robber to now, with victims (empty unless they must move it). */
export function robberOptions(s: GameState, seat: Seat): RobberOption[] {
  if (s.phase.kind !== "moveRobber" || s.turn.seat !== seat) return [];
  const out: RobberOption[] = [];
  for (const h of topo(s).hexes) {
    if (h.id === s.robber) continue;
    out.push({ hex: h.id, victims: opponentsOnHex(s, h.id, seat) });
  }
  return out;
}

export function discard(s: GameState, a: ActionOf<"discard">): void {
  assertPhase(s, "discard");
  if (s.phase.kind !== "discard") return;
  const phase = s.phase;
  const owed = phase.owed[a.seat] ?? 0;
  check(owed > 0, "invalid_discard", `seat ${a.seat} has nothing to discard`);
  check(isValidBundle(a.cards), "invalid_discard", "malformed discard");
  check(cardTotal(a.cards) === owed, "invalid_discard", `must discard exactly ${owed} cards`);
  check(
    hasCards(playerOf(s, a.seat).resources, a.cards),
    "invalid_discard",
    "cannot discard cards not held",
  );
  const cards = normalizeBundle(a.cards);
  payToBank(s, a.seat, cards);
  emit(s, { type: "discarded", seat: a.seat, resources: cards });
  phase.owed[a.seat] = 0;
  if (phase.owed.every((n) => n === 0)) s.phase = { kind: "moveRobber", source: "seven" };
}

/** Moves the robber, steals, then returns to phase turn. */
export function moveRobber(s: GameState, a: ActionOf<"moveRobber">): void {
  assertPhase(s, "moveRobber");
  assertActive(s, a.seat);
  check(
    Number.isInteger(a.hex) && a.hex >= 0 && a.hex < topo(s).hexes.length,
    "illegal_robber_hex",
    `no hex ${String(a.hex)}`,
  );
  check(a.hex !== s.robber, "illegal_robber_hex", "the robber must move to a different hex");
  const victims = opponentsOnHex(s, a.hex, a.seat);
  if (victims.length === 0) {
    check(a.victim === null, "illegal_victim", "no opponent to steal from on that hex");
  } else {
    check(
      a.victim !== null && victims.includes(a.victim),
      "illegal_victim",
      `victim must be one of ${victims.join(", ")}`,
    );
  }
  s.robber = a.hex;
  emit(s, { type: "robberMoved", seat: a.seat, hex: a.hex });
  if (a.victim !== null) {
    const victimHand = playerOf(s, a.victim).resources;
    const cards: Resource[] = [];
    for (const r of RESOURCES) for (let i = 0; i < victimHand[r]; i++) cards.push(r);
    let stolen: Resource | null = null;
    if (cards.length > 0) {
      stolen = cards[randInt(s, cards.length)]!;
      victimHand[stolen] -= 1;
      playerOf(s, a.seat).resources[stolen] += 1;
    }
    emit(s, { type: "stole", thief: a.seat, victim: a.victim, resource: stolen });
  }
  s.phase = { kind: "turn" };
}
