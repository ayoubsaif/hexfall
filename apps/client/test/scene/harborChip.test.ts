// Harbor chip paper colours: one light tint per resource, yellow for the plain 3:1 chip.
import { describe, expect, it } from "vite-plus/test";
import { CHIP_YELLOW } from "../../src/scene/ChipDisc.tsx";
import { HARBOR_CHIP_BASE } from "../../src/scene/HarborMarker.tsx";
import { INK } from "../../src/scene/labels.ts";

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

describe("harbor chip colours", () => {
  it("gives every resource harbor its own tint and keeps the 3:1 chip yellow", () => {
    const { generic, ...special } = HARBOR_CHIP_BASE;
    expect(generic).toBe(CHIP_YELLOW);
    const tints = Object.values(special);
    expect(new Set([...tints, CHIP_YELLOW]).size).toBe(tints.length + 1);
  });

  it("stays light enough for the dark rate text (contrast with INK >= 4.5)", () => {
    const ink = luminance(INK);
    for (const tint of Object.values(HARBOR_CHIP_BASE))
      expect((luminance(tint) + 0.05) / (ink + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
