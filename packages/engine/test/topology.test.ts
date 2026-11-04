import { describe, expect, it } from "vite-plus/test";
import {
  TOPOLOGY,
  edgeMidpoint,
  edgeOutward,
  hexCenter,
  hexToWorld,
  vertexPosition,
} from "../src/index.ts";

const { hexes, vertices, edges, coastalEdges, harborSlots, cornerHexes, seaRing } = TOPOLOGY;
const EPS = 1e-9;

function hexDistance(q: number, r: number): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

describe("hex layout", () => {
  it("has rows of 3, 4, 5, 4, 3 from top to bottom", () => {
    const sizes = [-2, -1, 0, 1, 2].map((r) => hexes.filter((h) => h.r === r).length);
    expect(sizes).toEqual([3, 4, 5, 4, 3]);
    for (const h of hexes) expect(hexDistance(h.q, h.r)).toBeLessThanOrEqual(2);
  });

  it("assigns ids in reading order", () => {
    expect(hexes.map((h) => h.id)).toEqual([...Array(19).keys()]);
    expect([hexes[0]?.q, hexes[0]?.r]).toEqual([0, -2]);
    expect([hexes[2]?.q, hexes[2]?.r]).toEqual([2, -2]);
    expect([hexes[9]?.q, hexes[9]?.r]).toEqual([0, 0]);
    expect([hexes[18]?.q, hexes[18]?.r]).toEqual([0, 2]);
    for (let i = 1; i < hexes.length; i++) {
      const a = hexes[i - 1]!;
      const b = hexes[i]!;
      expect(a.r < b.r || (a.r === b.r && a.q < b.q)).toBe(true);
    }
  });
});

describe("intersections and paths", () => {
  it("has 19 hexes, 54 intersections and 72 paths", () => {
    expect(hexes).toHaveLength(19);
    expect(vertices).toHaveLength(54);
    expect(edges).toHaveLength(72);
    vertices.forEach((v, i) => expect(v.id).toBe(i));
    edges.forEach((e, i) => expect(e.id).toBe(i));
  });

  it("numbers intersections and paths in reading order of position", () => {
    for (let i = 1; i < vertices.length; i++) {
      const [ax, az] = vertexPosition(i - 1);
      const [bx, bz] = vertexPosition(i);
      expect(az < bz - EPS || (Math.abs(az - bz) < EPS && ax < bx)).toBe(true);
    }
    for (let i = 1; i < edges.length; i++) {
      const a = edgeMidpoint(i - 1);
      const b = edgeMidpoint(i);
      expect(a.z < b.z - EPS || (Math.abs(a.z - b.z) < EPS && a.x < b.x)).toBe(true);
    }
  });

  it("gives the center hex's intersections degree 3", () => {
    const center = hexes[9]!;
    expect(center.vertices).toHaveLength(6);
    for (const v of center.vertices) {
      const info = vertices[v]!;
      expect(info.hexes).toHaveLength(3);
      expect(info.edges).toHaveLength(3);
      expect(info.neighbors).toHaveLength(3);
    }
  });

  it("keeps every relation symmetric and in range", () => {
    for (const e of edges) {
      const [a, b] = e.vertices;
      expect(a).not.toBe(b);
      expect(vertices[a]!.edges).toContain(e.id);
      expect(vertices[b]!.edges).toContain(e.id);
      expect(vertices[a]!.neighbors).toContain(b);
      expect(vertices[b]!.neighbors).toContain(a);
      expect(e.hexes.length).toBeGreaterThanOrEqual(1);
      expect(e.hexes.length).toBeLessThanOrEqual(2);
      for (const h of e.hexes) expect(hexes[h]!.edges).toContain(e.id);
    }
    for (const v of vertices) {
      expect(v.hexes.length).toBeGreaterThanOrEqual(1);
      expect(v.hexes.length).toBeLessThanOrEqual(3);
      expect(v.edges.length).toBeGreaterThanOrEqual(2);
      expect(v.edges.length).toBeLessThanOrEqual(3);
      expect(v.neighbors).toHaveLength(v.edges.length);
      for (const h of v.hexes) expect(hexes[h]!.vertices).toContain(v.id);
      for (const e of v.edges) expect(edges[e]!.vertices).toContain(v.id);
    }
    const byNum = (x: number, y: number): number => x - y;
    for (const h of hexes) {
      expect(new Set(h.vertices).size).toBe(6);
      expect(new Set(h.edges).size).toBe(6);
      for (let i = 0; i < 6; i++) {
        const e = edges[h.edges[i]!]!;
        expect([...e.vertices].sort(byNum)).toEqual(
          [h.vertices[i]!, h.vertices[(i + 1) % 6]!].sort(byNum),
        );
        expect(vertices[h.vertices[i]!]!.hexes).toContain(h.id);
        expect(e.hexes).toContain(h.id);
      }
    }
  });
});

describe("coast and harbor slots", () => {
  it("has 30 coastal paths and 30 coastal intersections", () => {
    expect(edges.filter((e) => e.coastal)).toHaveLength(30);
    expect(vertices.filter((v) => v.coastal)).toHaveLength(30);
    for (const e of edges) expect(e.coastal).toBe(e.hexes.length === 1);
    for (const v of vertices) expect(v.coastal).toBe(v.hexes.length < 3);
  });

  it("lists the coast clockwise from hex 0's upper-left side in a single loop", () => {
    const h0 = hexes[0]!;
    expect(coastalEdges).toHaveLength(30);
    expect(new Set(coastalEdges).size).toBe(30);
    for (const e of coastalEdges) expect(edges[e]!.coastal).toBe(true);
    expect(coastalEdges[0]).toBe(h0.edges[3]); // corner 3 (top) -> corner 4 (upper-left)
    expect(coastalEdges[1]).toBe(h0.edges[2]); // corner 2 -> corner 3 (upper-right)
    // Consecutive paths share an intersection, including last -> first.
    for (let i = 0; i < 30; i++) {
      const a = edges[coastalEdges[i]!]!.vertices;
      const b = edges[coastalEdges[(i + 1) % 30]!]!.vertices;
      expect(a.filter((v) => b.includes(v))).toHaveLength(1);
    }
    // Clockwise on screen (x right, z down): the signed area of the midpoint loop is positive.
    let area = 0;
    for (let i = 0; i < 30; i++) {
      const p = edgeMidpoint(coastalEdges[i]!);
      const n = edgeMidpoint(coastalEdges[(i + 1) % 30]!);
      area += p.x * n.z - n.x * p.z;
    }
    expect(area).toBeGreaterThan(0);
  });

  it("has 9 slots at the fixed coastal positions with 18 distinct intersections", () => {
    expect(harborSlots).toEqual([0, 3, 6, 10, 13, 16, 20, 23, 26].map((p) => coastalEdges[p]));
    const ends = harborSlots.flatMap((e) => edges[e]!.vertices);
    expect(new Set(ends).size).toBe(18);
    const slotHexes = harborSlots.map((e) => {
      expect(edges[e]!.coastal).toBe(true);
      const h = hexes[edges[e]!.hexes[0]!]!;
      return [h.q, h.r];
    });
    expect(slotHexes).toEqual([
      [0, -2],
      [1, -2],
      [2, -2],
      [2, 0],
      [1, 1],
      [0, 2],
      [-2, 2],
      [-2, 1],
      [-2, 0],
    ]);
  });

  it("looks up harbor slots by intersection", () => {
    for (const v of edges[harborSlots[4]!]!.vertices) expect(vertices[v]!.harborSlot).toBe(4);
    harborSlots.forEach((e, slot) => {
      for (const v of edges[e]!.vertices) expect(vertices[v]!.harborSlot).toBe(slot);
    });
    const onSlot = new Set(harborSlots.flatMap((e) => edges[e]!.vertices));
    const off = vertices.filter((v) => !onSlot.has(v.id));
    expect(off).toHaveLength(36);
    for (const v of off) expect(v.harborSlot).toBeNull();
  });

  it("indexes the 6 corner hexes by axial direction", () => {
    const D: [number, number][] = [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
    ];
    expect(cornerHexes.map((h) => [hexes[h]!.q, hexes[h]!.r])).toEqual(
      D.map(([q, r]) => [2 * q, 2 * r]),
    );
  });

  it("has 18 distinct sea cells at distance 3, each adjacent to the island", () => {
    expect(seaRing).toHaveLength(18);
    expect(new Set(seaRing.map((c) => `${c.q},${c.r}`)).size).toBe(18);
    for (const c of seaRing) {
      expect(hexDistance(c.q, c.r)).toBe(3);
      const touches = hexes.some((h) => hexDistance(h.q - c.q, h.r - c.r) === 1);
      expect(touches).toBe(true);
    }
    expect(seaRing[0]).toEqual({ q: 3, r: 0 });
  });
});

describe("world coordinates", () => {
  it("centers hexes with hexToWorld and the board at the origin", () => {
    for (const h of hexes) {
      const [x, z] = hexCenter(h.id);
      const [wx, wz] = hexToWorld(h.q, h.r);
      expect(x).toBeCloseTo(wx, 12);
      expect(z).toBeCloseTo(wz, 12);
    }
    expect(hexCenter(9)[0]).toBeCloseTo(0, 12);
    expect(hexCenter(9)[1]).toBeCloseTo(0, 12);
  });

  it("puts every corner intersection at the matching corner of each hex", () => {
    for (const h of hexes) {
      const [cx, cz] = hexCenter(h.id);
      h.vertices.forEach((v, i) => {
        const [x, z] = vertexPosition(v);
        expect(x).toBeCloseTo(cx + Math.sin((i * Math.PI) / 3), 12);
        expect(z).toBeCloseTo(cz + Math.cos((i * Math.PI) / 3), 12);
      });
    }
    expect(vertices.filter((v) => v.hexes.length === 3)).toHaveLength(24);
  });

  it("puts path midpoints halfway between their ends, with the end-to-end angle", () => {
    for (const e of edges) {
      const [ax, az] = vertexPosition(e.vertices[0]);
      const [bx, bz] = vertexPosition(e.vertices[1]);
      const m = edgeMidpoint(e.id);
      expect(m.x).toBeCloseTo((ax + bx) / 2, 12);
      expect(m.z).toBeCloseTo((az + bz) / 2, 12);
      expect(m.angle).toBeCloseTo(Math.atan2(bz - az, bx - ax), 12);
      expect(Math.hypot(bx - ax, bz - az)).toBeCloseTo(1, 12);
    }
  });

  it("points coastal paths' outward vectors away from their only hex", () => {
    for (const e of coastalEdges) {
      const [ox, oz] = edgeOutward(e);
      expect(Math.hypot(ox, oz)).toBeCloseTo(1, 12);
      const m = edgeMidpoint(e);
      const [cx, cz] = hexCenter(edges[e]!.hexes[0]!);
      expect(ox * (m.x - cx) + oz * (m.z - cz)).toBeGreaterThan(0);
      // Stepping outward leaves the island: farther from the board center.
      expect(Math.hypot(m.x + ox, m.z + oz)).toBeGreaterThan(Math.hypot(m.x, m.z));
    }
    const interior = edges.find((e) => !e.coastal)!;
    expect(() => edgeOutward(interior.id)).toThrow(RangeError);
  });

  it("rejects out-of-range ids", () => {
    expect(() => hexCenter(19)).toThrow(RangeError);
    expect(() => vertexPosition(-1)).toThrow(RangeError);
    expect(() => edgeMidpoint(72)).toThrow(RangeError);
  });
});

describe("TOPOLOGY is frozen", () => {
  it("throws on mutation at every depth", () => {
    expect(Object.isFrozen(TOPOLOGY)).toBe(true);
    expect(() => {
      (TOPOLOGY as { hexes: unknown }).hexes = [];
    }).toThrow(TypeError);
    expect(() => {
      (TOPOLOGY.hexes as unknown[]).push({});
    }).toThrow(TypeError);
    expect(() => {
      (TOPOLOGY.hexes[0] as { q: number }).q = 5;
    }).toThrow(TypeError);
    expect(() => {
      (TOPOLOGY.vertices[0]!.neighbors as number[])[0] = 99;
    }).toThrow(TypeError);
    expect(() => {
      (TOPOLOGY.seaRing[0] as { q: number }).q = 0;
    }).toThrow(TypeError);
  });
});
