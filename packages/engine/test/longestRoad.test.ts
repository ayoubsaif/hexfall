import { describe, expect, it } from "vite-plus/test";
import { publicVp } from "../src/rules/common.ts";
import { longestRoadLength, updateLongestRoad } from "../src/rules/longestRoad.ts";
import { putRoad, putSettlement } from "../src/rules/placement.ts";
import type { GameState } from "../src/state.ts";
import { give, makePlayState, putBuilding, putRoadAt, step } from "../src/testing.ts";
import { STANDARD_TOPOLOGY, hexAt, type EdgeId, type HexId } from "../src/topology.ts";

const CENTER: HexId = hexAt(0, 0)!;

/** Side i of a hex runs from corner i to corner i+1. */
function sides(hex: HexId, from: number, count: number): EdgeId[] {
  const h = STANDARD_TOPOLOGY.hexes[hex]!;
  return Array.from({ length: count }, (_, k) => h.edges[(from + k) % 6]!);
}

function corner(hex: HexId, i: number) {
  return STANDARD_TOPOLOGY.hexes[hex]!.vertices[i % 6]!;
}

function lrEvents(s: GameState) {
  return s.log.filter((e) => e.type === "longestRoad");
}

/** Three corner hexes that share no intersection. */
function disjointHexes(): [HexId, HexId, HexId] {
  const c = STANDARD_TOPOLOGY.cornerHexes;
  const hs: [HexId, HexId, HexId] = [c[0]!, c[2]!, c[4]!];
  const vs = hs.map((h) => new Set(STANDARD_TOPOLOGY.hexes[h]!.vertices));
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++) for (const v of vs[i]!) expect(vs[j]!.has(v)).toBe(false);
  return hs;
}

describe("geometry used by these tests", () => {
  it("hex sides chain corner to corner", () => {
    const h = STANDARD_TOPOLOGY.hexes[CENTER]!;
    for (let i = 0; i < 6; i++) {
      const vs = STANDARD_TOPOLOGY.edges[h.edges[i]!]!.vertices;
      const byId = (a: number, b: number) => a - b;
      expect([...vs].sort(byId)).toEqual([h.vertices[i]!, h.vertices[(i + 1) % 6]!].sort(byId));
    }
  });
});

describe("longestRoadLength", () => {
  it("counts a straight road of 5 and awards the card with an event", () => {
    const s = makePlayState();
    for (const e of sides(CENTER, 0, 4)) putRoad(s, 0, e, true);
    expect(s.longestRoad).toBeNull();
    expect(lrEvents(s)).toHaveLength(0);
    putRoad(s, 0, sides(CENTER, 4, 1)[0]!, true);
    expect(longestRoadLength(s, 0)).toBe(5);
    expect(s.longestRoad).toBe(0);
    expect(lrEvents(s)).toEqual([{ type: "longestRoad", from: null, to: 0, length: 5 }]);
  });

  it("counts only the longest branch of a fork", () => {
    const s = makePlayState();
    const c3 = corner(CENTER, 3);
    const out = STANDARD_TOPOLOGY.vertices[c3]!.edges.find(
      (e) => !STANDARD_TOPOLOGY.hexes[CENTER]!.edges.includes(e),
    );
    expect(out).toBeDefined();
    // sides 0..2 reach corner 3, which forks into side 3 and an outward path.
    for (const e of [...sides(CENTER, 0, 4), out!]) putRoadAt(s, e, 0);
    expect(longestRoadLength(s, 0)).toBe(4);
    updateLongestRoad(s);
    expect(s.longestRoad).toBeNull();
  });

  it("6-road loop plus a 2-road branch counts 8", () => {
    const s = makePlayState();
    const loop = sides(CENTER, 0, 6);
    const c0 = corner(CENTER, 0);
    const e1 = STANDARD_TOPOLOGY.vertices[c0]!.edges.find((e) => !loop.includes(e))!;
    const [a, b] = STANDARD_TOPOLOGY.edges[e1]!.vertices;
    const w = a === c0 ? b : a;
    const e2 = STANDARD_TOPOLOGY.vertices[w]!.edges.find((e) => e !== e1)!;
    const far = STANDARD_TOPOLOGY.edges[e2]!.vertices.find((v) => v !== w)!;
    expect(STANDARD_TOPOLOGY.hexes[CENTER]!.vertices).not.toContain(w);
    expect(STANDARD_TOPOLOGY.hexes[CENTER]!.vertices).not.toContain(far);
    for (const e of [...loop, e1, e2]) putRoadAt(s, e, 0);
    expect(longestRoadLength(s, 0)).toBe(8);
  });

  it("an opponent settlement breaks the road; own buildings do not", () => {
    const s = makePlayState();
    for (const e of sides(CENTER, 0, 5)) putRoadAt(s, e, 0);
    putBuilding(s, corner(CENTER, 2), 0);
    putBuilding(s, corner(CENTER, 4), 0, "city");
    expect(longestRoadLength(s, 0)).toBe(5);

    const t = makePlayState();
    for (const e of sides(CENTER, 0, 5)) putRoadAt(t, e, 0);
    putBuilding(t, corner(CENTER, 2), 1);
    expect(longestRoadLength(t, 0)).toBe(3);
  });

  it("a loop broken at one intersection is still a line through the rest", () => {
    const s = makePlayState();
    for (const e of sides(CENTER, 0, 6)) putRoadAt(s, e, 0);
    putBuilding(s, corner(CENTER, 0), 1);
    expect(longestRoadLength(s, 0)).toBe(6);
  });

  it("an opponent's buildSettlement breaks the holder's road and sets the card aside", () => {
    const s = makePlayState({ seat: 1 });
    const road = sides(CENTER, 0, 5);
    for (const e of road) putRoad(s, 0, e, true);
    expect(s.longestRoad).toBe(0);
    // Seat 1 reaches corner 2 by a road from outside the hex.
    const c2 = corner(CENTER, 2);
    const spur = STANDARD_TOPOLOGY.vertices[c2]!.edges.find((e) => !road.includes(e))!;
    putRoadAt(s, spur, 1);
    give(s, 1, { brick: 1, lumber: 1, wool: 1, grain: 1 });
    const next = step(s, { type: "buildSettlement", seat: 1, vertex: c2 });
    expect(longestRoadLength(next, 0)).toBe(3);
    expect(next.longestRoad).toBeNull();
    expect(lrEvents(next).at(-1)).toEqual({ type: "longestRoad", from: 0, to: null, length: 3 });
  });
});

describe("Longest Road award", () => {
  it("tie keeps the holder; broken holder with tied challengers sets it aside; unique 6 re-awards", () => {
    const [h0, h1, h2] = disjointHexes();
    const s = makePlayState();
    for (const e of sides(h0, 0, 5)) putRoad(s, 0, e, true);
    expect(s.longestRoad).toBe(0);
    for (const e of sides(h1, 0, 5)) putRoad(s, 1, e, true);
    for (const e of sides(h2, 0, 5)) putRoad(s, 2, e, true);
    expect(s.longestRoad).toBe(0);
    expect(lrEvents(s)).toHaveLength(1);

    // Seat 3 settles on corner 1 of seat 0's road: 1 + 4.
    putSettlement(s, 3, corner(h0, 1), true);
    expect(longestRoadLength(s, 0)).toBe(4);
    expect(s.longestRoad).toBeNull();
    expect(lrEvents(s).at(-1)).toEqual({ type: "longestRoad", from: 0, to: null, length: 5 });

    putRoad(s, 2, sides(h2, 5, 1)[0]!, true);
    expect(longestRoadLength(s, 2)).toBe(6);
    expect(s.longestRoad).toBe(2);
    expect(lrEvents(s).at(-1)).toEqual({ type: "longestRoad", from: null, to: 2, length: 6 });
  });

  it("nobody with 5+ leaves the card set aside", () => {
    const s = makePlayState();
    for (const e of sides(CENTER, 0, 5)) putRoad(s, 0, e, true);
    expect(s.longestRoad).toBe(0);
    putSettlement(s, 1, corner(CENTER, 3), true);
    expect(s.longestRoad).toBeNull();
  });

  it("a strictly longer road takes the card (4-point swing)", () => {
    const [h0, h1] = disjointHexes();
    let s = makePlayState({ seat: 1 });
    for (const e of sides(h0, 0, 5)) putRoadAt(s, e, 0);
    for (const e of sides(h1, 0, 5)) putRoadAt(s, e, 1);
    s.longestRoad = 0;
    updateLongestRoad(s);
    expect(s.longestRoad).toBe(0);
    const before = [publicVp(s, 0), publicVp(s, 1)];
    give(s, 1, { brick: 1, lumber: 1 });
    s = step(s, { type: "buildRoad", seat: 1, edge: sides(h1, 5, 1)[0]! });
    expect(s.longestRoad).toBe(1);
    expect(publicVp(s, 0)).toBe(before[0]! - 2);
    expect(publicVp(s, 1)).toBe(before[1]! + 2);
    expect(lrEvents(s).at(-1)).toEqual({ type: "longestRoad", from: 0, to: 1, length: 6 });
  });
});
