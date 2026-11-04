import { describe, expect, it } from "vite-plus/test";
import { HARBOR_ICON_PATHS } from "../../src/scene/harborIcons.ts";

describe("HARBOR_ICON_PATHS", () => {
  const entries = Object.entries(HARBOR_ICON_PATHS);

  it("has six icons, each with non-empty SVG paths", () => {
    expect(entries.map(([id]) => id).sort()).toEqual([
      "anchor",
      "brickWall",
      "mountain",
      "sheep",
      "trees",
      "wheat",
    ]);
    for (const [, paths] of entries) {
      expect(paths.length).toBeGreaterThan(0);
      for (const d of paths) expect(d).toMatch(/^[Mm][\d.\s-]/);
    }
  });

  it("draws every icon differently", () => {
    expect(new Set(entries.map(([, paths]) => paths.join("|"))).size).toBe(6);
  });
});
