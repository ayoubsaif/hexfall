import type { Board } from "@hexfall/engine";
import {
  STANDARD_TOPOLOGY,
  beginnerBoard,
  edgeMidpoint,
  hexCenter,
} from "@hexfall/engine/geometry";
import { describe, expect, it } from "vite-plus/test";
import { harborLabel } from "../../src/scene/labels.ts";
import { ROBBER_TOKEN_OFFSET, boardLayout } from "../../src/scene/layout.ts";

// Beginner terrains in reading order (AGENTS.md §4a).
const BEGINNER_TERRAINS = [
  "mountains",
  "pasture",
  "forest",
  "fields",
  "hills",
  "pasture",
  "hills",
  "fields",
  "forest",
  "desert",
  "forest",
  "mountains",
  "forest",
  "mountains",
  "fields",
  "pasture",
  "hills",
  "fields",
  "pasture",
];

const len = ([x, z]: readonly [number, number]) => Math.hypot(x, z);

describe("boardLayout (beginner board)", () => {
  const board = beginnerBoard();
  const layout = boardLayout(board);

  it("draws 19 land tiles at their hex centers with terrain keys", () => {
    expect(layout.tiles).toHaveLength(19);
    expect(layout.tiles.map((t) => t.assetKey)).toEqual(BEGINNER_TERRAINS.map((t) => `tile.${t}`));
    for (const t of layout.tiles) expect(t.position).toEqual(hexCenter(t.hex));
    expect(new Set(layout.tiles.map((t) => t.key)).size).toBe(19);
  });

  it("draws an 18-cell sea ring outside the island", () => {
    expect(layout.sea).toHaveLength(18);
    expect(new Set(layout.sea.map((s) => s.key)).size).toBe(18);
    const maxLand = Math.max(...layout.tiles.map((t) => len(t.position)));
    for (const s of layout.sea) expect(len(s.position)).toBeGreaterThan(maxLand);
  });

  it("puts the robber on the desert (hex 9) at its center", () => {
    expect(board.hexes[9]?.terrain).toBe("desert");
    expect(layout.robber.hex).toBe(9);
    expect(layout.robber.position).toEqual(hexCenter(9));
  });

  it("draws a token on every hex but the desert", () => {
    expect(layout.tokens).toHaveLength(18);
    expect(layout.tokens.some((t) => t.hex === 9)).toBe(false);
    for (const t of layout.tokens) expect(t.value).toBe(board.hexes[t.hex]?.token);
  });

  it("draws 9 harbor markers outside their slot paths, linked to both ends", () => {
    expect(layout.harbors).toHaveLength(9);
    for (const h of layout.harbors) {
      const edge = STANDARD_TOPOLOGY.harborSlots[h.slot] ?? -1;
      const m = edgeMidpoint(edge);
      expect(len(h.position)).toBeGreaterThan(len([m.x, m.z]));
      expect(Math.hypot(h.position[0] - m.x, h.position[1] - m.z)).toBeCloseTo(0.55);
      for (const [i, l] of h.links.entries()) {
        const end = h.ends[i] ?? [0, 0];
        expect(l.length).toBeCloseTo(Math.hypot(end[0] - h.position[0], end[1] - h.position[1]));
        // The strip, rotated by yaw, runs from badge to end.
        const half = l.length / 2;
        expect(l.mid[0] + Math.cos(l.yaw) * half).toBeCloseTo(end[0]);
        expect(l.mid[1] - Math.sin(l.yaw) * half).toBeCloseTo(end[1]);
      }
    }
  });

  it("slot 1 is a grain 2:1 harbor and generic harbors read 3:1", () => {
    const slot1 = layout.harbors[1];
    expect(slot1?.type).toBe("grain");
    expect(slot1?.assetKey).toBe("harbor.grain");
    expect(harborLabel("grain")).toEqual({ rate: "2:1" });
    const generic = layout.harbors.filter((h) => h.type === "generic");
    expect(generic).toHaveLength(4);
    for (const h of generic) {
      expect(h.assetKey).toBe("harbor.generic");
      expect(harborLabel(h.type)).toEqual({ rate: "3:1" });
    }
  });

  it("whole layout fits inside the 6.3 framing radius", () => {
    for (const s of layout.sea) expect(len(s.position) + 1).toBeLessThanOrEqual(6.3);
    for (const h of layout.harbors) expect(len(h.position) + 0.25).toBeLessThanOrEqual(6.3);
  });
});

describe("boardLayout (changed board)", () => {
  const base = beginnerBoard();
  const board: Board = {
    hexes: base.hexes.map((h, i) => (i === 0 ? { terrain: "hills", token: 6 } : h)),
    harbors: base.harbors.map((h, i) => (i === 0 ? "ore" : h)),
    robber: 0,
  };
  const layout = boardLayout(board);

  it("follows the new terrains, tokens and harbors with stable keys", () => {
    const before = boardLayout(base);
    expect(layout.tiles[0]?.assetKey).toBe("tile.hills");
    expect(layout.tokens.find((t) => t.hex === 0)?.value).toBe(6);
    expect(layout.harbors[0]?.assetKey).toBe("harbor.ore");
    expect(layout.tiles.map((t) => t.key)).toEqual(before.tiles.map((t) => t.key));
    // Unchanged elements keep their values.
    expect(layout.tiles.slice(1)).toEqual(before.tiles.slice(1));
  });

  it("moves the robber beside the token when its hex has one", () => {
    const [cx, cz] = hexCenter(0);
    expect(layout.robber.position[0]).toBeCloseTo(cx + ROBBER_TOKEN_OFFSET[0]);
    expect(layout.robber.position[1]).toBeCloseTo(cz + ROBBER_TOKEN_OFFSET[1]);
  });
});
