// Dice collide with board pieces (spec board-dice "Physics throw").
import type { PlayerView } from "@hexfall/engine";
import { beginnerBoard, STANDARD_TOPOLOGY, vertexPosition } from "@hexfall/engine/geometry";
import { describe, expect, it } from "vite-plus/test";
import { poseAt } from "../../../src/scene/dice/controller.ts";
import { valueUp } from "../../../src/scene/dice/faces.ts";
import { DICE_SCALE, DIE_SIZE } from "../../../src/scene/dice/area.ts";
import {
  type BoxObstacle,
  type CylinderObstacle,
  diceObstacles,
} from "../../../src/scene/dice/obstacles.ts";
import { planThrow, simulate } from "../../../src/scene/dice/simulate.ts";
import { pieceLayout } from "../../../src/scene/pieces.ts";
import { DIE_VALUES } from "../../../src/theme/die.ts";

/** A beginner board (desert and robber at the center) with pieces around the middle. */
function crowdedView(): PlayerView {
  const board = beginnerBoard();
  const vertices = STANDARD_TOPOLOGY.vertices.map(() => null) as PlayerView["vertices"][number][];
  const edges = STANDARD_TOPOLOGY.edges.map(() => null) as PlayerView["edges"][number][];
  STANDARD_TOPOLOGY.vertices.forEach((_, v) => {
    const [x, z] = vertexPosition(v);
    const r = Math.hypot(x, z);
    // The center hex's corners get alternating settlements and cities, plus a far one.
    if (r < 1.1 && v % 2 === 0)
      vertices[v] = { kind: v % 4 === 0 ? "city" : "settlement", owner: 0 };
    if (r > 4) vertices[v] ??= null;
  });
  STANDARD_TOPOLOGY.edges.forEach((e, i) => {
    const [a, b] = e.vertices.map((v) => Math.hypot(...vertexPosition(v)));
    if (a! < 1.1 && b! < 1.1) edges[i] = 1;
  });
  return { board, robber: board.robber, vertices, edges } as unknown as PlayerView;
}

/** Distance from a point to a yawed box's surface (0 inside), in the box's units. */
function boxDistance(p: [number, number, number], o: BoxObstacle): number {
  const dx = p[0] - o.position[0];
  const dz = p[2] - o.position[2];
  const c = Math.cos(o.yaw);
  const s = Math.sin(o.yaw);
  // Inverse of the yaw rotation about +Y.
  const lx = c * dx - s * dz;
  const lz = s * dx + c * dz;
  const ly = p[1] - o.position[1];
  const q = [Math.abs(lx) - o.half[0], Math.abs(ly) - o.half[1], Math.abs(lz) - o.half[2]];
  return Math.hypot(...q.map((v) => Math.max(v, 0)));
}

/** Distance from a point to an upright cylinder's surface (0 inside). */
function cylinderDistance(p: [number, number, number], o: CylinderObstacle): number {
  const radial = Math.hypot(p[0] - o.position[0], p[2] - o.position[2]) - o.radius;
  const vertical = Math.abs(p[1] - o.position[1]) - o.height / 2;
  return Math.hypot(Math.max(radial, 0), Math.max(vertical, 0));
}

/** Die centers of one recording, frame by frame. */
function* centers(data: Float32Array, frames: number) {
  for (let f = 0; f < frames; f++) {
    for (const die of [0, 1] as const) {
      const at = f * 14 + die * 7;
      yield [data[at]!, data[at + 1]!, data[at + 2]!] as [number, number, number];
    }
  }
}

describe("dice obstacles", () => {
  it("puts each piece's collider where the board draws it, in the dice frame", () => {
    const view = crowdedView();
    const boxes = diceObstacles(view).filter((o): o is BoxObstacle => o.shape === "box");
    const drawn = pieceLayout(view.vertices, view.edges, {
      raised: false,
      thickness: 0,
      seaLevel: 0,
    });
    for (const o of boxes) {
      const match = drawn.find(
        (p) =>
          Math.abs(p.position[0] - o.position[0] * DICE_SCALE) < 1e-9 &&
          Math.abs(p.position[1] - o.position[2] * DICE_SCALE) < 1e-9,
      );
      expect(match).toBeDefined();
      expect(o.yaw).toBe(match!.yaw);
      expect(o.position[1]).toBeCloseTo(o.half[1], 9); // standing on the land
    }
  });

  it("makes the dice bounce off the pieces", () => {
    const view = crowdedView();
    const obstacles = diceObstacles(view);
    const boxes = obstacles.filter((o): o is BoxObstacle => o.shape === "box");
    let touched = 0;
    let changed = 0;
    for (let index = 0; index < 24; index++) {
      const key = { room: "BOUNCE", index, attempt: 0 };
      const free = simulate(key);
      const crowded = simulate(key, undefined, obstacles);
      const near = [...centers(crowded.recording.data, crowded.recording.frames)].some((p) =>
        boxes.some((o) => boxDistance(p, o) < DIE_SIZE * 0.75),
      );
      if (near) touched++;
      const a = free.recording.data;
      const b = crowded.recording.data;
      if (a.length !== b.length || a.some((x, i) => Math.abs(x - b[i]!) > 1e-3)) changed++;
    }
    expect(touched).toBeGreaterThanOrEqual(6);
    expect(changed).toBeGreaterThanOrEqual(6);
  }, 30_000);

  it("includes pieces, chips and the robber near the middle only", () => {
    const view = crowdedView();
    const obstacles = diceObstacles(view);
    const boxes = obstacles.filter((o) => o.shape === "box");
    expect(boxes.length).toBeGreaterThanOrEqual(6); // 3 buildings + 6 roads on the center hex
    // The robber sits on the center desert.
    expect(
      obstacles.some(
        (o) => o.shape === "cylinder" && Math.hypot(o.position[0], o.position[2]) < 0.01,
      ),
    ).toBe(true);
    expect(
      diceObstacles({
        ...view,
        vertices: view.vertices.map(() => null),
        edges: view.edges.map(() => null),
      } as PlayerView).every((o) => o.shape === "cylinder"),
    ).toBe(true);
  });

  it("never lets a die pass through a piece, and still lands every value", () => {
    const obstacles = diceObstacles(crowdedView());
    const boxes = obstacles.filter((o): o is BoxObstacle => o.shape === "box");
    const cylinders = obstacles.filter((o): o is CylinderObstacle => o.shape === "cylinder");
    let planned = 0;
    for (const a of DIE_VALUES) {
      for (let index = 0; index < 6; index++) {
        const b = DIE_VALUES[(a + index) % 6]!;
        const plan = planThrow("BLOCK1", a * 10 + index, [a, b], obstacles);
        if (!plan) continue; // static fallback is allowed
        planned++;
        for (const p of centers(plan.recording.data, plan.recording.frames)) {
          // A die center never gets closer than half an edge to a piece, less the few
          // hundredths a fast hit sinks in during one physics step before bouncing off.
          for (const o of boxes) expect(boxDistance(p, o)).toBeGreaterThan(DIE_SIZE * 0.3);
          for (const o of cylinders) expect(cylinderDistance(p, o)).toBeGreaterThan(DIE_SIZE * 0.3);
        }
        const rest = (die: 0 | 1) => {
          const [x, y, z, w] = poseAt(plan.recording, die, 1e9).quaternion;
          return { x, y, z, w };
        };
        expect(valueUp(rest(0), plan.models[0])).toBe(a);
        expect(valueUp(rest(1), plan.models[1])).toBe(b);
      }
    }
    expect(planned).toBeGreaterThanOrEqual(34); // most throws still settle flat
  }, 30_000);
});
