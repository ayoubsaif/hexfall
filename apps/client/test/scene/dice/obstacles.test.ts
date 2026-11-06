// Dice collide with board pieces (spec board-dice "Physics throw").
import type { PlayerView } from "@hexfall/engine";
import { beginnerBoard, TOPOLOGY, vertexPosition } from "@hexfall/engine/geometry";
import { describe, expect, it } from "vite-plus/test";
import { poseAt } from "../../../src/scene/dice/controller.ts";
import { valueUp } from "../../../src/scene/dice/faces.ts";
import { type BoxObstacle, diceObstacles } from "../../../src/scene/dice/obstacles.ts";
import { planThrow } from "../../../src/scene/dice/simulate.ts";
import { DIE_EDGE, DIE_VALUES } from "../../../src/theme/die.ts";

/** A beginner board (desert and robber at the center) with pieces around the middle. */
function crowdedView(): PlayerView {
  const board = beginnerBoard();
  const vertices = TOPOLOGY.vertices.map(() => null) as PlayerView["vertices"][number][];
  const edges = TOPOLOGY.edges.map(() => null) as PlayerView["edges"][number][];
  TOPOLOGY.vertices.forEach((_, v) => {
    const [x, z] = vertexPosition(v);
    const r = Math.hypot(x, z);
    // The center hex's corners get alternating settlements and cities, plus a far one.
    if (r < 1.1 && v % 2 === 0)
      vertices[v] = { kind: v % 4 === 0 ? "city" : "settlement", owner: 0 };
    if (r > 4) vertices[v] ??= null;
  });
  TOPOLOGY.edges.forEach((e, i) => {
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

describe("dice obstacles", () => {
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
    let planned = 0;
    for (const a of DIE_VALUES) {
      for (let index = 0; index < 6; index++) {
        const b = DIE_VALUES[(a + index) % 6]!;
        const plan = planThrow("BLOCK1", a * 10 + index, [a, b], obstacles);
        if (!plan) continue; // static fallback is allowed
        planned++;
        for (let f = 0; f < plan.recording.frames; f++) {
          for (const die of [0, 1] as const) {
            const at = f * 14 + die * 7;
            const p: [number, number, number] = [
              plan.recording.data[at]!,
              plan.recording.data[at + 1]!,
              plan.recording.data[at + 2]!,
            ];
            for (const o of boxes) expect(boxDistance(p, o)).toBeGreaterThan(DIE_EDGE * 0.4);
          }
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
