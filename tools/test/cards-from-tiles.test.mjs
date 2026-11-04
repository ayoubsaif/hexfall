// Tests for tools/cards-from-tiles.mjs (openspec change hud-tailwind-cards, task 2.1).
import sharp from "sharp";
import { describe, expect, it } from "vite-plus/test";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  HARBOR_MAX_BYTES,
  HARBOR_SIZE,
  MAX_BYTES,
  RESOURCE_TILES,
  buildCard,
  buildHarbor,
  cropBox,
} from "../cards-from-tiles.mjs";

describe("cropBox", () => {
  it("is a centered 5:7 box inside the hex of a 1024 tile", () => {
    const b = cropBox(1024);
    expect(b.height / b.width).toBe(1.4);
    expect(b.left + b.width / 2).toBe(512);
    expect(b.top + b.height / 2).toBe(512);
    // Corner (left, top) must lie inside the pointy-top hex: |dy| <= r - |dx| tan 30°.
    const dx = 512 - b.left;
    const dy = 512 - b.top;
    expect(dy).toBeLessThanOrEqual(512 - dx * Math.tan(Math.PI / 6));
    expect(b.width).toBeGreaterThanOrEqual(CARD_WIDTH);
  });
});

describe("buildCard", () => {
  it.each(Object.keys(RESOURCE_TILES))("builds a deterministic %s card", async (resource) => {
    const a = await buildCard(resource);
    const b = await buildCard(resource);
    expect(Buffer.compare(a, b)).toBe(0);
    expect(a.length).toBeLessThanOrEqual(MAX_BYTES);
    const meta = await sharp(a).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(CARD_WIDTH);
    expect(meta.height).toBe(CARD_HEIGHT);
    expect(meta.hasAlpha).toBe(false);
  });
});

describe("buildHarbor", () => {
  it.each(Object.keys(RESOURCE_TILES))(
    "cuts a deterministic square %s badge from the card",
    async (resource) => {
      const card = await buildCard(resource);
      const a = await buildHarbor(card);
      const b = await buildHarbor(card);
      expect(Buffer.compare(a, b)).toBe(0);
      expect(a.length).toBeLessThanOrEqual(HARBOR_MAX_BYTES);
      const meta = await sharp(a).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(HARBOR_SIZE);
      expect(meta.height).toBe(HARBOR_SIZE);
      expect(meta.hasAlpha).toBe(false);
    },
  );
});
