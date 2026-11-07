import { Vector3 } from "three";
import { describe, expect, it } from "vite-plus/test";
import {
  FALLBACKS,
  HARBOR_COLORS,
  SEA_COLOR,
  TERRAIN_COLORS,
} from "../../src/theme/fallbacks/index.ts";
import {
  CHIP,
  CHIP_HEIGHT,
  chipSideGeometry,
  FLAT_LAYER,
  FLAT_SHAPE,
  HARBOR_BADGE_SIZE,
  TOKEN_RADIUS,
  flatGeometry,
} from "../../src/theme/flat.tsx";
import { ASSET_KEYS, assetKind } from "../../src/theme/keys.ts";

const distinct = (colors: string[]) => new Set(colors.map((c) => c.toLowerCase())).size;

describe("flat fallback colors", () => {
  it("gives the six terrains pairwise distinct colors", () => {
    const colors = Object.values(TERRAIN_COLORS);
    expect(colors).toHaveLength(6);
    expect(distinct(colors)).toBe(6);
    expect(colors.map((c) => c.toLowerCase())).not.toContain(SEA_COLOR.toLowerCase());
  });

  it("gives the six harbor types pairwise distinct colors", () => {
    const colors = Object.values(HARBOR_COLORS);
    expect(colors).toHaveLength(6);
    expect(distinct(colors)).toBe(6);
  });
});

describe("flat shapes", () => {
  it("cover exactly the flat-kind keys", () => {
    const flat = ASSET_KEYS.filter((k) => assetKind(k) === "flat").sort();
    expect(Object.keys(FLAT_SHAPE).sort()).toEqual(flat);
  });

  it("has one fallback per key and no diorama variants", () => {
    expect(Object.keys(FALLBACKS).sort()).toEqual([...ASSET_KEYS].sort());
  });

  function points(shape: "hex" | "token" | "badge") {
    const { fill } = flatGeometry(shape);
    const pos = fill.getAttribute("position");
    const uv = fill.getAttribute("uv");
    return Array.from({ length: pos.count }, (_, i) => ({
      p: new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)),
      u: uv.getX(i),
      v: uv.getY(i),
    }));
  }

  it("hex is a pointy-top unit hex on y=0 with corners at ±Z", () => {
    const pts = points("hex");
    for (const { p } of pts) expect(p.y).toBeCloseTo(0);
    const corners = pts.filter(({ p }) => Math.hypot(p.x, p.z) > 0.99);
    expect(corners.length).toBeGreaterThanOrEqual(6);
    expect(corners.some(({ p }) => p.z < -0.999 && Math.abs(p.x) < 1e-6)).toBe(true);
    expect(corners.some(({ p }) => p.z > 0.999 && Math.abs(p.x) < 1e-6)).toBe(true);
  });

  it("hex UVs map a square image per the contract: image top = -Z (top of the board)", () => {
    for (const { p, u, v } of points("hex")) {
      expect(u).toBeCloseTo(0.5 + p.x / 2);
      expect(v).toBeCloseTo(0.5 - p.z / 2);
    }
  });

  it("token is a flat disc of TOKEN_RADIUS with UVs spanning its square", () => {
    for (const { p, u, v } of points("token")) {
      expect(p.y).toBeCloseTo(0);
      expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(TOKEN_RADIUS + 1e-6);
      expect(u).toBeCloseTo(0.5 + p.x / (2 * TOKEN_RADIUS));
      expect(v).toBeCloseTo(0.5 - p.z / (2 * TOKEN_RADIUS));
    }
  });

  it("harbor badge fits HARBOR_BADGE_SIZE with UVs spanning its square", () => {
    const pts = points("badge");
    const half = HARBOR_BADGE_SIZE / 2;
    for (const { p, u, v } of pts) {
      expect(p.y).toBeCloseTo(0);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(half + 1e-6);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(half + 1e-6);
      expect(u).toBeCloseTo(0.5 + p.x / HARBOR_BADGE_SIZE);
      expect(v).toBeCloseTo(0.5 - p.z / HARBOR_BADGE_SIZE);
    }
    expect(Math.max(...pts.map(({ p }) => p.x))).toBeCloseTo(half);
  });

  it("layers markers above tiles and labels above markers", () => {
    expect(FLAT_LAYER.tile).toBe(0);
    expect(FLAT_LAYER.harborLink).toBeGreaterThan(FLAT_LAYER.tileOutline);
    expect(FLAT_LAYER.marker).toBeGreaterThan(FLAT_LAYER.harborLink);
    expect(FLAT_LAYER.label).toBeGreaterThan(FLAT_LAYER.markerOutline);
  });
});

describe("token chip", () => {
  it("is thin: more than zero and at most 0.05 hex radii", () => {
    expect(CHIP_HEIGHT).toBeGreaterThan(0);
    expect(CHIP.label).toBeLessThanOrEqual(0.05);
  });

  it("has a side wall from the board plane to its thickness, at the token radius", () => {
    const g = chipSideGeometry();
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeCloseTo(CHIP_HEIGHT);
    expect(box.max.x).toBeCloseTo(TOKEN_RADIUS);
    expect(box.max.z).toBeCloseTo(TOKEN_RADIUS);
  });

  it("stacks face, outline and number above the side", () => {
    expect(CHIP.face).toBeGreaterThan(CHIP_HEIGHT);
    expect(CHIP.outline).toBeGreaterThan(CHIP.face);
    expect(CHIP.label).toBeGreaterThan(CHIP.outline);
  });

  it("uses one shape for the themed image and the fallback", () => {
    // Both FlatAsset (themed) and the token fallback draw FlatShape with key "token".
    expect(FLAT_SHAPE.token).toBe("token");
    expect(typeof FALLBACKS.token).toBe("function");
  });
});

describe("boat fallback", () => {
  it("has a flat sail facing +X, without UVs, above the hull at every turn", async () => {
    const { BOAT_HULL_TOP, BOAT_MAST, BOAT_SAIL, sailGeometry } =
      await import("../../src/theme/fallbacks/boat.tsx");
    const g = sailGeometry();
    expect(g.getAttribute("uv")).toBeUndefined();
    const normal = g.getAttribute("normal");
    for (let i = 0; i < normal.count; i++) expect(Math.abs(normal.getX(i))).toBeCloseTo(1);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.z - g.boundingBox!.min.z).toBeCloseTo(BOAT_SAIL.halfWidth * 2);
    expect(BOAT_SAIL.bottom).toBeGreaterThan(BOAT_HULL_TOP);
    expect(BOAT_MAST.height).toBeGreaterThan(BOAT_SAIL.top);
  });
});
