import { describe, expect, it } from "vite-plus/test";
import { ASSET_KEYS, ASSET_KIND, assetKind } from "../../src/theme/keys.ts";

describe("asset kinds", () => {
  it("gives every supported key exactly one kind", () => {
    expect(Object.keys(ASSET_KIND).sort()).toEqual([...ASSET_KEYS].sort());
    for (const key of ASSET_KEYS) expect(["flat", "model"]).toContain(assetKind(key));
  });

  it("has 14 flat keys and 18 model keys", () => {
    const flat = ASSET_KEYS.filter((k) => assetKind(k) === "flat");
    const model = ASSET_KEYS.filter((k) => assetKind(k) === "model");
    expect(flat).toHaveLength(14);
    expect(model.sort()).toEqual([
      "dice.die",
      "piece.city",
      "piece.road",
      "piece.robber",
      "piece.settlement",
      "prop.boat",
      "prop.boulder",
      "prop.bush",
      "prop.camp",
      "prop.cliff",
      "prop.gull",
      "prop.jetty",
      "prop.ore",
      "prop.peak",
      "prop.sheep",
      "prop.tree",
      "prop.wall",
      "prop.woods",
    ]);
  });
});
