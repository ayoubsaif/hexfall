// 3D pastures on pasture hexes (specs/pasture-meadow).
import {
  STANDARD_TOPOLOGY,
  beginnerBoard,
  hexCenter,
  vertexPosition,
} from "@hexfall/engine/geometry";
import { createRng, createVariableBoard } from "@hexfall/engine";
import { describe, expect, it } from "vite-plus/test";
import { PATH_CLEAR, VERTEX_CLEAR } from "../../src/scene/coastScatter.ts";
import { CAMP_PATH_WIDTH } from "../../src/scene/IslandGround.tsx";
import { CHIP_CLEAR, ROBBER_CLEAR } from "../../src/scene/forestTrees.ts";
import { ROBBER_TOKEN_OFFSET } from "../../src/scene/layout.ts";
import {
  CAMP_VARIANTS,
  FENCE_LENGTH,
  MAX_SHEEP,
  MIN_SHEEP,
  hexCamp,
  HUT_SCALE,
  PATH_LEGS,
  hexFlock,
  pastureSheep,
} from "../../src/scene/pastureSheep.ts";

/** Tallest sheep variant (sheep.glb, standing; 0.08) and a city's height, in board units. */
const SHEEP_HEIGHT = 0.082;
const CITY_HEIGHT = 0.368;
/** camp.glb hut height and a settlement's height (settlement.glb). */
const HUT_HEIGHT = 0.096;
const SETTLEMENT_HEIGHT = 0.222;

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

const near = (hex: number, items: readonly { x: number; z: number }[]) => {
  const [cx, cz] = hexCenter(hex);
  return items.filter((t) => Math.hypot(t.x - cx, t.z - cz) < 0.87);
};

describe("pasture sheep", () => {
  it("puts a flock of 3 to 5 sheep on every pasture hex and none elsewhere", () => {
    for (const board of boards) {
      const sheep = pastureSheep(board).filter((p) => p.key === "prop.sheep");
      for (const info of STANDARD_TOPOLOGY.hexes) {
        const here = near(info.id, sheep);
        if (board.hexes[info.id]?.terrain === "pasture") {
          expect(here.length).toBeGreaterThanOrEqual(MIN_SHEEP);
          expect(here.length).toBeLessThanOrEqual(MAX_SHEEP);
        } else expect(here).toHaveLength(0);
      }
    }
  });

  it("adds 10 to 16 grass tufts per pasture", () => {
    for (const board of boards) {
      const tufts = pastureSheep(board).filter((p) => p.key === "prop.bush" && p.variant === 2);
      for (const info of STANDARD_TOPOLOGY.hexes) {
        if (board.hexes[info.id]?.terrain !== "pasture") continue;
        const n = near(info.id, tufts).length;
        expect(n).toBeGreaterThanOrEqual(10);
        expect(n).toBeLessThanOrEqual(16);
      }
    }
  });

  it("keeps everything clear of the chip, the robber spot, corners and edges", () => {
    for (const board of boards) {
      const all = pastureSheep(board);
      for (const info of STANDARD_TOPOLOGY.hexes) {
        if (board.hexes[info.id]?.terrain !== "pasture") continue;
        const [cx, cz] = hexCenter(info.id);
        for (const t of near(info.id, all)) {
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
    }
  });

  it("never lets two sheep overlap", () => {
    for (const info of STANDARD_TOPOLOGY.hexes) {
      const flock = hexFlock(info.id);
      for (let i = 0; i < flock.length; i++)
        for (let j = i + 1; j < flock.length; j++) {
          const a = flock[i]!,
            b = flock[j]!;
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan((a.radius + b.radius) * 0.9);
        }
    }
  });

  it("keeps every sheep shorter than half a city", () => {
    for (const board of boards)
      for (const s of pastureSheep(board).filter((p) => p.key === "prop.sheep"))
        expect(SHEEP_HEIGHT * s.scale).toBeLessThan(CITY_HEIGHT / 2);
  });

  it("is deterministic", () => {
    for (const board of boards) expect(pastureSheep(board)).toEqual(pastureSheep(board));
  });

  it("gives every pasture a hut, a fence and a path, and no trough", () => {
    for (const board of boards)
      for (const info of STANDARD_TOPOLOGY.hexes) {
        if (board.hexes[info.id]?.terrain !== "pasture") continue;
        const camp = hexCamp(info.id);
        const of = (v: number) =>
          camp.props.filter((p) => p.key === "prop.camp" && p.variant === v).length;
        expect(of(CAMP_VARIANTS.hut)).toBe(1);
        expect(of(CAMP_VARIANTS.trough)).toBe(0);
        expect(of(CAMP_VARIANTS.fence)).toBeGreaterThanOrEqual(2);
        expect(camp.ground).not.toBeNull();
        expect(camp.ground!.path).toHaveLength((PATH_LEGS + 1) * 2);
      }
  });

  it("keeps every fence post and rail clear of corners and roads", () => {
    for (const info of STANDARD_TOPOLOGY.hexes) {
      const fences = hexCamp(info.id).props.filter(
        (p) => p.key === "prop.camp" && p.variant === CAMP_VARIANTS.fence,
      );
      for (const f of fences) {
        // Fence runs along the model's +X, turned by yaw (+X -> (cos, -sin)).
        const tx = Math.cos(f.yaw),
          tz = -Math.sin(f.yaw);
        for (const t of [-0.5, 0, 0.5]) {
          const x = f.x + tx * FENCE_LENGTH * t,
            z = f.z + tz * FENCE_LENGTH * t;
          for (const v of info.vertices) {
            const [vx, vz] = vertexPosition(v);
            expect(Math.hypot(x - vx, z - vz)).toBeGreaterThanOrEqual(VERTEX_CLEAR);
          }
          for (const e of info.edges) {
            const [a, b] = STANDARD_TOPOLOGY.edges[e]!.vertices;
            expect(segDistance(x, z, vertexPosition(a), vertexPosition(b))).toBeGreaterThan(
              PATH_CLEAR,
            );
          }
        }
      }
    }
  });

  it("keeps the hut shorter than a settlement, its door facing the chip", () => {
    expect(HUT_HEIGHT * HUT_SCALE).toBeLessThan(SETTLEMENT_HEIGHT);
    for (const info of STANDARD_TOPOLOGY.hexes) {
      const hut = hexCamp(info.id).props.find(
        (p) => p.key === "prop.camp" && p.variant === CAMP_VARIANTS.hut,
      );
      if (!hut) continue;
      const [cx, cz] = hexCenter(info.id);
      const dx = cx - hut.x,
        dz = cz - hut.z;
      const fx = Math.cos(hut.yaw),
        fz = -Math.sin(hut.yaw);
      expect((fx * dx + fz * dz) / Math.hypot(dx, dz)).toBeCloseTo(1, 5);
    }
  });

  it("runs the path in straight legs that never touch the chip", () => {
    for (const info of STANDARD_TOPOLOGY.hexes) {
      const ground = hexCamp(info.id).ground;
      if (!ground) continue;
      const [cx, cz] = hexCenter(info.id);
      const p = ground.path;
      for (let i = 0; i + 3 < p.length; i += 2)
        expect(segDistance(cx, cz, [p[i]!, p[i + 1]!], [p[i + 2]!, p[i + 3]!])).toBeGreaterThan(
          CHIP_CLEAR + CAMP_PATH_WIDTH,
        );
    }
  });
});
