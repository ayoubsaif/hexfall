import { describe, expect, it } from "vite-plus/test";
import { applyAction } from "../src/game.ts";
import { COSTS, publicVp } from "../src/rules/common.ts";
import {
  buildableCities,
  buildableRoads,
  buildableSettlements,
  canPlaceSettlementAt,
  connectedRoadEdges,
} from "../src/rules/placement.ts";
import type { GameState, Seat } from "../src/state.ts";
import { failCode, give, makePlayState, putBuilding, putRoadAt, step } from "../src/testing.ts";
import { TOPOLOGY, hexAt, type EdgeId, type VertexId } from "../src/topology.ts";

const CENTER = TOPOLOGY.hexes[hexAt(0, 0)!]!;

function edgeBetween(a: VertexId, b: VertexId): EdgeId {
  const e = TOPOLOGY.vertices[a]!.edges.find((x) => TOPOLOGY.edges[x]!.vertices.includes(b));
  if (e === undefined) throw new Error(`no path ${a}-${b}`);
  return e;
}

function other(e: EdgeId, v: VertexId): VertexId {
  const [a, b] = TOPOLOGY.edges[e]!.vertices;
  return a === v ? b : a;
}

/** Corners 0..3 of the center hex: a straight chain c0-c1-c2-c3 of interior intersections. */
const [c0, c1, c2, c3] = [0, 1, 2, 3].map((i) => CENTER.vertices[i]!) as [
  VertexId,
  VertexId,
  VertexId,
  VertexId,
];

function rich(s: GameState, seat: Seat): void {
  give(s, seat, { brick: 4, lumber: 4, wool: 4, grain: 4, ore: 6 });
}

describe("Distance Rule", () => {
  it("canPlaceSettlementAt rejects occupied and adjacent intersections of any owner", () => {
    const s = makePlayState();
    expect(canPlaceSettlementAt(s, c1)).toBe(true);
    putBuilding(s, c0, 2);
    expect(canPlaceSettlementAt(s, c0)).toBe(false);
    expect(canPlaceSettlementAt(s, c1)).toBe(false);
    expect(canPlaceSettlementAt(s, c2)).toBe(true);
  });

  it("forbids building next to your own settlement", () => {
    const s = makePlayState();
    rich(s, 0);
    putBuilding(s, c0, 0);
    putRoadAt(s, edgeBetween(c0, c1), 0);
    putRoadAt(s, edgeBetween(c1, c2), 0);
    expect(failCode(s, { type: "buildSettlement", seat: 0, vertex: c1 })).toBe("illegal_placement");
    const next = step(s, { type: "buildSettlement", seat: 0, vertex: c2 });
    expect(next.vertices[c2]).toEqual({ owner: 0, kind: "settlement" });
  });

  it("forbids building next to an opponent's building", () => {
    const s = makePlayState();
    rich(s, 0);
    putBuilding(s, c0, 0);
    putRoadAt(s, edgeBetween(c0, c1), 0);
    putRoadAt(s, edgeBetween(c1, c2), 0);
    putBuilding(s, c3, 1, "city");
    expect(failCode(s, { type: "buildSettlement", seat: 0, vertex: c2 })).toBe("illegal_placement");
    expect(buildableSettlements(s, 0)).toEqual([]);
  });
});

describe("settlements need an own road", () => {
  it("rejects an isolated intersection and one touching only an opponent's road", () => {
    const s = makePlayState();
    rich(s, 0);
    expect(failCode(s, { type: "buildSettlement", seat: 0, vertex: c1 })).toBe("illegal_placement");
    putRoadAt(s, edgeBetween(c1, c2), 1);
    expect(failCode(s, { type: "buildSettlement", seat: 0, vertex: c1 })).toBe("illegal_placement");
    putRoadAt(s, edgeBetween(c0, c1), 0);
    expect(step(s, { type: "buildSettlement", seat: 0, vertex: c1 }).vertices[c1]?.owner).toBe(0);
  });
});

describe("road connectivity", () => {
  it("connects to own settlement or own road only", () => {
    const s = makePlayState();
    expect(connectedRoadEdges(s, 0)).toEqual([]);
    putBuilding(s, c0, 0);
    expect(connectedRoadEdges(s, 0)).toEqual(
      [...TOPOLOGY.vertices[c0]!.edges].sort((a, b) => a - b),
    );
    expect(connectedRoadEdges(s, 1)).toEqual([]);
  });

  it("cannot extend through an opponent's settlement, but can from the other side", () => {
    const s = makePlayState();
    rich(s, 0);
    putBuilding(s, c0, 0);
    putRoadAt(s, edgeBetween(c0, c1), 0);
    putBuilding(s, c1, 1);
    const beyond = edgeBetween(c1, c2);
    // The road ending at the opponent's settlement only connects via c0.
    expect(connectedRoadEdges(s, 0)).not.toContain(beyond);
    expect(buildableRoads(s, 0)).not.toContain(beyond);
    expect(failCode(s, { type: "buildRoad", seat: 0, edge: beyond })).toBe("illegal_placement");
    // Reaching c2 from elsewhere makes the same path legal.
    putRoadAt(s, edgeBetween(c2, c3), 0);
    expect(connectedRoadEdges(s, 0)).toContain(beyond);
    expect(step(s, { type: "buildRoad", seat: 0, edge: beyond }).edges[beyond]).toBe(0);
  });

  it("a road may end at an opponent's settlement", () => {
    const s = makePlayState();
    rich(s, 0);
    putBuilding(s, c0, 0);
    putBuilding(s, c2, 1);
    const e = edgeBetween(c0, c1);
    putRoadAt(s, e, 0);
    expect(connectedRoadEdges(s, 0)).toContain(edgeBetween(c1, c2));
  });

  it("allows coastal roads", () => {
    const s = makePlayState();
    rich(s, 0);
    const e = TOPOLOGY.coastalEdges[0]!;
    const e2 = TOPOLOGY.coastalEdges[1]!;
    const shared = TOPOLOGY.edges[e]!.vertices.find((x) =>
      TOPOLOGY.edges[e2]!.vertices.includes(x),
    )!;
    const v = other(e, shared);
    expect(TOPOLOGY.edges[e]!.coastal).toBe(true);
    putBuilding(s, v, 0);
    expect(buildableRoads(s, 0)).toContain(e);
    const next = step(s, { type: "buildRoad", seat: 0, edge: e });
    expect(next.edges[e]).toBe(0);
    // And onward along the coast.
    expect(connectedRoadEdges(next, 0)).toContain(e2);
  });

  it("rejects an occupied path", () => {
    const s = makePlayState();
    rich(s, 0);
    putBuilding(s, c0, 0);
    const e = edgeBetween(c0, c1);
    putRoadAt(s, e, 1);
    expect(failCode(s, { type: "buildRoad", seat: 0, edge: e })).toBe("illegal_placement");
  });
});

describe("guards", () => {
  it("must roll first", () => {
    const s = makePlayState({ rolled: false });
    rich(s, 0);
    putBuilding(s, c0, 0);
    const e = edgeBetween(c0, c1);
    expect(failCode(s, { type: "buildRoad", seat: 0, edge: e })).toBe("must_roll_first");
    expect(failCode(s, { type: "buildCity", seat: 0, vertex: c0 })).toBe("must_roll_first");
    expect(buildableRoads(s, 0)).toEqual([]);
    expect(buildableCities(s, 0)).toEqual([]);
  });

  it("only on your turn", () => {
    const s = makePlayState({ seat: 0 });
    rich(s, 1);
    putBuilding(s, c0, 1);
    const e = edgeBetween(c0, c1);
    expect(failCode(s, { type: "buildRoad", seat: 1, edge: e })).toBe("not_your_turn");
    expect(failCode(s, { type: "buildCity", seat: 1, vertex: c0 })).toBe("not_your_turn");
    expect(buildableRoads(s, 1)).toEqual([]);
  });

  it("rejects bad ids", () => {
    const s = makePlayState();
    rich(s, 0);
    expect(failCode(s, { type: "buildRoad", seat: 0, edge: 72 })).toBe("invalid_action");
    expect(failCode(s, { type: "buildSettlement", seat: 0, vertex: -1 })).toBe("invalid_action");
    expect(failCode(s, { type: "buildCity", seat: 0, vertex: 1.5 })).toBe("invalid_action");
  });

  it("no_pieces for roads, settlements and cities", () => {
    const s = makePlayState();
    rich(s, 0);
    putBuilding(s, c0, 0);
    putRoadAt(s, edgeBetween(c1, c2), 0);
    const p = s.players[0]!;
    p.pieces = { roads: 0, settlements: 0, cities: 0 };
    expect(failCode(s, { type: "buildRoad", seat: 0, edge: edgeBetween(c0, c1) })).toBe(
      "no_pieces",
    );
    expect(failCode(s, { type: "buildSettlement", seat: 0, vertex: c2 })).toBe("no_pieces");
    expect(failCode(s, { type: "buildCity", seat: 0, vertex: c0 })).toBe("no_pieces");
    expect(buildableRoads(s, 0)).toEqual([]);
    expect(buildableSettlements(s, 0)).toEqual([]);
    expect(buildableCities(s, 0)).toEqual([]);
  });

  it("insufficient resources", () => {
    const s = makePlayState();
    putBuilding(s, c0, 0);
    putRoadAt(s, edgeBetween(c1, c2), 0);
    give(s, 0, { brick: 1, ore: 2, grain: 2 });
    expect(failCode(s, { type: "buildRoad", seat: 0, edge: edgeBetween(c0, c1) })).toBe(
      "insufficient_resources",
    );
    expect(failCode(s, { type: "buildSettlement", seat: 0, vertex: c2 })).toBe(
      "insufficient_resources",
    );
    expect(failCode(s, { type: "buildCity", seat: 0, vertex: c0 })).toBe("insufficient_resources");
    expect(buildableRoads(s, 0)).toEqual([]);
    expect(buildableSettlements(s, 0)).toEqual([]);
    expect(buildableCities(s, 0)).toEqual([]);
  });
});

describe("cities", () => {
  it("only upgrade the builder's own settlement", () => {
    const s = makePlayState();
    rich(s, 0);
    putBuilding(s, c0, 1);
    putBuilding(s, c2, 0, "city");
    expect(failCode(s, { type: "buildCity", seat: 0, vertex: c0 })).toBe("illegal_placement");
    expect(failCode(s, { type: "buildCity", seat: 0, vertex: c2 })).toBe("illegal_placement");
    expect(failCode(s, { type: "buildCity", seat: 0, vertex: CENTER.vertices[4]! })).toBe(
      "illegal_placement",
    );
    expect(buildableCities(s, 0)).toEqual([]);
  });

  it("returns the settlement to supply, adds 1 VP and pays the bank", () => {
    const s = makePlayState();
    putBuilding(s, c0, 0);
    putBuilding(s, c2, 0);
    putBuilding(s, CENTER.vertices[4]!, 0);
    give(s, 0, { ore: 3, grain: 2 });
    expect(s.players[0]!.pieces).toMatchObject({ settlements: 2, cities: 4 });
    const vp = publicVp(s, 0);
    const bank = { ...s.bank };
    const next = step(s, { type: "buildCity", seat: 0, vertex: c0 });
    expect(next.vertices[c0]).toEqual({ owner: 0, kind: "city" });
    expect(next.players[0]!.pieces).toMatchObject({ settlements: 3, cities: 3 });
    expect(publicVp(next, 0)).toBe(vp + 1);
    expect(next.bank.ore).toBe(bank.ore + 3);
    expect(next.bank.grain).toBe(bank.grain + 2);
    expect(next.players[0]!.resources).toMatchObject({ ore: 0, grain: 0 });
    expect(next.log.at(-1)).toEqual({ type: "built", seat: 0, piece: "city", at: c0, free: false });
  });
});

describe("payment and events", () => {
  it("roads and settlements pay the bank and emit built", () => {
    let s = makePlayState();
    putBuilding(s, c0, 0);
    give(s, 0, { brick: 3, lumber: 3, wool: 1, grain: 1 });
    const bank = { ...s.bank };
    s = step(s, { type: "buildRoad", seat: 0, edge: edgeBetween(c0, c1) });
    s = step(s, { type: "buildRoad", seat: 0, edge: edgeBetween(c1, c2) });
    s = step(s, { type: "buildSettlement", seat: 0, vertex: c2 });
    expect(s.bank).toEqual({
      ...bank,
      brick: bank.brick + 3,
      lumber: bank.lumber + 3,
      wool: bank.wool + 1,
      grain: bank.grain + 1,
    });
    expect(s.players[0]!.pieces).toEqual({ roads: 13, settlements: 3, cities: 4 });
    expect(s.log.filter((e) => e.type === "built")).toEqual([
      { type: "built", seat: 0, piece: "road", at: edgeBetween(c0, c1), free: false },
      { type: "built", seat: 0, piece: "road", at: edgeBetween(c1, c2), free: false },
      { type: "built", seat: 0, piece: "settlement", at: c2, free: false },
    ]);
  });
});

describe("buildable* lists", () => {
  it("every listed id is accepted by applyAction", () => {
    const s = makePlayState({ seat: 1 });
    // A small mixed position.
    putBuilding(s, c0, 1);
    putRoadAt(s, edgeBetween(c0, c1), 1);
    putRoadAt(s, edgeBetween(c1, c2), 1);
    const out = TOPOLOGY.vertices[c2]!.edges.find((e) => !CENTER.edges.includes(e))!;
    putRoadAt(s, out, 1);
    putBuilding(s, c3, 2);
    putRoadAt(
      s,
      TOPOLOGY.vertices[c3]!.edges.find((e) => other(e, c3) !== c2)!,
      2,
    );
    const coastV = TOPOLOGY.edges[TOPOLOGY.coastalEdges[5]!]!.vertices[0];
    putBuilding(s, coastV, 1, "settlement");
    give(s, 1, { brick: 2, lumber: 2, wool: 1, grain: 3, ore: 3 });
    const roads = buildableRoads(s, 1);
    const settlements = buildableSettlements(s, 1);
    const cities = buildableCities(s, 1);
    expect(roads.length).toBeGreaterThan(0);
    expect(settlements.length).toBeGreaterThan(0);
    expect(cities).toEqual([c0, coastV].sort((a, b) => a - b));
    for (const list of [roads, settlements, cities])
      expect([...list]).toEqual([...list].sort((a, b) => a - b));
    for (const edge of roads)
      expect(applyAction(s, { type: "buildRoad", seat: 1, edge }).ok).toBe(true);
    for (const vertex of settlements)
      expect(applyAction(s, { type: "buildSettlement", seat: 1, vertex }).ok).toBe(true);
    for (const vertex of cities)
      expect(applyAction(s, { type: "buildCity", seat: 1, vertex }).ok).toBe(true);
    // And nothing unlisted is accepted.
    for (let edge = 0; edge < TOPOLOGY.edges.length; edge++)
      expect(applyAction(s, { type: "buildRoad", seat: 1, edge }).ok).toBe(roads.includes(edge));
    for (let vertex = 0; vertex < TOPOLOGY.vertices.length; vertex++) {
      expect(applyAction(s, { type: "buildSettlement", seat: 1, vertex }).ok).toBe(
        settlements.includes(vertex),
      );
      expect(applyAction(s, { type: "buildCity", seat: 1, vertex }).ok).toBe(
        cities.includes(vertex),
      );
    }
  });

  it("are empty when not affordable", () => {
    const s = makePlayState();
    putBuilding(s, c0, 0);
    putRoadAt(s, edgeBetween(c1, c2), 0);
    expect(connectedRoadEdges(s, 0).length).toBeGreaterThan(0);
    expect(buildableRoads(s, 0)).toEqual([]);
    expect(buildableSettlements(s, 0)).toEqual([]);
    expect(buildableCities(s, 0)).toEqual([]);
    give(s, 0, COSTS.road);
    expect(buildableRoads(s, 0)).toEqual(connectedRoadEdges(s, 0));
  });
});
