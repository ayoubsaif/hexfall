import type { Building, Seat } from "@hexfall/engine";
import { TOPOLOGY, edgeMidpoint, hexCenter, vertexPosition } from "@hexfall/engine/geometry";
import { describe, expect, it } from "vite-plus/test";
import { SEAT_COLORS } from "../../src/game/colors.ts";
import type { Pick } from "../../src/game/pick.ts";
import { boardLayout } from "../../src/scene/layout.ts";
import { TARGET_LIFT, landTop, pieceLayout, targetLayout } from "../../src/scene/pieces.ts";
import { beginnerBoard } from "@hexfall/engine/geometry";
import { type LandRelief, LAND_THICKNESS, SEA_DEPTH } from "../../src/theme/relief.ts";

const FLAT: LandRelief = { raised: false, thickness: 0, seaLevel: 0 };
const RAISED: LandRelief = { raised: true, thickness: LAND_THICKNESS, seaLevel: -SEA_DEPTH };

function emptyBoard() {
  const vertices: (Building | null)[] = Array.from(
    { length: TOPOLOGY.vertices.length },
    () => null,
  );
  const edges: (Seat | null)[] = Array.from({ length: TOPOLOGY.edges.length }, () => null);
  return { vertices, edges };
}

/** Where a piece model's local +X points after rotating by `yaw` about +Y. */
const localX = (yaw: number): [number, number] => [Math.cos(yaw), -Math.sin(yaw)];

describe("pieceLayout", () => {
  it("draws 8 settlements and 8 roads of 4 seats at their places in seat colors", () => {
    const { vertices, edges } = emptyBoard();
    const vs = [0, 4, 8, 12, 20, 24, 30, 40];
    vs.forEach((v, i) => {
      vertices[v] = { owner: i % 4, kind: "settlement" };
      edges[TOPOLOGY.vertices[v]!.edges[0]!] = i % 4;
    });
    const items = pieceLayout(vertices, edges, FLAT);
    const roads = items.filter((p) => p.kind === "road");
    const settlements = items.filter((p) => p.kind === "settlement");
    expect(roads).toHaveLength(8);
    expect(settlements).toHaveLength(8);
    for (const s of settlements) {
      expect(s.position).toEqual(vertexPosition(s.at));
      expect(s.assetKey).toBe("piece.settlement");
      expect(s.color).toBe(SEAT_COLORS[s.owner]!.hex);
      expect(s.key).toBe(`v${s.at}:settlement`);
    }
    for (const r of roads) {
      const m = edgeMidpoint(r.at);
      expect(r.position).toEqual([m.x, m.z]);
      expect(r.assetKey).toBe("piece.road");
      expect(r.key).toBe(`e${r.at}`);
    }
    expect(new Set(items.map((i) => i.key)).size).toBe(16);
  });

  it("turns each road's local +X along its path", () => {
    const { vertices, edges } = emptyBoard();
    for (let e = 0; e < TOPOLOGY.edges.length; e++) edges[e] = 0;
    for (const r of pieceLayout(vertices, edges, FLAT)) {
      const [a, b] = TOPOLOGY.edges[r.at]!.vertices.map(vertexPosition);
      const len = Math.hypot(b![0] - a![0], b![1] - a![1]);
      const dir = [(b![0] - a![0]) / len, (b![1] - a![1]) / len];
      const [x, z] = localX(r.yaw);
      // Parallel (either direction): |cross| ≈ 0.
      expect(Math.abs(x * dir[1]! - z * dir[0]!)).toBeLessThan(1e-9);
    }
  });

  it("a city replaces the settlement on the same intersection with a new key", () => {
    const { vertices, edges } = emptyBoard();
    vertices[10] = { owner: 2, kind: "settlement" };
    const before = pieceLayout(vertices, edges, FLAT);
    vertices[10] = { owner: 2, kind: "city" };
    const after = pieceLayout(vertices, edges, FLAT);
    expect(before.map((p) => p.key)).toEqual(["v10:settlement"]);
    expect(after.map((p) => [p.key, p.assetKey])).toEqual([["v10:city", "piece.city"]]);
  });

  it("rests pieces on the land top in both relief modes", () => {
    const { vertices, edges } = emptyBoard();
    vertices[3] = { owner: 1, kind: "city" };
    edges[5] = 3;
    expect(landTop(FLAT)).toBe(0);
    expect(landTop(RAISED)).toBe(0);
    for (const relief of [FLAT, RAISED]) {
      for (const p of pieceLayout(vertices, edges, relief)) expect(p.y).toBe(landTop(relief));
    }
  });
});

describe("targetLayout", () => {
  const pick = (target: Pick["target"], ids: number[]): Pick => ({
    kind: target === "vertex" ? "placeSettlement" : target === "edge" ? "placeRoad" : "moveRobber",
    target,
    targets: new Set(ids),
  });

  it("is empty with no pick", () => {
    expect(targetLayout(null, FLAT)).toEqual([]);
  });

  it("places vertex, edge and hex targets just above the land in both relief modes", () => {
    for (const relief of [FLAT, RAISED]) {
      const v = targetLayout(pick("vertex", [12, 3]), relief);
      expect(v.map((t) => t.key)).toEqual(["t-v3", "t-v12"]);
      expect(v[1]!.position).toEqual(vertexPosition(12));
      const e = targetLayout(pick("edge", [40]), relief);
      const m = edgeMidpoint(40);
      expect(e[0]).toMatchObject({
        key: "t-e40",
        target: "edge",
        position: [m.x, m.z],
        yaw: -m.angle,
      });
      const h = targetLayout(pick("hex", [7]), relief);
      expect(h[0]).toMatchObject({ key: "t-h7", position: hexCenter(7) });
      for (const t of [...v, ...e, ...h]) expect(t.y).toBeCloseTo(landTop(relief) + TARGET_LIFT);
    }
  });

  it("only targets listed in the pick", () => {
    expect(targetLayout(pick("vertex", [1, 2, 3]), FLAT)).toHaveLength(3);
  });
});

describe("boardLayout robber hex", () => {
  it("defaults to the board's robber and follows a given hex", () => {
    const board = beginnerBoard();
    expect(boardLayout(board).robber.hex).toBe(9);
    const moved = boardLayout(board, 4).robber;
    expect(moved.hex).toBe(4);
    // Hex 4 has a token, so the robber stands off-center.
    expect(moved.position).not.toEqual(hexCenter(4));
  });
});
