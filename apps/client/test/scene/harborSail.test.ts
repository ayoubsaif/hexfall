// Harbor sails: one light tint per resource, plain sailcloth for 3:1, readable dark rate ink.
import { describe, expect, it } from "vite-plus/test";
import {
  HARBOR_SAIL_BASE,
  SAIL_CLOTH,
  sailLayout,
  sailMaterial,
} from "../../src/scene/harborSail.ts";
import { INK } from "../../src/scene/labels.ts";

const TYPES = ["generic", "brick", "grain", "lumber", "ore", "wool"] as const;

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

describe("harbor sail colours", () => {
  it("gives every resource harbor its own tint and keeps the 3:1 sail plain cloth", () => {
    const { generic, ...special } = HARBOR_SAIL_BASE;
    expect(generic).toBe(SAIL_CLOTH);
    const tints = Object.values(special);
    expect(new Set([...tints, SAIL_CLOTH]).size).toBe(tints.length + 1);
  });

  it("stays light enough for the dark rate text (contrast with INK >= 4.5)", () => {
    const ink = luminance(INK);
    for (const tint of Object.values(HARBOR_SAIL_BASE))
      expect((luminance(tint) + 0.05) / (ink + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("sail label", () => {
  it("shows 3:1 without an icon on the generic sail", () => {
    const l = sailLayout("generic");
    expect(l.rate).toBe("3:1");
    expect(l.icon).toBeNull();
  });

  it("shows 2:1 and the resource icon on special sails", () => {
    for (const t of TYPES.slice(1)) {
      const l = sailLayout(t);
      expect(l.rate).toBe("2:1");
      expect(l.icon).toBe(`/ui/resources/${t}.webp`);
    }
  });

  it("gives the six types six distinct shared materials", () => {
    const mats = TYPES.map((t) => sailMaterial(t));
    expect(new Set(mats).size).toBe(6);
    expect(sailMaterial("ore")).toBe(mats[4]);
  });
});
