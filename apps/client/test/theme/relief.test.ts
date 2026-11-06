import { describe, expect, it } from "vite-plus/test";
import { isoGeometry, isoTopUv } from "../../src/theme/flat.tsx";
import { parseManifest } from "../../src/theme/manifest.ts";
import {
  ISO_IMAGE_HEIGHT,
  ISO_IMAGE_WIDTH,
  ISO_SIDE_HEIGHT,
  ISO_THICKNESS,
  LAND_THICKNESS,
  SEA_DEPTH,
  isoTopPixel,
  landRelief,
} from "../../src/theme/relief.ts";

const manifest = (assets: Record<string, unknown>) =>
  parseManifest({ id: "t", license: "CC0-1.0", source: "original", assets }, "t");

describe("isometric manifest entries", () => {
  it("accepts an isometric projection on tile and sea images", () => {
    const r = manifest({
      "tile.forest": { image: "f.webp", projection: "isometric" },
      sea: { image: "s.webp", projection: "isometric" },
      "tile.hills": { image: "h.webp", projection: "top" },
    });
    expect(r.valid).toBe(true);
    expect(r.entries["tile.forest"]).toEqual({
      kind: "image",
      image: "f.webp",
      projection: "isometric",
    });
    expect(r.entries["tile.hills"]).toMatchObject({ projection: "top" });
  });

  it("rejects a projection on token and harbor images", () => {
    for (const key of ["token", "harbor.ore"]) {
      const r = manifest({ [key]: { image: "x.webp", projection: "isometric" } });
      expect(r.valid).toBe(false);
      expect(r.errors[0]).toContain(key);
    }
  });

  it("rejects unknown projection values", () => {
    expect(manifest({ "tile.forest": { image: "f.webp", projection: "oblique" } }).valid).toBe(
      false,
    );
  });
});

describe("land relief", () => {
  const iso = manifest({ "tile.forest": { image: "f.webp", projection: "isometric" } }).entries;
  const top = manifest({ "tile.forest": { image: "f.webp" } }).entries;
  const isoSeaOnly = manifest({ sea: { image: "s.webp", projection: "isometric" } }).entries;

  it("raises the island and lowers the sea when a terrain image is isometric", () => {
    expect(landRelief(iso)).toEqual({
      raised: true,
      isometric: true,
      thickness: LAND_THICKNESS,
      seaLevel: -SEA_DEPTH,
    });
  });

  it("raises top-down terrain images too, without the isometric camera", () => {
    expect(landRelief(top)).toEqual({
      raised: true,
      isometric: false,
      thickness: LAND_THICKNESS,
      seaLevel: -SEA_DEPTH,
    });
  });

  it("stays flat with no terrain image (an isometric sea alone, or procedural terrain)", () => {
    for (const r of [landRelief(isoSeaOnly), landRelief(manifest({}).entries)]) {
      expect(r).toEqual({ raised: false, thickness: 0, seaLevel: 0 });
    }
  });
});

describe("isometric image mapping (1024 x 1088 template)", () => {
  it("has the template size and band", () => {
    expect([ISO_IMAGE_WIDTH, ISO_IMAGE_HEIGHT, ISO_SIDE_HEIGHT]).toEqual([1024, 1088, 64]);
  });

  it("maps the hex corners to the template's top-face corners", () => {
    const corners = [0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i * Math.PI) / 3;
      return isoTopPixel(Math.sin(a), Math.cos(a)).map((v) => Math.round(v));
    });
    // corner 0 = bottom, then counter-clockwise on screen: lower-right, upper-right, top, ...
    expect(corners).toEqual([
      [512, 1024],
      [1024, 768],
      [1024, 256],
      [512, 0],
      [0, 256],
      [0, 768],
    ]);
    expect(isoTopPixel(0, 0)).toEqual([512, 512]);
  });

  it("uses v-up texture coordinates and keeps the top face above the band", () => {
    const [u, v] = isoTopUv(0, 1); // bottom corner
    expect(u).toBeCloseTo(0.5);
    expect(v).toBeCloseTo(1 - 1024 / 1088);
  });

  it("builds a prism: 6 side faces reaching down ISO_THICKNESS, band UVs below the top face", () => {
    const { sides } = isoGeometry();
    const pos = sides.getAttribute("position");
    const uv = sides.getAttribute("uv");
    expect(pos.count).toBe(36);
    let minY = 0;
    for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
    expect(minY).toBeCloseTo(-ISO_THICKNESS);
    for (let i = 0; i < uv.count; i++) {
      const py = (1 - uv.getY(i)) * ISO_IMAGE_HEIGHT;
      if (pos.getY(i) < 0) expect(py).toBeGreaterThan(768 + ISO_SIDE_HEIGHT - 1);
    }
  });
});
