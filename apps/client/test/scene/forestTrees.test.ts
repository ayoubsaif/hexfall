// 3D forests on forest hexes (specs/forest-trees).
import {
  STANDARD_TOPOLOGY,
  beginnerBoard,
  hexCenter,
  vertexPosition,
} from "@hexfall/engine/geometry";
import { createRng, createVariableBoard } from "@hexfall/engine";
import { describe, expect, it } from "vite-plus/test";
import { PATH_CLEAR, VERTEX_CLEAR } from "../../src/scene/coastScatter.ts";
import {
  CHIP_CLEAR,
  FOREST_TREES,
  GROVE_GAP,
  GROVE_RADIUS,
  MAX_GROVES,
  MAX_TREES,
  MIN_GROVES,
  MIN_TREES,
  ROBBER_CLEAR,
  WOODS_VARIANTS,
  hexWoods,
  forestTrees,
  hexForest,
  hexGroves,
  hexTufts,
} from "../../src/scene/forestTrees.ts";
import { ROBBER_TOKEN_OFFSET } from "../../src/scene/layout.ts";

/** Tree model height (tree.glb, tallest variant) and a city's height, in board units. */
const TREE_HEIGHT = 0.32;
const CITY_HEIGHT = 0.368;

function segDistance(px: number, pz: number, a: readonly number[], b: readonly number[]) {
  const dx = b[0]! - a[0]!,
    dz = b[1]! - a[1]!;
  const t = Math.max(0, Math.min(1, ((px - a[0]!) * dx + (pz - a[1]!) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - a[0]! - dx * t, pz - a[1]! - dz * t);
}

const boards = [
  beginnerBoard(),
  createVariableBoard(createRng(7))[0],
  createVariableBoard(createRng(42))[0],
];

describe("forest trees", () => {
  it("puts MIN_TREES to MAX_TREES trees on every forest hex and none elsewhere", () => {
    for (const board of boards) {
      const trees = forestTrees(board).filter((t) => t.key === "prop.tree");
      for (const info of STANDARD_TOPOLOGY.hexes) {
        const [cx, cz] = hexCenter(info.id);
        const here = trees.filter((t) => Math.hypot(t.x - cx, t.z - cz) < 0.87);
        if (board.hexes[info.id]?.terrain === "forest") {
          expect(here.length).toBeGreaterThanOrEqual(MIN_TREES);
          expect(here.length).toBeLessThanOrEqual(MAX_TREES);
        } else expect(here).toHaveLength(0);
      }
    }
  });

  it("keeps trees clear of the chip, the robber spot, corners and edges", () => {
    for (const info of STANDARD_TOPOLOGY.hexes) {
      const [cx, cz] = hexCenter(info.id);
      const trees = hexForest(info.id);
      for (const t of [...trees, ...hexTufts(info.id, trees)]) {
        expect(Math.hypot(t.x - cx, t.z - cz)).toBeGreaterThanOrEqual(CHIP_CLEAR);
        const rx = cx + ROBBER_TOKEN_OFFSET[0],
          rz = cz + ROBBER_TOKEN_OFFSET[1];
        expect(Math.hypot(t.x - rx, t.z - rz)).toBeGreaterThanOrEqual(ROBBER_CLEAR);
        for (const v of info.vertices) {
          const [vx, vz] = vertexPosition(v);
          expect(Math.hypot(t.x - vx, t.z - vz)).toBeGreaterThanOrEqual(VERTEX_CLEAR);
        }
        for (const e of info.edges) {
          const [a, b] = STANDARD_TOPOLOGY.edges[e]!.vertices;
          expect(segDistance(t.x, t.z, vertexPosition(a), vertexPosition(b))).toBeGreaterThan(
            PATH_CLEAR,
          );
        }
      }
    }
  });

  it("keeps every tree shorter than a city", () => {
    for (const board of boards)
      for (const t of forestTrees(board).filter((p) => p.key === "prop.tree"))
        expect(TREE_HEIGHT * t.scale).toBeLessThan(CITY_HEIGHT);
  });

  it("scatters 18 to 26 grass tufts on every forest hex", () => {
    for (const board of boards) {
      const tufts = forestTrees(board).filter((t) => t.key === "prop.bush");
      for (const info of STANDARD_TOPOLOGY.hexes) {
        if (board.hexes[info.id]?.terrain !== "forest") continue;
        const [cx, cz] = hexCenter(info.id);
        const n = tufts.filter((t) => Math.hypot(t.x - cx, t.z - cz) < 0.87).length;
        expect(n).toBeGreaterThanOrEqual(18);
        expect(n).toBeLessThanOrEqual(26);
      }
    }
  });

  it("is deterministic", () => {
    for (const board of boards) expect(forestTrees(board)).toEqual(forestTrees(board));
  });

  describe("woodland props", () => {
    const forestHexes = STANDARD_TOPOLOGY.hexes.map((h) => h.id);

    it("grows only the two tall conifers, both of them across the board", () => {
      const variants = new Set(forestHexes.flatMap((hex) => hexForest(hex).map((t) => t.variant)));
      expect([...variants].sort()).toEqual([...FOREST_TREES].sort());
    });

    it("groups the trees of every hex into 3 to 5 separate groves", () => {
      for (const hex of forestHexes) {
        const groves = hexGroves(hex);
        expect(groves.length).toBeGreaterThanOrEqual(MIN_GROVES);
        expect(groves.length).toBeLessThanOrEqual(MAX_GROVES);
        const centres = groves.map((g) => {
          // Never a lone tree: every grove has at least 3, packed round its centre.
          expect(g.length).toBeGreaterThanOrEqual(3);
          const x = g.reduce((s, t) => s + t.x, 0) / g.length,
            z = g.reduce((s, t) => s + t.z, 0) / g.length;
          for (const t of g) expect(Math.hypot(t.x - x, t.z - z)).toBeLessThan(GROVE_RADIUS * 2);
          return [x, z] as const;
        });
        // Open ground between the groves.
        centres.forEach(([ax, az], i) =>
          centres.forEach(([bx, bz], j) => {
            if (j > i) expect(Math.hypot(ax - bx, az - bz)).toBeGreaterThan(GROVE_GAP * 0.6);
          }),
        );
      }
    });

    it("puts boulders, a woodpile, stumps, ferns and mushrooms on every forest hex", () => {
      for (const hex of forestHexes) {
        const props = hexWoods(hex);
        const woods = (v: number) => props.filter((p) => p.key === "prop.woods" && p.variant === v);
        expect(woods(WOODS_VARIANTS.pile)).toHaveLength(1);
        expect(woods(WOODS_VARIANTS.stump).length).toBeGreaterThanOrEqual(1);
        expect(woods(WOODS_VARIANTS.fern).length).toBeGreaterThanOrEqual(1);
        expect(woods(WOODS_VARIANTS.mushrooms).length).toBeGreaterThanOrEqual(1);
        expect(props.filter((p) => p.key === "prop.boulder").length).toBeGreaterThanOrEqual(2);
      }
    });

    it("keeps every prop off the chip, the robber spot and the board spots", () => {
      for (const hex of forestHexes) {
        const info = STANDARD_TOPOLOGY.hexes[hex]!;
        const [cx, cz] = hexCenter(hex);
        for (const p of hexWoods(hex)) {
          expect(Math.hypot(p.x - cx, p.z - cz)).toBeGreaterThanOrEqual(CHIP_CLEAR);
          const rx = cx + ROBBER_TOKEN_OFFSET[0],
            rz = cz + ROBBER_TOKEN_OFFSET[1];
          expect(Math.hypot(p.x - rx, p.z - rz)).toBeGreaterThanOrEqual(ROBBER_CLEAR);
          for (const v of info.vertices) {
            const [vx, vz] = vertexPosition(v);
            expect(Math.hypot(p.x - vx, p.z - vz)).toBeGreaterThanOrEqual(VERTEX_CLEAR);
          }
        }
      }
    });

    it("never stacks a woodpile, log or stump on a tree or rock", () => {
      for (const hex of forestHexes) {
        const props = hexWoods(hex);
        const big = props.filter(
          (p) =>
            p.key === "prop.woods" &&
            p.variant !== WOODS_VARIANTS.fern &&
            p.variant !== WOODS_VARIANTS.mushrooms,
        );
        for (const b of big)
          for (const o of props)
            if (o !== b && (o.key === "prop.tree" || o.key === "prop.boulder"))
              expect(Math.hypot(o.x - b.x, o.z - b.z)).toBeGreaterThanOrEqual(
                o.radius + b.radius - 1e-9,
              );
      }
    });
  });
});
