import { BoxGeometry, Mesh, MeshStandardMaterial, type Object3D, Group } from "three";
import { describe, expect, it } from "vite-plus/test";
import { FALLBACKS } from "../../src/theme/fallbacks/index.ts";
import { ASSET_KEYS, type AssetKey } from "../../src/theme/keys.ts";
import { parseManifest } from "../../src/theme/manifest.ts";
import { type ResolvedTheme, loadFailureMessage, resolveAsset } from "../../src/theme/resolve.ts";
import { instantiateModel } from "../../src/theme/tint.ts";

function themeFrom(assets: Record<string, unknown>): ResolvedTheme {
  const r = parseManifest(
    { id: "diorama", license: "CC0-1.0", source: "original", assets },
    "diorama",
  );
  return { id: "diorama", baseUrl: "/themes/diorama/", entries: r.entries };
}

describe("resolveAsset", () => {
  it("every supported key has a procedural fallback", () => {
    expect(Object.keys(FALLBACKS).sort()).toEqual([...ASSET_KEYS].sort());
    for (const key of ASSET_KEYS) expect(typeof FALLBACKS[key]).toBe("function");
  });

  it("returns the image or model for mapped keys and the fallback for the rest", () => {
    const theme = themeFrom({
      "tile.forest": { image: "tiles/forest.webp" },
      "piece.city": { model: "city.glb" },
    });
    expect(resolveAsset(theme, "tile.forest")).toEqual({
      kind: "image",
      key: "tile.forest",
      url: "/themes/diorama/tiles/forest.webp",
      projection: "top",
    });
    expect(resolveAsset(theme, "piece.city")).toEqual({
      kind: "model",
      key: "piece.city",
      url: "/themes/diorama/city.glb",
      transform: undefined,
    });
    for (const key of ASSET_KEYS.filter((k) => k !== "tile.forest" && k !== "piece.city")) {
      expect(resolveAsset(theme, key)).toEqual({ kind: "fallback", key, reason: "unmapped" });
    }
  });

  it("with zero mapped keys every key is procedural", () => {
    const theme = themeFrom({});
    for (const key of ASSET_KEYS) expect(resolveAsset(theme, key).kind).toBe("fallback");
  });

  it("an invalid manifest resolves every key to the fallback", () => {
    const r = parseManifest(
      { id: "diorama", assets: { "tile.forest": { image: "forest.webp" } } },
      "diorama",
    );
    const theme: ResolvedTheme = { id: "diorama", baseUrl: "/themes/diorama/", entries: r.entries };
    for (const key of ASSET_KEYS) expect(resolveAsset(theme, key).kind).toBe("fallback");
  });

  it("a kind mismatch resolves every key to the fallback", () => {
    const theme = themeFrom({
      "tile.forest": { model: "forest.glb" },
      "piece.city": { model: "city.glb" },
    });
    for (const key of ASSET_KEYS) expect(resolveAsset(theme, key).kind).toBe("fallback");
  });

  it("applies an override only to its own key", () => {
    const theme = themeFrom({
      "piece.robber": { model: "robber.glb", scale: 0.5 },
      "piece.city": { model: "city.glb" },
    });
    const robber = resolveAsset(theme, "piece.robber");
    const city = resolveAsset(theme, "piece.city");
    expect(robber.kind === "model" && robber.transform?.scale).toEqual([0.5, 0.5, 0.5]);
    expect(city.kind === "model" && city.transform).toBeUndefined();
  });

  it("a failed key falls back without affecting other keys", () => {
    const theme = themeFrom({
      "tile.hills": { image: "missing.webp" },
      "tile.forest": { image: "forest.webp" },
    });
    const failed = new Set<AssetKey>(["tile.hills"]);
    expect(resolveAsset(theme, "tile.hills", failed)).toEqual({
      kind: "fallback",
      key: "tile.hills",
      reason: "failed",
    });
    expect(resolveAsset(theme, "tile.forest", failed).kind).toBe("image");
  });

  it("image load failure message names the key, theme, URL and that it was an image", () => {
    const msg = loadFailureMessage(
      "tile.hills",
      "diorama",
      "image",
      "/themes/diorama/missing.webp",
      new Error("404"),
    );
    expect(msg).toContain("tile.hills");
    expect(msg).toContain("diorama");
    expect(msg).toContain("/themes/diorama/missing.webp");
    expect(msg).toContain("image");
    expect(msg).toContain("404");
  });

  it("model load failure message names the key, theme, URL and that it was a model", () => {
    const msg = loadFailureMessage(
      "piece.city",
      "diorama",
      "model",
      "/themes/diorama/city.glb",
      "bad magic",
    );
    expect(msg).toContain("piece.city");
    expect(msg).toContain("diorama");
    expect(msg).toContain("/themes/diorama/city.glb");
    expect(msg).toContain("load model for");
    expect(msg).toContain("bad magic");
  });

  it("encodes file path segments", () => {
    const sea = resolveAsset(themeFrom({ sea: { image: "water tiles/sea.webp" } }), "sea");
    expect(sea.kind === "image" && sea.url).toBe("/themes/diorama/water%20tiles/sea.webp");
    const city = resolveAsset(themeFrom({ "piece.city": { model: "my city.glb" } }), "piece.city");
    expect(city.kind === "model" && city.url).toBe("/themes/diorama/my%20city.glb");
  });
});

function model(materialNames: string[]): Group {
  const g = new Group();
  for (const name of materialNames) {
    const m = new MeshStandardMaterial({ color: "#123456" });
    m.name = name;
    g.add(new Mesh(new BoxGeometry(), m));
  }
  return g;
}

function colors(root: Object3D): Record<string, string> {
  const out: Record<string, string> = {};
  root.traverse((n) => {
    if (n instanceof Mesh) {
      const m = n.material as MeshStandardMaterial;
      out[m.name] = m.color.getHexString();
    }
  });
  return out;
}

describe("player tinting", () => {
  it("tints only PlayerColor materials when present", () => {
    const source = model(["PlayerColor", "Roof"]);
    const blue = instantiateModel(source, "piece.settlement", "#0000ff");
    expect(colors(blue)).toEqual({ PlayerColor: "0000ff", Roof: "123456" });
    expect(colors(source)).toEqual({ PlayerColor: "123456", Roof: "123456" });
  });

  it("tints the whole piece when there is no PlayerColor material", () => {
    const red = instantiateModel(model(["Wood", "Stone"]), "piece.road", "#ff0000");
    expect(colors(red)).toEqual({ Wood: "ff0000", Stone: "ff0000" });
  });

  it("gives each player its own material instance", () => {
    const source = model(["Body"]);
    const a = instantiateModel(source, "piece.city", "#ff0000");
    const b = instantiateModel(source, "piece.city", "#0000ff");
    expect(colors(a)).toEqual({ Body: "ff0000" });
    expect(colors(b)).toEqual({ Body: "0000ff" });
  });

  it("never tints the robber", () => {
    const robber = instantiateModel(model(["PlayerColor", "Body"]), "piece.robber", "#ff0000");
    expect(colors(robber)).toEqual({ PlayerColor: "123456", Body: "123456" });
  });
});

describe("resolveWaterUrls", () => {
  it("builds urls for declared slots only", async () => {
    const { resolveWaterUrls } = await import("../../src/theme/resolve.ts");
    const theme = {
      id: "diorama",
      baseUrl: "/themes/diorama/",
      entries: {},
      water: { sand: "water/sand.webp" },
    };
    expect(resolveWaterUrls(theme)).toEqual({ sand: "/themes/diorama/water/sand.webp" });
    expect(resolveWaterUrls({ id: theme.id, baseUrl: theme.baseUrl, entries: {} })).toEqual({});
  });
});
