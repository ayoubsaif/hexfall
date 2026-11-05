import { describe, expect, it } from "vite-plus/test";
import { ASSET_KEYS } from "../../src/theme/keys.ts";
import { parseManifest } from "../../src/theme/manifest.ts";

const base = { id: "diorama", version: 1, license: "CC0-1.0", source: "original" };

describe("asset keys", () => {
  it("is exactly the 19 supported keys", () => {
    expect(ASSET_KEYS).toHaveLength(19);
    expect(new Set(ASSET_KEYS).size).toBe(19);
    expect(ASSET_KEYS).toContain("piece.robber");
    expect(ASSET_KEYS).toContain("dice.die");
    expect(ASSET_KEYS).toContain("harbor.generic");
  });
});

describe("parseManifest", () => {
  it("accepts a partial manifest and maps only the declared keys", () => {
    const r = parseManifest(
      {
        ...base,
        assets: {
          "tile.forest": { image: "tiles/forest.webp" },
          "tile.hills": { image: "hills.png" },
          "piece.city": { model: "models/city.glb" },
        },
      },
      "diorama",
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(Object.keys(r.entries).sort()).toEqual(["piece.city", "tile.forest", "tile.hills"]);
    expect(r.entries["tile.forest"]).toEqual({
      kind: "image",
      image: "tiles/forest.webp",
      projection: "top",
    });
    expect(r.entries["piece.city"]).toEqual({ kind: "model", model: "models/city.glb" });
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
    expect(r.entries["piece.city"]).toEqual({ kind: "model", model: "city.glb" });
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
    ["non-glb model file", bad({ "piece.road": { model: "road.png" } })],
    ["model path escaping the theme", bad({ "piece.road": { model: "../../../assets/x.glb" } })],
    ["absolute model path", bad({ "piece.road": { model: "/assets/x.glb" } })],
    ["model URL", bad({ "piece.road": { model: "https://example.com/x.glb" } })],
    ["missing model", bad({ "piece.road": { scale: 2 } })],
    ["zero scale", bad({ "piece.road": { model: "r.glb", scale: 0 } })],
    ["bad rotation", bad({ "piece.road": { model: "r.glb", rotation: [0, 90] } })],
    ["non-numeric offset", bad({ "piece.road": { model: "r.glb", offset: ["a", 0, 0] } })],
    ["unknown model entry field", bad({ "piece.road": { model: "r.glb", scael: 2 } })],
    ["non-image file on a flat key", bad({ "tile.forest": { image: "forest.gif" } })],
    ["image path escaping the theme", bad({ "tile.forest": { image: "../../../assets/x.png" } })],
    ["absolute image path", bad({ "tile.forest": { image: "/assets/x.webp" } })],
    ["image URL", bad({ "tile.forest": { image: "https://example.com/x.jpg" } })],
    ["backslash image path", bad({ "tile.forest": { image: "tiles\\forest.webp" } })],
    ["missing image", bad({ sea: {} })],
    ["unknown flat entry field", bad({ sea: { image: "sea.webp", tint: "#fff" } })],
    ["GLB on a flat key", bad({ "tile.forest": { model: "forest.glb" } })],
    ["image on a model key", bad({ "piece.city": { image: "city.png" } })],
    ["scale override on a flat key", bad({ "tile.forest": { image: "f.webp", scale: 2 } })],
    ["offset override on a flat key", bad({ token: { image: "t.png", offset: [0, 0.1, 0] } })],
  ])("rejects the whole manifest on %s: all procedural with an error", (_name, json) => {
    const r = parseManifest(json, "diorama");
    expect(r.valid).toBe(false);
    expect(r.entries).toEqual({});
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('"diorama"');
    expect(r.errors[0]).toMatch(/invalid manifest \(.+\)/);
  });

  it("names the kind mismatch in the error", () => {
    const glbOnTile = parseManifest(bad({ "tile.forest": { model: "forest.glb" } }), "diorama");
    expect(glbOnTile.errors[0]).toContain("tile.forest");
    expect(glbOnTile.errors[0]).toContain("image");
    const imageOnPiece = parseManifest(bad({ "piece.city": { image: "city.png" } }), "diorama");
    expect(imageOnPiece.errors[0]).toContain("piece.city");
    expect(imageOnPiece.errors[0]).toContain("model");
  });

  it("names the rejected override on a flat key", () => {
    const r = parseManifest(bad({ "tile.forest": { image: "f.webp", scale: 2 } }), "diorama");
    expect(r.errors[0]).toContain("tile.forest");
    expect(r.errors[0]).toContain("scale");
  });

  it.each(["a.png", "a.PNG", "a.webp", "a.jpg", "a.jpeg", "dir/sub/a.JPEG"])(
    "accepts the image file %s on a flat key",
    (image) => {
      const r = parseManifest({ ...base, assets: { "harbor.ore": { image } } }, "diorama");
      expect(r.valid).toBe(true);
      expect(r.entries["harbor.ore"]).toEqual({ kind: "image", image, projection: "top" });
    },
  );

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
    const entry = r.entries["piece.robber"];
    const t = entry?.kind === "model" ? entry.transform : undefined;
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

describe("parseManifest credits", () => {
  const credit = {
    keys: ["piece.city"],
    title: "Pieces",
    author: "Someone",
    url: "https://example.com/model/1",
    license: "CC-BY-4.0",
  };
  const assets = { "piece.city": { model: "models/city.glb" } };

  it("accepts and exposes a valid credit list", () => {
    const r = parseManifest({ ...base, assets, credits: [credit] }, "diorama");
    expect(r.valid).toBe(true);
    expect(r.credits).toEqual([credit]);
  });

  it("defaults to no credits", () => {
    expect(parseManifest({ ...base, assets }, "diorama").credits).toEqual([]);
  });

  it.each([
    ["author", { ...credit, author: undefined }],
    ["url", { ...credit, url: undefined }],
    ["url", { ...credit, url: "javascript:alert(1)" }],
    ["title", { ...credit, title: " " }],
    ["license", { ...credit, license: "" }],
    ["keys", { ...credit, keys: [] }],
    ["keys", { ...credit, keys: ["piece.knight"] }],
  ])("a credit with a bad %s invalidates the manifest", (field, bad) => {
    const r = parseManifest({ ...base, assets, credits: [bad] }, "diorama");
    expect(r.valid).toBe(false);
    expect(r.credits).toEqual([]);
    expect(r.errors[0]).toContain(field);
  });
});
