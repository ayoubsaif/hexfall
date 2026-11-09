// Longest Road (AGENTS.md §10a, §13.5, design.md decision 7). Owner: board agent.
import type { GameState, Seat } from "../state.ts";
import type { EdgeId, VertexId } from "../topology.ts";
import { emit, topo } from "./common.ts";

/** Minimum length for the card. */
const MIN_LONGEST_ROAD = 5;

/** True if a trail of `seat` may continue through `v` (no opponent building there). */
function passable(s: GameState, seat: Seat, v: VertexId): boolean {
  const b = s.vertices[v];
  return !b || b.owner === seat;
}

/** Longest extension from `v` over the seat's unvisited roads. */
function extend(s: GameState, seat: Seat, v: VertexId, visited: Set<EdgeId>): number {
  if (!passable(s, seat, v)) return 0;
  let best = 0;
  for (const e of topo(s).vertices[v]!.edges) {
    if (s.edges[e] !== seat || visited.has(e)) continue;
    const [a, b] = topo(s).edges[e]!.vertices;
    visited.add(e);
    best = Math.max(best, 1 + extend(s, seat, a === v ? b : a, visited));
    visited.delete(e);
  }
  return best;
}

/** Longest trail of the seat's roads, each segment once, broken by opponents' buildings. */
export function longestRoadLength(s: GameState, seat: Seat): number {
  let best = 0;
  for (let e = 0; e < s.edges.length; e++) {
    if (s.edges[e] !== seat) continue;
    const [a, b] = topo(s).edges[e]!.vertices;
    // Every trail has a first segment e; walking from e away from either end
    // covers all trails that start with e.
    const visited = new Set<EdgeId>([e]);
    best = Math.max(best, 1 + extend(s, seat, b, visited), 1 + extend(s, seat, a, visited));
  }
  return best;
}

/** Recomputes every player's length and moves or sets aside the card, emitting longestRoad on change. */
export function updateLongestRoad(s: GameState): void {
  const lengths: number[] = [];
  for (let seat = 0; seat < s.playerCount; seat++) lengths.push(longestRoadLength(s, seat));
  const max = Math.max(0, ...lengths);
  const holder = s.longestRoad;
  let next: Seat | null;
  if (holder !== null && lengths[holder] === max && max >= MIN_LONGEST_ROAD) {
    next = holder;
  } else {
    const leaders = lengths.flatMap((len, seat) => (len === max ? [seat] : []));
    next = max >= MIN_LONGEST_ROAD && leaders.length === 1 ? leaders[0]! : null;
  }
  if (next === holder) return;
  s.longestRoad = next;
  emit(s, { type: "longestRoad", from: holder, to: next, length: max });
}
