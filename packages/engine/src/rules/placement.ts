// Building legality and build handlers (AGENTS.md §7, §13.3-4, §13.11). Owner: board agent.
import type { ActionOf, GameState, Seat } from "../state.ts";
import type { EdgeId, VertexId } from "../topology.ts";
import {
  COSTS,
  assertMayBuild,
  emit,
  hasCards,
  mayBuildNow,
  payToBank,
  playerOf,
  topo,
} from "./common.ts";
import { check } from "./errors.ts";
import { updateLongestRoad } from "./longestRoad.ts";

function isEdgeId(s: GameState, e: unknown): e is EdgeId {
  return typeof e === "number" && Number.isInteger(e) && e >= 0 && e < topo(s).edges.length;
}

function isVertexId(s: GameState, v: unknown): v is VertexId {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v < topo(s).vertices.length;
}

/** True if `seat` has a road on one of `v`'s paths. */
function touchesOwnRoad(s: GameState, seat: Seat, v: VertexId): boolean {
  return topo(s).vertices[v]!.edges.some((e) => s.edges[e] === seat);
}

/** True if a new road of `seat` ending at `v` joins the seat's network there. */
function connectsAt(s: GameState, seat: Seat, v: VertexId): boolean {
  const b = s.vertices[v];
  if (b) return b.owner === seat; // an opponent's building blocks this end
  return touchesOwnRoad(s, seat, v);
}

function roadLegal(s: GameState, seat: Seat, e: EdgeId): boolean {
  if (s.edges[e] != null) return false;
  const [a, b] = topo(s).edges[e]!.vertices;
  return connectsAt(s, seat, a) || connectsAt(s, seat, b);
}

function settlementLegal(s: GameState, seat: Seat, v: VertexId): boolean {
  return canPlaceSettlementAt(s, v) && touchesOwnRoad(s, seat, v);
}

function cityLegal(s: GameState, seat: Seat, v: VertexId): boolean {
  const b = s.vertices[v];
  return !!b && b.owner === seat && b.kind === "settlement";
}

/** Empty intersection whose neighbors are all empty (Distance Rule, every player). */
export function canPlaceSettlementAt(s: GameState, v: VertexId): boolean {
  if (!isVertexId(s, v) || s.vertices[v]) return false;
  return topo(s).vertices[v]!.neighbors.every((n) => !s.vertices[n]);
}

/** Empty paths connected to the seat's network (own road, settlement or city), never only through an intersection holding an opponent's building. Topology only: ignores phase, cost and pieces. Ascending. */
export function connectedRoadEdges(s: GameState, seat: Seat): EdgeId[] {
  const out: EdgeId[] = [];
  for (let e = 0; e < topo(s).edges.length; e++) if (roadLegal(s, seat, e)) out.push(e);
  return out;
}

/** Paid roads the seat may build right now (build window, cost, pieces), ascending. */
export function buildableRoads(s: GameState, seat: Seat): EdgeId[] {
  if (!mayBuildNow(s, seat)) return [];
  const p = s.players[seat];
  if (!p || p.pieces.roads <= 0 || !hasCards(p.resources, COSTS.road)) return [];
  return connectedRoadEdges(s, seat);
}

/** Settlements the seat may build right now, ascending. */
export function buildableSettlements(s: GameState, seat: Seat): VertexId[] {
  if (!mayBuildNow(s, seat)) return [];
  const p = s.players[seat];
  if (!p || p.pieces.settlements <= 0 || !hasCards(p.resources, COSTS.settlement)) return [];
  const out: VertexId[] = [];
  for (let v = 0; v < topo(s).vertices.length; v++) if (settlementLegal(s, seat, v)) out.push(v);
  return out;
}

/** Own settlements the seat may upgrade right now, ascending. */
export function buildableCities(s: GameState, seat: Seat): VertexId[] {
  if (!mayBuildNow(s, seat)) return [];
  const p = s.players[seat];
  if (!p || p.pieces.cities <= 0 || !hasCards(p.resources, COSTS.city)) return [];
  const out: VertexId[] = [];
  for (let v = 0; v < topo(s).vertices.length; v++) if (cityLegal(s, seat, v)) out.push(v);
  return out;
}

/** Places a road without validation or payment: supply - 1, emit built, update Longest Road. */
export function putRoad(s: GameState, seat: Seat, edge: EdgeId, free: boolean): void {
  s.edges[edge] = seat;
  playerOf(s, seat).pieces.roads--;
  emit(s, { type: "built", seat, piece: "road", at: edge, free });
  updateLongestRoad(s);
}

/** Places a settlement without validation or payment: supply - 1, emit built, update Longest Road. */
export function putSettlement(s: GameState, seat: Seat, vertex: VertexId, free: boolean): void {
  s.vertices[vertex] = { owner: seat, kind: "settlement" };
  playerOf(s, seat).pieces.settlements--;
  emit(s, { type: "built", seat, piece: "settlement", at: vertex, free });
  updateLongestRoad(s);
}

export function buildRoad(s: GameState, a: ActionOf<"buildRoad">): void {
  assertMayBuild(s, a.seat);
  check(isEdgeId(s, a.edge), "invalid_action", `no path ${String(a.edge)}`);
  check(playerOf(s, a.seat).pieces.roads > 0, "no_pieces", "no roads left");
  check(roadLegal(s, a.seat, a.edge), "illegal_placement", `cannot build a road on ${a.edge}`);
  payToBank(s, a.seat, COSTS.road);
  putRoad(s, a.seat, a.edge, false);
}

export function buildSettlement(s: GameState, a: ActionOf<"buildSettlement">): void {
  assertMayBuild(s, a.seat);
  check(isVertexId(s, a.vertex), "invalid_action", `no intersection ${String(a.vertex)}`);
  check(playerOf(s, a.seat).pieces.settlements > 0, "no_pieces", "no settlements left");
  check(
    settlementLegal(s, a.seat, a.vertex),
    "illegal_placement",
    `cannot build a settlement on ${a.vertex}`,
  );
  payToBank(s, a.seat, COSTS.settlement);
  putSettlement(s, a.seat, a.vertex, false);
}

export function buildCity(s: GameState, a: ActionOf<"buildCity">): void {
  assertMayBuild(s, a.seat);
  check(isVertexId(s, a.vertex), "invalid_action", `no intersection ${String(a.vertex)}`);
  const p = playerOf(s, a.seat);
  check(p.pieces.cities > 0, "no_pieces", "no cities left");
  check(
    cityLegal(s, a.seat, a.vertex),
    "illegal_placement",
    `no own settlement on ${a.vertex} to upgrade`,
  );
  payToBank(s, a.seat, COSTS.city);
  s.vertices[a.vertex] = { owner: a.seat, kind: "city" };
  p.pieces.cities--;
  p.pieces.settlements++;
  emit(s, { type: "built", seat: a.seat, piece: "city", at: a.vertex, free: false });
}
