import { describe, expect, it } from "vite-plus/test";
import { ASSET_KEYS } from "../../src/theme/keys.ts";
import { parseManifest } from "../../src/theme/manifest.ts";

const base = { id: "diorama", version: 1, license: "CC0-1.0", source: "original" };

describe("asset keys", () => {
  it("is exactly the 18 supported keys", () => {
    expect(ASSET_KEYS).toHaveLength(18);
    expect(new Set(ASSET_KEYS).size).toBe(18);
    expect(ASSET_KEYS).toContain("piece.robber");
    expect(ASSET_KEYS).toContain("harbor.generic");
  });
});

describe("parseManifest", () => {
  it("accepts a partial manifest and maps only the declared keys", () => {
    const r = parseManifest(
      {
        ...base,
        assets: {
          "tile.forest": { model: "forest.glb" },
          "tile.hills": { model: "models/hills.glb" },
        },
      },
      "diorama",
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(Object.keys(r.entries).sort()).toEqual(["tile.forest", "tile.hills"]);
    expect(r.entries["tile.forest"]).toEqual({ model: "forest.glb" });
  });

  it("accepts a manifest that maps zero keys", () => {
    const r = parseManifest(base, "diorama");
    expect(r.valid).toBe(true);
    expect(r.entries).toEqual({});
  });

  it("ignores unknown keys with a warning naming them and keeps valid entries", () => {
    const r = parseManifest(
      {
        ...base,
        assets: { "piece.knight": { model: "knight.glb" }, "piece.city": { model: "city.glb" } },
      },
      "diorama",
    );
    expect(r.valid).toBe(true);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain("piece.knight");
    expect(r.entries["piece.city"]).toEqual({ model: "city.glb" });
    expect("piece.knight" in r.entries).toBe(false);
  });

  it("ignores an unknown key even when its entry is malformed", () => {
    const r = parseManifest({ ...base, assets: { "piece.knight": 42 } }, "diorama");
    expect(r.valid).toBe(true);
    expect(r.warnings[0]).toContain("piece.knight");
  });

  const city = { "piece.city": { model: "city.glb" } };
  const bad = (assets: Record<string, unknown>) => ({ ...base, assets: { ...city, ...assets } });

  it.each<[string, unknown]>([
    ["malformed structure", "not a manifest"],
    ["missing id", { license: "CC0", source: "x", assets: city }],
    ["missing license", { id: "diorama", source: "x", assets: city }],
    ["missing source", { id: "diorama", license: "CC0", assets: city }],
    ["blank license", { ...base, license: "  ", assets: city }],
    ["assets not an object", { ...base, assets: [] }],
    ["non-glb file", bad({ "tile.forest": { model: "forest.png" } })],
    ["path escaping the theme", bad({ "tile.forest": { model: "../../../assets/x.glb" } })],
    ["absolute path", bad({ "tile.forest": { model: "/assets/x.glb" } })],
    ["URL", bad({ "tile.forest": { model: "https://example.com/x.glb" } })],
    ["missing model", bad({ "tile.forest": { scale: 2 } })],
    ["zero scale", bad({ "tile.forest": { model: "f.glb", scale: 0 } })],
    ["bad rotation", bad({ "tile.forest": { model: "f.glb", rotation: [0, 90] } })],
    ["non-numeric offset", bad({ "tile.forest": { model: "f.glb", offset: ["a", 0, 0] } })],
    ["unknown entry field", bad({ "tile.forest": { model: "f.glb", scael: 2 } })],
  ])("rejects the whole manifest on %s: all procedural with an error", (_name, json) => {
    const r = parseManifest(json, "diorama");
    expect(r.valid).toBe(false);
    expect(r.entries).toEqual({});
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('"diorama"');
    expect(r.errors[0]).toMatch(/invalid manifest \(.+\)/);
  });

  it("names the failing field when the license is missing", () => {
    const r = parseManifest({ id: "diorama", source: "x" }, "diorama");
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain("license");
  });

  it("resolves overrides: uniform scale, degrees to radians, offset", () => {
    const r = parseManifest(
      {
        ...base,
        assets: {
          "piece.robber": {
            model: "robber.glb",
            scale: 0.5,
            rotation: [0, 180, 0],
            offset: [0, 0.1, 0],
          },
        },
      },
      "diorama",
    );
    const t = r.entries["piece.robber"]?.transform;
    expect(t?.scale).toEqual([0.5, 0.5, 0.5]);
    expect(t?.rotation[1]).toBeCloseTo(Math.PI);
    expect(t?.offset).toEqual([0, 0.1, 0]);
  });

  it("warns when the manifest id differs from the theme folder", () => {
    const r = parseManifest({ ...base, id: "other" }, "diorama");
    expect(r.valid).toBe(true);
    expect(r.warnings[0]).toContain("other");
  });
});
