// Roll for order and the setup snake (AGENTS.md §4c, §13.2). Owner: flow agent.
import { TERRAIN_RESOURCE } from "../board.ts";
import type { ActionOf, GameState, ResourceBundle, Seat } from "../state.ts";
import { TOPOLOGY, type EdgeId, type VertexId } from "../topology.ts";
import {
  assertActive,
  assertPhase,
  emit,
  normalizeBundle,
  rollTwoDice,
  takeFromBank,
} from "./common.ts";
import { check } from "./errors.ts";
import { canPlaceSettlementAt, putRoad, putSettlement } from "./placement.ts";

/** Enters the setup phase with startingSeat first (emits startingPlayer). */
export function beginSetup(s: GameState, startingSeat: Seat): void {
  emit(s, { type: "startingPlayer", seat: startingSeat });
  const round1: Seat[] = [];
  for (let i = 0; i < s.playerCount; i++) round1.push((startingSeat + i) % s.playerCount);
  const order = [...round1, ...[...round1].reverse()];
  s.phase = { kind: "setup", order, index: 0, step: "settlement", lastSettlement: null };
  s.turn = { seat: startingSeat, number: 0, rolled: false, devPlayed: false, dice: null };
}

export function canRollForOrder(s: GameState, seat: Seat): boolean {
  return s.phase.kind === "rollForOrder" && s.turn.seat === seat;
}

/** Setup settlement spots for the seat right now (empty unless it is their settlement step). */
export function legalSetupSettlements(s: GameState, seat: Seat): VertexId[] {
  if (s.phase.kind !== "setup" || s.phase.step !== "settlement" || s.turn.seat !== seat) return [];
  return TOPOLOGY.vertices.map((v) => v.id).filter((v) => canPlaceSettlementAt(s, v));
}

/** Setup road paths for the seat right now (touching the settlement just placed). */
export function legalSetupRoads(s: GameState, seat: Seat): EdgeId[] {
  if (s.phase.kind !== "setup" || s.phase.step !== "road" || s.turn.seat !== seat) return [];
  const last = s.phase.lastSettlement;
  if (last === null) return [];
  const info = TOPOLOGY.vertices[last];
  if (!info) return [];
  return info.edges.filter((e) => s.edges[e] === null).sort((a, b) => a - b);
}

export function rollForOrder(s: GameState, a: ActionOf<"rollForOrder">): void {
  assertPhase(s, "rollForOrder");
  assertActive(s, a.seat);
  if (s.phase.kind !== "rollForOrder") return;
  const phase = s.phase;
  const dice = rollTwoDice(s);
  phase.rolls[a.seat] = dice[0] + dice[1];
  emit(s, { type: "orderRolled", seat: a.seat, dice });

  const next = phase.contenders.find((c) => phase.rolls[c] === null);
  if (next !== undefined) {
    s.turn.seat = next;
    return;
  }
  const best = Math.max(...phase.contenders.map((c) => phase.rolls[c] ?? 0));
  const top = phase.contenders.filter((c) => phase.rolls[c] === best);
  if (top.length === 1) {
    beginSetup(s, top[0]!);
    return;
  }
  emit(s, { type: "orderTied", seats: top });
  phase.contenders = top;
  for (const c of top) phase.rolls[c] = null;
  s.turn.seat = top[0]!;
}

export function placeSettlement(s: GameState, a: ActionOf<"placeSettlement">): void {
  assertPhase(s, "setup");
  assertActive(s, a.seat);
  if (s.phase.kind !== "setup") return;
  const phase = s.phase;
  check(phase.step === "settlement", "wrong_phase", "place a road first");
  check(
    Number.isInteger(a.vertex) && a.vertex >= 0 && a.vertex < TOPOLOGY.vertices.length,
    "illegal_placement",
    `no intersection ${String(a.vertex)}`,
  );
  check(canPlaceSettlementAt(s, a.vertex), "illegal_placement", "intersection not available");
  putSettlement(s, a.seat, a.vertex, true);
  if (phase.index >= s.playerCount) {
    const gain: ResourceBundle = {};
    for (const h of TOPOLOGY.vertices[a.vertex]?.hexes ?? []) {
      const hex = s.board.hexes[h];
      const r = hex ? TERRAIN_RESOURCE[hex.terrain] : null;
      if (r) gain[r] = (gain[r] ?? 0) + 1;
    }
    const resources = normalizeBundle(gain);
    if (Object.keys(resources).length > 0) {
      takeFromBank(s, a.seat, resources);
      emit(s, { type: "startingResources", seat: a.seat, resources });
    }
  }
  phase.step = "road";
  phase.lastSettlement = a.vertex;
}

export function placeRoad(s: GameState, a: ActionOf<"placeRoad">): void {
  assertPhase(s, "setup");
  assertActive(s, a.seat);
  if (s.phase.kind !== "setup") return;
  const phase = s.phase;
  check(phase.step === "road", "wrong_phase", "place a settlement first");
  check(
    legalSetupRoads(s, a.seat).includes(a.edge),
    "illegal_placement",
    "the road must touch the settlement just placed",
  );
  putRoad(s, a.seat, a.edge, true);
  phase.index++;
  if (phase.index === phase.order.length) {
    const first = phase.order[0]!;
    s.phase = { kind: "turn" };
    s.turn = { seat: first, number: 1, rolled: false, devPlayed: false, dice: null };
    emit(s, { type: "turnStarted", seat: first, number: 1 });
    return;
  }
  phase.step = "settlement";
  phase.lastSettlement = null;
  s.turn.seat = phase.order[phase.index]!;
}
