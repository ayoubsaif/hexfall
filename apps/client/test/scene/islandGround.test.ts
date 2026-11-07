// The continuous island surface: sea ring, shore distance and ground height.
import { beginnerBoard } from "@hexfall/engine/geometry";
import { describe, expect, it } from "vite-plus/test";
import { boardLayout } from "../../src/scene/layout.ts";
import { groundHeight, islandShore, seaRing } from "../../src/scene/IslandGround.tsx";

const layout = boardLayout(beginnerBoard());
const tiles = layout.tiles.map((t) => ({ position: t.position, assetKey: t.assetKey }));
const land = tiles.map((t) => t.position);
const sea = seaRing(land);

describe("island ground", () => {
  it("rings the 19 land hexes with 18 sea hexes", () => {
    expect(land).toHaveLength(19);
    expect(sea).toHaveLength(18);
  });

  it("treats the border between two land tiles as inland, not as a shore", () => {
    const [a, b] = [land[9]!, land[10]!];
    const mid = islandShore(land, sea, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    expect(mid).toBeLessThan(-1);
  });

  it("is sea past the island and stays at land height inland", () => {
    expect(islandShore(land, sea, 20, 0)).toBeGreaterThan(5);
    const centre = land[9]!;
    const inland = groundHeight(tiles, land, -0.14, centre[0] + 0.95, centre[1]);
    expect(inland.y).toBeGreaterThanOrEqual(0);
  });
});
