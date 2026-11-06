// Board evaluation helpers. Everything reads a PlayerView, never hidden state.
import {
  RESOURCES,
  TERRAIN_RESOURCE,
  TOPOLOGY,
  type EdgeId,
  type PlayerView,
  type Resource,
  type ResourceBundle,
  type ResourceCounts,
  type Seat,
  type VertexId,
} from "@hexfall/engine";

/** Dice pips of a number token (6 - distance from 7). */
export function pips(token: number | null): number {
  return token === null ? 0 : 6 - Math.abs(7 - token);
}

/** Resources the seat already produces. */
export function producedBy(view: PlayerView, seat: Seat): Set<Resource> {
  const out = new Set<Resource>();
  view.vertices.forEach((b, v) => {
    if (b?.owner !== seat) return;
    for (const h of TOPOLOGY.vertices[v]!.hexes) {
      const hex = view.board.hexes[h]!;
      const r = TERRAIN_RESOURCE[hex.terrain];
      if (r && hex.token !== null) out.add(r);
    }
  });
  return out;
}

/** Total pips a building on this vertex would collect (robber hex discounted). */
export function vertexPips(view: PlayerView, v: VertexId): number {
  let total = 0;
  for (const h of TOPOLOGY.vertices[v]!.hexes) {
    const p = pips(view.board.hexes[h]!.token);
    total += h === view.robber ? p * 0.3 : p;
  }
  return total;
}

/** Value of settling on `v` given what the seat already produces. */
export function vertexValue(view: PlayerView, v: VertexId, owned: ReadonlySet<Resource>): number {
  const info = TOPOLOGY.vertices[v]!;
  const here = new Set<Resource>();
  for (const h of info.hexes) {
    const hex = view.board.hexes[h]!;
    const r = TERRAIN_RESOURCE[hex.terrain];
    if (r && hex.token !== null) here.add(r);
  }
  let total = vertexPips(view, v);
  for (const r of here) if (!owned.has(r)) total += 1.5;
  if (info.harborSlot !== null) {
    const type = view.board.harbors[info.harborSlot];
    if (type === "generic") total += 1;
    else if (type) total += here.has(type) ? 3 : 0.5;
  }
  return total;
}

/** No building here or next to it (Distance Rule on an empty vertex). */
export function siteFree(view: PlayerView, v: VertexId): boolean {
  if (view.vertices[v]) return false;
  return TOPOLOGY.vertices[v]!.neighbors.every((n) => !view.vertices[n]);
}

/** How much a new road on `edge` helps reach a good settlement site. */
export function roadValue(view: PlayerView, edge: EdgeId, owned: ReadonlySet<Resource>): number {
  let best = 0;
  for (const x of TOPOLOGY.edges[edge]!.vertices) {
    const b = view.vertices[x];
    if (b) continue; // an occupied end leads nowhere new
    if (siteFree(view, x)) best = Math.max(best, vertexValue(view, x, owned));
    for (const y of TOPOLOGY.vertices[x]!.neighbors) {
      if (siteFree(view, y)) best = Math.max(best, 0.6 * vertexValue(view, y, owned));
    }
  }
  return best;
}

export function count(hand: ResourceCounts | ResourceBundle, r: Resource): number {
  return hand[r] ?? 0;
}

export function total(hand: ResourceCounts | ResourceBundle): number {
  return RESOURCES.reduce((n, r) => n + (hand[r] ?? 0), 0);
}
