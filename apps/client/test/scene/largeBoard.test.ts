// The large 5–6 player board in the scene (specs/board-view "Board rendering from a board value",
// "Sea frame", "Harbor markers", "Board framing"): every element comes from the large topology.
import { createLargeBoard, createRng } from "@hexfall/engine";
import {
  LARGE_TOPOLOGY,
  STANDARD_TOPOLOGY,
  edgeMidpoint,
  hexCenter,
  vertexPosition,
} from "@hexfall/engine/geometry";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vite-plus/test";
import { clearZones, coastScatter } from "../../src/scene/coastScatter.ts";
import { forestTrees } from "../../src/scene/forestTrees.ts";
import { boardLayout } from "../../src/scene/layout.ts";
import { mountainPeaks } from "../../src/scene/mountainPeaks.ts";
import { pastureSheep } from "../../src/scene/pastureSheep.ts";
import { pieceLayout, targetLayout } from "../../src/scene/pieces.ts";
import {
  FIT_FOV,
  FIT_RADIUS,
  fitDistance,
  fitPosition,
  fitRadius,
} from "../../src/scene/useFitCamera.ts";

const [board] = createLargeBoard(createRng(42));
const layout = boardLayout(board);
const flat = { raised: false, thickness: 0, seaLevel: 0 };

describe("boardLayout (large board)", () => {
  it("draws 30 land tiles, two of them deserts, at the large hex centers", () => {
    expect(layout.topology).toBe(LARGE_TOPOLOGY);
    expect(layout.tiles).toHaveLength(30);
    expect(layout.tiles.filter((t) => t.assetKey === "tile.desert")).toHaveLength(2);
    for (const t of layout.tiles) expect(t.position).toEqual(hexCenter(t.hex, LARGE_TOPOLOGY));
    expect(layout.land).toHaveLength(30);
  });

  it("draws 28 tokens, none on a desert", () => {
    expect(layout.tokens).toHaveLength(28);
    for (const t of layout.tokens) expect(board.hexes[t.hex]?.terrain).not.toBe("desert");
  });

  it("draws a 22-cell sea ring outside the island", () => {
    expect(layout.sea).toHaveLength(22);
    expect(new Set(layout.sea.map((s) => s.key)).size).toBe(22);
    const land = layout.tiles.map((t) => t.position);
    for (const s of layout.sea) {
      const nearest = Math.min(
        ...land.map((p) => Math.hypot(p[0] - s.position[0], p[1] - s.position[1])),
      );
      // Each sea cell touches the island (one hex step away) and never overlaps a land tile.
      expect(nearest).toBeCloseTo(Math.sqrt(3), 5);
    }
  });

  it("draws 11 harbors at their slot paths, two of them wool", () => {
    expect(layout.harbors).toHaveLength(11);
    expect(layout.harbors.filter((h) => h.type === "wool")).toHaveLength(2);
    for (const h of layout.harbors) {
      const m = edgeMidpoint(LARGE_TOPOLOGY.harborSlots[h.slot]!, LARGE_TOPOLOGY);
      expect(Math.hypot(h.position[0] - m.x, h.position[1] - m.z)).toBeCloseTo(0.55, 5);
    }
  });

  it("puts the robber on the lower-id desert", () => {
    const desert = board.hexes.findIndex((h) => h.terrain === "desert");
    expect(layout.robber.hex).toBe(desert);
  });
});

describe("pieces and targets on the large board", () => {
  it("places settlements on large-board intersections", () => {
    const vertices = LARGE_TOPOLOGY.vertices.map(() => null) as (null | {
      kind: "settlement";
      owner: 5;
    })[];
    vertices[79] = { kind: "settlement", owner: 5 };
    const edges = LARGE_TOPOLOGY.edges.map(() => null);
    const items = pieceLayout(vertices, edges, flat, LARGE_TOPOLOGY);
    expect(items).toHaveLength(1);
    expect(items[0]!.position).toEqual(vertexPosition(79, LARGE_TOPOLOGY));
  });

  it("places hex targets at large-board hex centers", () => {
    const items = targetLayout(
      { kind: "moveRobber", target: "hex", targets: new Set([29]) },
      flat,
      LARGE_TOPOLOGY,
    );
    expect(items[0]!.position).toEqual(hexCenter(29, LARGE_TOPOLOGY));
  });
});

describe("props and coast on the large board", () => {
  it("dresses every forest, pasture and mountain hex", () => {
    const count = (terrain: string) => board.hexes.filter((h) => h.terrain === terrain).length;
    const forestHexes = new Set(forestTrees(board).map((p) => nearestHex(p.x, p.z)));
    const pastureHexes = new Set(pastureSheep(board).map((p) => nearestHex(p.x, p.z)));
    const mountainHexes = new Set(mountainPeaks(board).map((p) => nearestHex(p.x, p.z)));
    expect(forestHexes.size).toBe(count("forest"));
    expect(pastureHexes.size).toBe(count("pasture"));
    expect(mountainHexes.size).toBe(count("mountains"));
  });

  it("keeps the coast props clear of large-board harbor lanes", () => {
    const zones = clearZones(layout.land, LARGE_TOPOLOGY);
    expect(zones.vertices).toHaveLength(80);
    expect(zones.paths).toHaveLength(109);
    expect(zones.harborLanes).toHaveLength(11);
    expect(coastScatter(layout.land, LARGE_TOPOLOGY).props.length).toBeGreaterThan(0);
  });
});

describe("framing the large board", () => {
  it("keeps the standard fit radius at 6.3", () => {
    expect(fitRadius(STANDARD_TOPOLOGY)).toBeCloseTo(FIT_RADIUS, 10);
    expect(FIT_RADIUS).toBe(6.3);
  });

  it("fits a larger sphere for the large board", () => {
    expect(fitRadius(LARGE_TOPOLOGY)).toBeGreaterThan(FIT_RADIUS);
  });

  for (const [name, aspect] of [
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
  ] as const) {
    for (const elevation of [55, 60]) {
      it(`keeps every land tile and harbor boat in view at ${name}, ${elevation}°`, () => {
        const cam = new PerspectiveCamera(FIT_FOV, aspect, 0.1, 200);
        const distance = fitDistance(aspect, fitRadius(LARGE_TOPOLOGY));
        cam.position.set(...fitPosition(distance, (elevation * Math.PI) / 180));
        cam.lookAt(0, 0, 0);
        cam.updateMatrixWorld();
        cam.updateProjectionMatrix();
        const inView = (x: number, y: number, z: number) => {
          const p = new Vector3(x, y, z).project(cam);
          expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
        };
        for (const t of layout.tiles) inView(t.position[0], 0, t.position[1]);
        for (const h of layout.harbors) {
          const [x, z] = h.position;
          const r = Math.hypot(x, z);
          const cx = x * (1 + 0.75 / r),
            cz = z * (1 + 0.75 / r);
          for (const s of [-1, 0, 1])
            for (const y of [-0.1, 1.0])
              inView(cx + (s * 0.65 * -z) / r, y, cz + (s * 0.65 * x) / r);
        }
      });
    }
  }
});

function nearestHex(x: number, z: number): number {
  let best = 0,
    bestD = Infinity;
  for (const h of LARGE_TOPOLOGY.hexes) {
    const [cx, cz] = hexCenter(h.id, LARGE_TOPOLOGY);
    const d = Math.hypot(cx - x, cz - z);
    if (d < bestD) [best, bestD] = [h.id, d];
  }
  return best;
}
