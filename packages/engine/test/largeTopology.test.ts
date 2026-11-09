import { describe, expect, it } from "vite-plus/test";
import {
  LARGE_TOPOLOGY,
  STANDARD_TOPOLOGY,
  edgeMidpoint,
  edgeOutward,
  hexCenter,
  hexToWorld,
  topologyFor,
  topologyOf,
  vertexPosition,
} from "../src/index.ts";

const T = LARGE_TOPOLOGY;
const EPS = 1e-9;

describe("large topology", () => {
  it("has rows of 3, 4, 5, 6, 5, 4, 3 with the spec q ranges", () => {
    const sizes = [-3, -2, -1, 0, 1, 2, 3].map((r) => T.hexes.filter((h) => h.r === r).length);
    expect(sizes).toEqual([3, 4, 5, 6, 5, 4, 3]);
    expect([T.hexes[0]?.q, T.hexes[0]?.r]).toEqual([1, -3]);
    expect([T.hexes[12]?.q, T.hexes[12]?.r]).toEqual([-2, 0]);
    expect([T.hexes[29]?.q, T.hexes[29]?.r]).toEqual([0, 3]);
    expect(T.hexes.map((h) => h.id)).toEqual([...Array(30).keys()]);
  });

  it("has the spec counts", () => {
    expect(T.hexes).toHaveLength(30);
    expect(T.vertices).toHaveLength(80);
    expect(T.edges).toHaveLength(109);
    expect(T.coastalEdges).toHaveLength(38);
    expect(new Set(T.coastalEdges).size).toBe(38);
    expect(T.edges.filter((e) => e.coastal)).toHaveLength(38);
    expect(T.vertices.filter((v) => v.coastal)).toHaveLength(38);
    expect(T.seaRing).toHaveLength(22);
    expect(new Set(T.cornerHexes).size).toBe(6);
    expect(T.layout).toBe("large");
  });

  it("starts the coast at hex 0's upper-left side", () => {
    expect(T.coastalEdges[0]).toBe(T.hexes[0]?.edges[3]);
    expect(T.coastalEdges[1]).toBe(T.hexes[0]?.edges[2]);
  });

  it("has symmetric relations", () => {
    for (const e of T.edges) {
      const [a, b] = e.vertices;
      expect(T.vertices[a]?.edges).toContain(e.id);
      expect(T.vertices[b]?.edges).toContain(e.id);
      expect(T.vertices[a]?.neighbors).toContain(b);
      expect(T.vertices[b]?.neighbors).toContain(a);
    }
    for (const h of T.hexes) {
      for (const v of h.vertices) expect(T.vertices[v]?.hexes).toContain(h.id);
      for (const e of h.edges) expect(T.edges[e]?.hexes).toContain(h.id);
    }
  });

  it("has 11 disjoint harbor slots on coastal paths", () => {
    expect(T.harborSlots).toHaveLength(11);
    const ends = T.harborSlots.flatMap((e) => {
      expect(T.edges[e]?.coastal).toBe(true);
      return [...(T.edges[e]?.vertices ?? [])];
    });
    expect(new Set(ends).size).toBe(22);
    for (const [slot, e] of T.harborSlots.entries()) {
      for (const v of T.edges[e]?.vertices ?? []) expect(T.vertices[v]?.harborSlot).toBe(slot);
    }
  });

  it("is centered at the origin with consistent world positions", () => {
    let sx = 0;
    let sz = 0;
    for (const h of T.hexes) {
      const [x, z] = hexCenter(h.id, T);
      const [wx, wz] = hexToWorld(h.q, h.r, T);
      expect(Math.abs(x - wx)).toBeLessThan(EPS);
      expect(Math.abs(z - wz)).toBeLessThan(EPS);
      sx += x;
      sz += z;
      for (const v of h.vertices) {
        const [vx, vz] = vertexPosition(v, T);
        expect(Math.abs(Math.hypot(vx - x, vz - z) - 1)).toBeLessThan(EPS);
      }
    }
    expect(Math.abs(sx / 30)).toBeLessThan(EPS);
    expect(Math.abs(sz / 30)).toBeLessThan(EPS);
    for (const e of T.coastalEdges) {
      const { x, z } = edgeMidpoint(e, T);
      const [ox, oz] = edgeOutward(e, T);
      const [cx, cz] = hexCenter(T.edges[e]?.hexes[0] ?? 0, T);
      expect((x - cx) * ox + (z - cz) * oz).toBeGreaterThan(0);
    }
  });

  it("is picked by layout, and the standard topology is unchanged", () => {
    expect(topologyFor("large")).toBe(LARGE_TOPOLOGY);
    expect(topologyFor("standard")).toBe(STANDARD_TOPOLOGY);
    expect(topologyOf({})).toBe(STANDARD_TOPOLOGY);
    expect(topologyOf({ layout: "large" }).hexes).toHaveLength(30);
    expect(STANDARD_TOPOLOGY.hexes).toHaveLength(19);
    expect(STANDARD_TOPOLOGY.harborSlots).toHaveLength(9);
  });
});
